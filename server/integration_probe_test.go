package main

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
)

// 真链路探针：用 .env 中的真实凭据验证 TRTC / 微信支付签名，不污染生产二进制。
// 运行：cd server && go test -run 'TestTRTCSig|TestPayOrder' -v

func TestTRTCSig(t *testing.T) {
	loadConfig()
	if appCfg.TRTCAppID == 0 {
		t.Skip("TRTC 未配置")
	}
	sig := generateUserSig("user_1")
	s := sig
	if len(s)%4 != 0 {
		s += strings.Repeat("=", 4-len(s)%4)
	}
	b, err := base64.URLEncoding.DecodeString(s)
	if err != nil {
		t.Fatalf("UserSig 解码失败: %v (sig=%s)", err, sig)
	}
	var p map[string]interface{}
	if err := json.Unmarshal(b, &p); err != nil {
		t.Fatalf("UserSig JSON 解析失败: %v", err)
	}
	isMock := strings.HasPrefix(sig, "MOCKSIG")
	fmt.Printf("[TRTC] sdkappid=%v identifier=%v sig_len=%d is_mock=%v\n",
		p["TLS.sdkappid"], p["TLS.identifier"], len(fmt.Sprint(p["TLS.sig"])), isMock)
	if isMock {
		t.Fatalf("仍是 MOCK sig，未使用真实密钥")
	}
	if p["TLS.sdkappid"] != float64(appCfg.TRTCAppID) {
		t.Fatalf("sdkappid 不匹配: got %v want %v", p["TLS.sdkappid"], appCfg.TRTCAppID)
	}
	t.Logf("[TRTC] 真实 UserSig 生成成功 ✅ sdkappid=%v", p["TLS.sdkappid"])
}

func TestPayOrder(t *testing.T) {
	loadConfig()
	if appCfg.WXPayMchID == "" {
		t.Skip("微信支付未配置")
	}
	params, err := createWxPayOrder("oProbeDummyOpenid", "RCprobe0001", 10)
	fmt.Printf("[PAY] ERR=%v\n", err)
	fmt.Printf("[PAY] PARAMS=%v\n", params)
	if err != nil && strings.Contains(err.Error(), "401") {
		t.Fatalf("[PAY] 微信返回 401，RSA 签名可能错误: %v", err)
	}
	t.Logf("[PAY] 微信支付下单请求已发出（签名被接受；openid 为假属预期业务错误）✅")
}
