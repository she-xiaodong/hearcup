package main

import (
	"os"
	"strconv"
	"strings"
)

// AppConfig 汇总所有外部依赖的配置（微信登录 / 微信支付 / 商家转账 / MySQL / JWT）。
// 全部通过环境变量注入；任何一项缺失时，代码自动回退到 MVP 占位逻辑，
// 保证「无真实凭据也能跑通、能测试」（e2e 15/15 不破）。
type AppConfig struct {
	MySQLDSN        string // 例: root:pass@tcp(127.0.0.1:3306)/hearcup?charset=utf8mb4&parseTime=true
	WXAppID         string // 微信小程序 appid
	WXSecret        string // 微信小程序 secret（code→openid 用）
	WXPayMchID      string // 微信支付 商户号
	WXPaySerial     string // 商户 API 证书序列号
	WXPayAPIv3Key   string // 微信支付 APIv3 密钥（回调 AES 解密用）
	WXPayPrivateKey string // 商户 API 私钥 PEM（内容或文件路径）
	WXPayNotifyURL  string // 支付结果回调地址（需公网 HTTPS）
	// 商家转账到零钱（分佣打款给倾听者）
	WXPayTransferSceneID    string // 转账场景ID（须在商户平台-商家转账开通，如 1001 分销佣金）
	WXPayTransferSceneInfos string // transfer_scene_report_infos 的 JSON 字符串（按场景报备，如 岗位类型/报酬说明）
	WXPayTransferNotifyURL  string // 转账结果异步回调地址（可选，公网 HTTPS）
	FreeCall                bool   // 免费通话模式：跳过余额校验/冻结/扣费（支付被限制时用于先跑通通话）
	JWTSecret               string
}

var appCfg AppConfig

func loadConfig() {
	loadDotEnv(".env")
	appCfg = AppConfig{
		MySQLDSN:                os.Getenv("HEARCUP_MYSQL_DSN"),
		WXAppID:                 os.Getenv("HEARCUP_WX_APPID"),
		WXSecret:                os.Getenv("HEARCUP_WX_SECRET"),
		WXPayMchID:              os.Getenv("HEARCUP_WXPAY_MCHID"),
		WXPaySerial:             os.Getenv("HEARCUP_WXPAY_SERIAL"),
		WXPayAPIv3Key:           os.Getenv("HEARCUP_WXPAY_APIV3_KEY"),
		WXPayPrivateKey:         os.Getenv("HEARCUP_WXPAY_PRIVATE_KEY"),
		WXPayNotifyURL:          os.Getenv("HEARCUP_WXPAY_NOTIFY_URL"),
		WXPayTransferSceneID:    os.Getenv("HEARCUP_WXPAY_TRANSFER_SCENE_ID"),
		WXPayTransferSceneInfos: os.Getenv("HEARCUP_WXPAY_TRANSFER_SCENE_INFOS"),
		WXPayTransferNotifyURL:  os.Getenv("HEARCUP_WXPAY_TRANSFER_NOTIFY_URL"),
		FreeCall:                envBool(os.Getenv("HEARCUP_FREE_CALL")),
		JWTSecret:               os.Getenv("HEARCUP_JWT_SECRET"),
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

// envBool 把环境变量解析为布尔：1/true/yes/on 视为 true，其余为 false
func envBool(s string) bool {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "1", "true", "yes", "on":
		return true
	}
	return false
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
