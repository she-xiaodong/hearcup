package main

// 腾讯云即时通信 IM 服务端（REST API）客户端。
//
// 职责边界（重要）：
//   - TUICallKit 负责「通话信令 + 音视频 + 来电 UI + 离线推送」，前端直连腾讯云，不经过本服务。
//   - 本服务只负责「业务侧」：IM 账号开通、在线状态查询、未接来电通知、计费结算。
//   - 两端通过 room_id 关联：房间号由本服务生成，前端传给 TUICallKit 作为通话房间。
//
// 参考：https://cloud.tencent.com/document/product/269/1519

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

const (
	imBaseURL    = "https://console.tim.qq.com/v4"
	imSigExpire  = 1800 // 管理员 UserSig 有效期（秒）；官方建议不超过 1800
	imSigRefresh = 300  // 提前多少秒刷新，避免边界过期
)

var (
	imSigMu    sync.Mutex
	imSigValue string
	imSigExpAt int64
	imImported = map[int64]bool{} // 已导入过 IM 账号的 uid（进程内缓存，重启后 account_import 幂等重跑）
	imImportMu sync.Mutex
	imHTTPCli  = &http.Client{Timeout: 10 * time.Second}
)

// imAdmin 返回 App 管理员账号（默认 administrator，可在 .env 用 HEARCUP_IM_ADMIN 覆盖）
func imAdmin() string {
	if v := strings.TrimSpace(os.Getenv("HEARCUP_IM_ADMIN")); v != "" {
		return v
	}
	return "administrator"
}

// imUserID 把 Hearcup 的用户主键映射为全局唯一的 IM userID。
// 统一使用单一身份（不再区分 user_/provider_ 两套前缀），避免同一个人
// 既是普通用户又是倾听者时出现两个 IM 身份、导致通话串线。
// IM userID 仅允许英文字母、数字、下划线、连词符。
func imUserID(uid int64) string {
	return fmt.Sprintf("hearcup_%d", uid)
}

// imEnabled 判断 IM 是否可用（未配置 SDKAppID/密钥时静默降级，不阻断主流程）
func imEnabled() bool {
	return appCfg.TRTCAppID != 0 && appCfg.TRTCSecret != ""
}

// imAdminSig 带缓存地获取管理员 UserSig，避免每次请求都重新签名。
func imAdminSig() string {
	imSigMu.Lock()
	defer imSigMu.Unlock()
	ts := now()
	if imSigValue != "" && ts < imSigExpAt-imSigRefresh {
		return imSigValue
	}
	imSigValue = generateUserSigAt(imAdmin(), ts, imSigExpire)
	imSigExpAt = ts + imSigExpire
	return imSigValue
}

func imURL(svc, cmd string) string {
	return fmt.Sprintf("%s/%s/%s?sdkappid=%d&identifier=%s&usersig=%s&random=%d&contenttype=json",
		imBaseURL, svc, cmd, appCfg.TRTCAppID,
		url.QueryEscape(imAdmin()), url.QueryEscape(imAdminSig()),
		rand.Int31n(1000000),
	)
}

// imPost 调用 IM REST API，返回原始响应 map。
// 任何网络/解析失败都不向调用方抛 panic，统一以 error 返回，便于业务侧静默降级。
func imPost(svc, cmd string, body interface{}) (map[string]interface{}, error) {
	var raw []byte
	if body != nil {
		raw, _ = json.Marshal(body)
	}
	req, err := http.NewRequest(http.MethodPost, imURL(svc, cmd), bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := imHTTPCli.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	out, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var m map[string]interface{}
	if err := json.Unmarshal(out, &m); err != nil {
		return nil, fmt.Errorf("IM 响应解析失败: %v, body=%s", err, truncateStr(string(out), 200))
	}
	return m, nil
}

// imOK 判断 IM 响应是否成功（ActionStatus=OK 且 ErrorCode=0）
func imOK(m map[string]interface{}, err error) error {
	if err != nil {
		return err
	}
	if m == nil {
		return fmt.Errorf("IM 无响应")
	}
	if code, ok := m["ErrorCode"].(float64); ok && code != 0 {
		return fmt.Errorf("IM 错误 %d: %v", int(code), m["ErrorInfo"])
	}
	if s, ok := m["ActionStatus"].(string); ok && s != "OK" {
		return fmt.Errorf("IM 状态异常: %v", m["ErrorInfo"])
	}
	return nil
}

// imEnsureAccount 确保该 Hearcup 用户拥有可用的 IM 账号，并同步昵称/头像。
// account_import 与 portrait_set 均幂等，重复调用无副作用。
// 未配置 IM 时直接返回，不阻断登录等主流程。
func imEnsureAccount(uid int64, nickname, avatar string) {
	if !imEnabled() || uid == 0 {
		return
	}
	userID := imUserID(uid)

	imImportMu.Lock()
	_, done := imImported[uid]
	imImportMu.Unlock()

	if !done {
		err := imOK(imPost("im_open_login_svc", "account_import", map[string]interface{}{
			"UserID":  userID,
			"Nick":    defaultStr(nickname, "HearCup用户"),
			"FaceUrl": avatar,
		}))
		if err != nil {
			// 10004 = 账号已存在，属幂等成功
			if !strings.Contains(err.Error(), "10004") {
				logf("[IM] 导入账号失败 uid=%d userID=%s err=%v", uid, userID, err)
				return
			}
		}
		imImportMu.Lock()
		imImported[uid] = true
		imImportMu.Unlock()
	}

	// 资料同步（昵称/头像）。每次登录刷新，保证通话界面显示的是最新信息。
	items := []map[string]interface{}{}
	if nickname != "" {
		items = append(items, map[string]interface{}{"Tag": "Tag_Profile_IM_Nick", "Value": nickname})
	}
	if avatar != "" {
		items = append(items, map[string]interface{}{"Tag": "Tag_Profile_IM_Image", "Value": avatar})
	}
	if len(items) == 0 {
		return
	}
	if err := imOK(imPost("profile", "portrait_set", map[string]interface{}{
		"From_Account": userID,
		"ProfileItem":  items,
	})); err != nil {
		logf("[IM] 设置资料失败 uid=%d err=%v", uid, err)
	}
}

// imQueryOnline 查询一批用户的在线状态。
// 返回 map[userID]status，status 取值：Online / PushOnline / Offline。
// Offline 表示小程序已被销毁，此时必须依赖离线推送（订阅消息/IM 推送）触达。
func imQueryOnline(userIDs []string) (map[string]string, error) {
	if !imEnabled() || len(userIDs) == 0 {
		return map[string]string{}, nil
	}
	if len(userIDs) > 100 { // IM 单次上限 100
		userIDs = userIDs[:100]
	}
	m, err := imPost("openim", "querystate", map[string]interface{}{"To_Account": userIDs})
	if err != nil {
		return nil, err
	}
	if err := imOK(m, nil); err != nil {
		return nil, err
	}
	res := map[string]string{}
	if arr, ok := m["QueryResult"].([]interface{}); ok {
		for _, it := range arr {
			if obj, ok := it.(map[string]interface{}); ok {
				id, _ := obj["To_Account"].(string)
				st, _ := obj["Status"].(string)
				res[id] = st
			}
		}
	}
	return res, nil
}

// imSendMissedCall 向倾听者发送「未接通话」通知（C2C 自定义消息）。
// 用于呼叫超时后补发提醒，避免倾听者完全无感知。
// 发送失败只记日志，不阻断业务（通话记录与计费已独立落库）。
func imSendMissedCall(toUID int64, callerName string, callType int) {
	if !imEnabled() || toUID == 0 {
		return
	}
	typeText := "语音"
	if callType == 2 {
		typeText = "视频"
	}
	payload := map[string]interface{}{
		"businessID": "hearcup_missed_call",
		"text":       fmt.Sprintf("您有一个未接的%s通话，来自 %s", typeText, defaultStr(callerName, "用户")),
		"call_type":  callType,
		"time":       now(),
	}
	data, _ := json.Marshal(payload)
	err := imOK(imPost("openim", "sendmsg", map[string]interface{}{
		"From_Account":     imAdmin(),
		"To_Account":       imUserID(toUID),
		"SyncOtherMachine": 2, // 不同步到发送方其他设备
		"MsgRandom":        rand.Int31n(100000000),
		"MsgTimeStamp":     now(),
		"MsgBody": []map[string]interface{}{{
			"MsgType":    "TIMCustomElem",
			"MsgContent": map[string]interface{}{"Data": string(data), "Desc": "未接通话", "Ext": "missed_call"},
		}},
		"OfflinePushInfo": map[string]interface{}{
			"PushFlag":    0, // 0=正常推送（离线时推）
			"Title":       "HearCup 未接来电",
			"Description": fmt.Sprintf("您有一个未接的%s通话", typeText),
			"Ext":         "hearcup://missed_call",
		},
	}))
	if err != nil {
		logf("[IM] 未接通知发送失败 toUID=%d err=%v", toUID, err)
	}
}

// logf 统一日志前缀，便于线上用 grep '[im]' 过滤排查（与既有 [pay] 风格一致）
func logf(format string, args ...interface{}) {
	fmt.Printf("[im] "+format+"\n", args...)
}

func defaultStr(s, def string) string {
	if strings.TrimSpace(s) == "" {
		return def
	}
	return s
}

func truncateStr(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
