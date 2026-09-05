package main

import (
	"context"
	"flag"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

type ctxKey string

const paramsKey ctxKey = "params"

type route struct {
	method  string
	pattern string
	handler http.HandlerFunc
}

// 带路径参数的处理器包装
func ph(fn func(http.ResponseWriter, *http.Request, map[string]string)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		params, _ := r.Context().Value(paramsKey).(map[string]string)
		if params == nil {
			params = map[string]string{}
		}
		fn(w, r, params)
	}
}

var routes = []route{
	{http.MethodPost, "/api/v1/auth/login", hAuthLogin},
	{http.MethodGet, "/api/v1/user/profile", hUserProfile},
	{http.MethodPost, "/api/v1/user/profile", hUserUpdateProfile},
	{http.MethodGet, "/api/v1/user/balance", hUserBalance},
	{http.MethodPost, "/api/v1/feedback", hFeedback},

	{http.MethodGet, "/api/v1/providers/online", hProvidersOnline},
	{http.MethodGet, "/api/v1/providers/all", hProvidersAll},
	{http.MethodGet, "/api/v1/providers/:id", ph(hProviderDetail)},

	{http.MethodPost, "/api/v1/call/invite", hCallInvite},
	{http.MethodPost, "/api/v1/call/pay", hCallPay},
	{http.MethodPost, "/api/v1/call/confirm", hCallConfirmPay},
	{http.MethodPost, "/api/v1/call/start", hCallStart},
	{http.MethodPost, "/api/v1/call/refund", hCallRefund},
	// 电话拨号方案：上报通话时长并结算
	{http.MethodPost, "/api/v1/call/end/minutes", hCallEndWithMinutes},
	{http.MethodPost, "/api/v1/call/rating", hCallRating},
	{http.MethodGet, "/api/v1/call/records", hCallRecords},

	{http.MethodPost, "/api/v1/recharge/create", hRechargeCreate},
	{http.MethodGet, "/api/v1/recharge/records", hRechargeRecords},
	{http.MethodPost, "/api/v1/pay/callback", hWxPayCallback},
	{http.MethodPost, "/api/v1/pay/transfer/callback", hWxTransferCallback},

	{http.MethodPost, "/api/v1/provider/apply", hProviderApply},
	{http.MethodGet, "/api/v1/provider/status", hProviderStatus},
	{http.MethodPut, "/api/v1/provider/online", hProviderOnline},
	{http.MethodPut, "/api/v1/provider/offline", hProviderOffline},
	{http.MethodGet, "/api/v1/provider/earnings", hProviderEarnings},
	{http.MethodGet, "/api/v1/provider/calls", hProviderCalls},
	{http.MethodGet, "/api/v1/provider/withdrawals", hProviderWithdrawals},
	{http.MethodPut, "/api/v1/provider/profile", hProviderProfileUpdate},
	{http.MethodPost, "/api/v1/provider/withdraw", hProviderWithdraw},
	{http.MethodGet, "/api/v1/provider/transfers", hProviderTransfers},
	{http.MethodPost, "/api/v1/provider/transfers/:id/claim", ph(hProviderTransferClaim)},

	{http.MethodPost, "/api/v1/admin/login", hAdminLogin},
	{http.MethodGet, "/api/v1/admin/dashboard", hAdminDashboard},
	{http.MethodGet, "/api/v1/admin/users", hAdminUsers},
	{http.MethodGet, "/api/v1/admin/users/:id", ph(hAdminUserDetail)},
	{http.MethodPost, "/api/v1/admin/user/balance", hAdminUserBalance},
	{http.MethodGet, "/api/v1/admin/admins", hAdminAdmins},
	{http.MethodPost, "/api/v1/admin/admins", hAdminAdminCreate},
	{http.MethodPut, "/api/v1/admin/admins/:id", ph(hAdminAdminUpdate)},
	{http.MethodDelete, "/api/v1/admin/admins/:id", ph(hAdminAdminDelete)},
	{http.MethodPost, "/api/v1/admin/password/forgot", hAdminPasswordForgot},
	{http.MethodGet, "/api/v1/debug/env", hDebugEnv},
	{http.MethodGet, "/api/v1/admin/providers", hAdminProviders},
	{http.MethodGet, "/api/v1/admin/providers/applications", hAdminApplications},
	{http.MethodPut, "/api/v1/admin/providers/:id/approve", ph(hAdminApprove)},
	{http.MethodPut, "/api/v1/admin/providers/:id/update", ph(hAdminProviderUpdate)},
	{http.MethodPut, "/api/v1/admin/providers/:id/status", ph(hAdminProviderStatus)},
	{http.MethodGet, "/api/v1/admin/orders/calls", hAdminCalls},
	{http.MethodGet, "/api/v1/admin/orders/recharge", hAdminRecharge},
	{http.MethodGet, "/api/v1/admin/withdraws", hAdminWithdraws},
	{http.MethodPut, "/api/v1/admin/withdraws/:id", ph(hAdminWithdrawUpdate)},
	{http.MethodGet, "/api/v1/admin/transfers", hAdminTransfers},
	{http.MethodGet, "/api/v1/admin/transfers/:id/query", ph(hAdminTransferQuery)},
	{http.MethodGet, "/api/v1/admin/notifications", hAdminNotifications},
	{http.MethodPost, "/api/v1/admin/notifications", hAdminNotificationCreate},
	{http.MethodPut, "/api/v1/admin/notifications/:id", ph(hAdminNotificationUpdate)},
	{http.MethodDelete, "/api/v1/admin/notifications/:id", ph(hAdminNotificationDelete)},
	{http.MethodGet, "/api/v1/admin/config", hAdminConfig},
	{http.MethodPut, "/api/v1/admin/config", hAdminConfig},
}

func matchPath(pattern, path string) (map[string]string, bool) {
	pp := strings.Split(strings.Trim(pattern, "/"), "/")
	ap := strings.Split(strings.Trim(path, "/"), "/")
	if len(pp) != len(ap) {
		return nil, false
	}
	params := map[string]string{}
	for i := range pp {
		if strings.HasPrefix(pp[i], ":") {
			params[pp[i][1:]] = ap[i]
		} else if pp[i] != ap[i] {
			return nil, false
		}
	}
	return params, true
}

func router(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	path := r.URL.Path
	for _, rt := range routes {
		if rt.method != r.Method {
			continue
		}
		if params, ok := matchPath(rt.pattern, path); ok {
			ctx := context.WithValue(r.Context(), paramsKey, params)
			rt.handler(w, r.WithContext(ctx))
			return
		}
	}
	http.NotFound(w, r)
}

// 管理后台静态文件（零构建，由 Go 直接托管）
func adminFS() http.Handler {
	candidates := []string{
		filepath.Join("..", "admin", "dist"), // 优先：Vue 构建产物
		filepath.Join("admin", "dist"),
		filepath.Join("..", "admin"),
		"admin",
	}
	var root string
	for _, c := range candidates {
		if info, err := os.Stat(c); err == nil && info.IsDir() {
			root = c
			break
		}
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if root == "" {
			http.Error(w, "admin dir not found", 404)
			return
		}
		p := strings.TrimPrefix(r.URL.Path, "/admin/")
		if p == "" || strings.HasSuffix(p, "/") {
			p = "index.html"
		}
		full := filepath.Join(root, filepath.Clean(p))
		// 防目录穿越
		if !strings.HasPrefix(full, filepath.Clean(root)) {
			http.Error(w, "forbidden", 403)
			return
		}
		data, err := os.ReadFile(full)
		ct := contentType(full)
		if err != nil {
			// SPA 回退：返回 index.html 内容，Content-Type 必须按 html 处理
			// （否则用失败路径 full 的扩展名推断会得到 application/octet-stream，浏览器直接下载）
			data, err = os.ReadFile(filepath.Join(root, "index.html"))
			if err != nil {
				http.Error(w, "not found", 404)
				return
			}
			ct = "text/html; charset=utf-8"
		}
		w.Header().Set("Content-Type", ct)
		w.Write(data)
	})
}

func contentType(p string) string {
	switch strings.ToLower(filepath.Ext(p)) {
	case ".html", ".htm":
		return "text/html; charset=utf-8"
	case ".js":
		return "application/javascript; charset=utf-8"
	case ".css":
		return "text/css; charset=utf-8"
	case ".json":
		return "application/json"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".svg":
		return "image/svg+xml"
	default:
		return "application/octet-stream"
	}
}

func main() {
	port := flag.String("port", "8080", "HTTP port")
	flag.Parse()

	loadConfig()
	store = loadStore(dataDir())
	go autoRefundLoop()
	fmt.Printf("Hearcup server started. data=%s\n", store.path)

	mux := http.NewServeMux()
	mux.HandleFunc("/api/", router)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"status":"ok"}`))
	})
	mux.Handle("/admin/", http.StripPrefix("/admin/", adminFS()))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			http.Redirect(w, r, "/admin/", http.StatusFound)
			return
		}
		http.NotFound(w, r)
	})

	addr := ":" + *port
	fmt.Printf("Listening on http://localhost%s  (admin: http://localhost%s/admin/)\n", addr, addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		fmt.Println("server error:", err)
	}
}
