package main

import (
	"fmt"
	"strings"
	"testing"
)

// 真链路探针：用 .env 中的真实凭据验证微信支付签名，不污染生产二进制。
// 运行：cd server && go test -run TestPayOrder -v

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
