package main

import (
	"os"
	"strconv"
	"strings"
)

// AppConfig 汇总所有外部依赖的配置（腾讯云 TRTC / 微信登录 / 微信支付 / MySQL / JWT）。
// 全部通过环境变量注入；任何一项缺失时，代码自动回退到 MVP 占位逻辑，
// 保证「无真实凭据也能跑通、能测试」（e2e 15/15 不破）。
type AppConfig struct {
	MySQLDSN        string // 例: root:pass@tcp(127.0.0.1:3306)/hearcup?charset=utf8mb4&parseTime=true
	TRTCAppID       int64  // 腾讯云 TRTC SDKAppID
	TRTCSecret      string // 腾讯云 TRTC 密钥（用于生成真实 UserSig）
	WXAppID         string // 微信小程序 appid
	WXSecret        string // 微信小程序 secret（code→openid 用）
	WXPayMchID      string // 微信支付 商户号
	WXPaySerial     string // 商户 API 证书序列号
	WXPayAPIv3Key   string // 微信支付 APIv3 密钥（回调 AES 解密用）
	WXPayPrivateKey string // 商户 API 私钥 PEM（内容或文件路径）
	WXPayNotifyURL  string // 支付结果回调地址（需公网 HTTPS）
	JWTSecret       string
}

var appCfg AppConfig

func loadConfig() {
	loadDotEnv(".env")
	appCfg = AppConfig{
		MySQLDSN:        os.Getenv("HEARCUP_MYSQL_DSN"),
		TRTCAppID:       atoi64(os.Getenv("HEARCUP_TRTC_APPID")),
		TRTCSecret:      os.Getenv("HEARCUP_TRTC_SECRET"),
		WXAppID:         os.Getenv("HEARCUP_WX_APPID"),
		WXSecret:        os.Getenv("HEARCUP_WX_SECRET"),
		WXPayMchID:      os.Getenv("HEARCUP_WXPAY_MCHID"),
		WXPaySerial:     os.Getenv("HEARCUP_WXPAY_SERIAL"),
		WXPayAPIv3Key:   os.Getenv("HEARCUP_WXPAY_APIV3_KEY"),
		WXPayPrivateKey: os.Getenv("HEARCUP_WXPAY_PRIVATE_KEY"),
		WXPayNotifyURL:  os.Getenv("HEARCUP_WXPAY_NOTIFY_URL"),
		JWTSecret:       os.Getenv("HEARCUP_JWT_SECRET"),
	}
	if appCfg.JWTSecret == "" {
		appCfg.JWTSecret = "hearcup_dev_secret_change_me"
	}
	// 私钥：环境变量若是文件路径则读取内容
	if appCfg.WXPayPrivateKey != "" && fileExists(appCfg.WXPayPrivateKey) {
		if b, err := os.ReadFile(appCfg.WXPayPrivateKey); err == nil {
			appCfg.WXPayPrivateKey = string(b)
		}
	}
	// JWT 密钥
	jwtSecret = appCfg.JWTSecret
}

func atoi64(s string) int64 {
	if s == "" {
		return 0
	}
	v, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 0
	}
	return v
}

func fileExists(p string) bool {
	info, err := os.Stat(p)
	if err != nil {
		return false
	}
	return !info.IsDir()
}

// loadDotEnv 读取同目录 .env（KEY=VALUE，支持 # 注释与单/双引号包裹）。
// 仅当环境变量尚未设置时才填充，便于真实环境变量覆盖；读取失败静默跳过。
func loadDotEnv(path string) {
	b, err := os.ReadFile(path)
	if err != nil {
		return
	}
	for _, line := range strings.Split(string(b), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		idx := strings.Index(line, "=")
		if idx < 0 {
			continue
		}
		k := strings.TrimSpace(line[:idx])
		v := strings.TrimSpace(line[idx+1:])
		v = strings.Trim(v, "`\"'")
		if k != "" && os.Getenv(k) == "" {
			os.Setenv(k, v)
		}
	}
}
