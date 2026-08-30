package main

// 微信订阅消息兜底：当倾听者小程序已被系统回收（IM 离线）时，
// 用「订阅消息」发送一条卡片通知，点击直达接听页，作为离线触达的最后一道防线。
//
// 说明：
//   - 订阅消息是「一次性订阅」：每条通知都需要用户事先授权过一次（前端在
//     「上线接单」时调用 wx.requestSubscribeMessage 授权）。
//   - 未授权/模板 ID 未配置时，发送失败只记日志，绝不阻断主流程（计费/通话记录已独立落库）。
//   - 主触达通道仍是 IM 离线推送（见 im.go 的 OfflinePushInfo），订阅消息只是兜底。

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sync"
	"time"
)

var (
	atMu    sync.Mutex
	atValue string
	atExpAt int64
)

// wechatAccessToken 获取小程序全局 access_token（带缓存）。
// 官方有效期 7200s，这里提前 300s 刷新，避免边界过期。
func wechatAccessToken() (string, error) {
	if appCfg.WXAppID == "" || appCfg.WXSecret == "" {
		return "", fmt.Errorf("微信 appid/secret 未配置")
	}
	atMu.Lock()
	defer atMu.Unlock()
	if atValue != "" && now() < atExpAt-300 {
		return atValue, nil
	}
	u := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=%s&secret=%s",
		url.QueryEscape(appCfg.WXAppID), url.QueryEscape(appCfg.WXSecret))
	resp, err := (&http.Client{Timeout: 8 * time.Second}).Get(u)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	var m struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int64  `json:"expires_in"`
		ErrCode     int    `json:"errcode"`
		ErrMsg      string `json:"errmsg"`
	}
	_ = json.Unmarshal(b, &m)
	if m.ErrCode != 0 || m.AccessToken == "" {
		return "", fmt.Errorf("access_token 获取失败 %s(errcode=%d)", m.ErrMsg, m.ErrCode)
	}
	atValue = m.AccessToken
	atExpAt = now() + m.ExpiresIn
	return atValue, nil
}

// wechatSendSubscribeMessage 发送订阅消息。
// data 的 key（thing1/thing2/time3...）必须与微信后台申请的模板关键词一一对应，
// 模板字段有调整时只改这一处的 data 组装即可。
func wechatSendSubscribeMessage(openid, page string, data map[string]map[string]string) error {
	if appCfg.SubscribeTplID == "" {
		return fmt.Errorf("订阅消息模板 ID 未配置")
	}
	if openid == "" {
		return fmt.Errorf("openid 为空")
	}
	token, err := wechatAccessToken()
	if err != nil {
		return err
	}
	body := map[string]interface{}{
		"touser":      openid,
		"template_id": appCfg.SubscribeTplID,
		"page":        page,
		"data":        data,
	}
	raw, _ := json.Marshal(body)
	req, err := http.NewRequest(http.MethodPost,
		"https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token="+url.QueryEscape(token),
		bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := (&http.Client{Timeout: 8 * time.Second}).Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	out, _ := io.ReadAll(resp.Body)
	var m struct {
		ErrCode int    `json:"errcode"`
		ErrMsg  string `json:"errmsg"`
	}
	_ = json.Unmarshal(out, &m)
	if m.ErrCode != 0 {
		return fmt.Errorf("%s(errcode=%d)", m.ErrMsg, m.ErrCode)
	}
	return nil
}

// sendMissedCallSubscribe 未接来电的订阅消息兜底。
// 与 imSendMissedCall 并行使用：IM 推送负责实时触达，订阅消息负责离线兜底。
func sendMissedCallSubscribe(toUID int64, callerName string, callType int, roomID string) {
	if appCfg.SubscribeTplID == "" || toUID == 0 {
		return
	}
	openid := getUserOpenidNoLock(toUID)
	if openid == "" {
		logf("[submsg] 未接订阅消息跳过：uid=%d 无 openid", toUID)
		return
	}
	typeText := "语音倾诉"
	if callType == 2 {
		typeText = "视频倾诉"
	}
	// 字段名 thing1/thing2/time3 与模板关键词对应，申请到模板后按实际调整
	data := map[string]map[string]string{
		"thing1": {"value": truncateStr(defaultStr(callerName, "用户"), 20)},
		"thing2": {"value": typeText},
		"time3":  {"value": time.Unix(now(), 0).Format("2006年01月02日 15:04")},
	}
	page := "pages/calling/calling?room_id=" + url.QueryEscape(roomID)
	if err := wechatSendSubscribeMessage(openid, page, data); err != nil {
		logf("[submsg] 未接订阅消息发送失败 uid=%d err=%v", toUID, err)
	}
}

// getUserOpenidNoLock 安全读取用户 openid（仅用于触发外部 IO，不长期持锁）
func getUserOpenidNoLock(uid int64) string {
	store.mu.Lock()
	defer store.mu.Unlock()
	if u, ok := store.db.Users[uid]; ok {
		return u.Openid
	}
	return ""
}
