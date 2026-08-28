package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// 微信小程序登录：用 wx.login() 拿到的 code 换取 openid / session_key / unionid。
// 文档：https://developers.weixin.qq.com/miniprogram/dev/api-backend/openapi/login/auth.code2Session.html
func wechatCode2Session(code string) (openid, sessionKey, unionid string, err error) {
	if appCfg.WXAppID == "" || appCfg.WXSecret == "" {
		return "", "", "", fmt.Errorf("微信小程序 appid/secret 未配置")
	}
	u := fmt.Sprintf("https://api.weixin.qq.com/sns/jscode2session?appid=%s&secret=%s&js_code=%s&grant_type=authorization_code",
		url.QueryEscape(appCfg.WXAppID), url.QueryEscape(appCfg.WXSecret), url.QueryEscape(code))
	client := &http.Client{Timeout: 8 * time.Second}
	resp, e := client.Get(u)
	if e != nil {
		return "", "", "", e
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	var m struct {
		Openid     string `json:"openid"`
		SessionKey string `json:"session_key"`
		Unionid    string `json:"unionid"`
		ErrCode    int    `json:"errcode"`
		ErrMsg     string `json:"errmsg"`
	}
	_ = json.Unmarshal(b, &m)
	if m.ErrCode != 0 {
		return "", "", "", fmt.Errorf("%s(errcode=%d)", m.ErrMsg, m.ErrCode)
	}
	return m.Openid, m.SessionKey, m.Unionid, nil
}
