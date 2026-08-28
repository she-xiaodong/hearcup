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
	{http.MethodGet, "/api/v1/user/balance", hUserBalance},

	{http.MethodGet, "/api/v1/providers/online", hProvidersOnline},
	{http.MethodGet, "/api/v1/providers/:id", ph(hProviderDetail)},

	{http.MethodPost, "/api/v1/call/invite", hCallInvite},
	{http.MethodGet, "/api/v1/call/status/:roomId", ph(hCallStatus)},
	{http.MethodPost, "/api/v1/call/end", hCallEnd},
	{http.MethodPost, "/api/v1/call/rating", hCallRating},
	{http.MethodGet, "/api/v1/call/records", hCallRecords},

	{http.MethodPost, "/api/v1/recharge/create", hRechargeCreate},
	{http.MethodGet, "/api/v1/recharge/records", hRechargeRecords},
	{http.MethodPost, "/api/v1/pay/callback", hWxPayCallback},

	{http.MethodPost, "/api/v1/provider/apply", hProviderApply},
	{http.MethodGet, "/api/v1/provider/status", hProviderStatus},
	{http.MethodPut, "/api/v1/provider/online", hProviderOnline},
	{http.MethodPut, "/api/v1/provider/offline", hProviderOffline},
	{http.MethodGet, "/api/v1/provider/earnings", hProviderEarnings},
	{http.MethodPost, "/api/v1/provider/withdraw", hProviderWithdraw},

	{http.MethodPost, "/api/v1/admin/login", hAdminLogin},
	{http.MethodGet, "/api/v1/admin/dashboard", hAdminDashboard},
	{http.MethodGet, "/api/v1/admin/users", hAdminUsers},
	{http.MethodGet, "/api/v1/debug/env", hDebugEnv},
	{http.MethodGet, "/api/v1/admin/providers", hAdminProviders},
	{http.MethodGet, "/api/v1/admin/providers/applications", hAdminApplications},
	{http.MethodPut, "/api/v1/admin/providers/:id/approve", ph(hAdminApprove)},
	{http.MethodPut, "/api/v1/admin/providers/:id/status", ph(hAdminProviderStatus)},
	{http.MethodGet, "/api/v1/admin/orders/calls", hAdminCalls},
	{http.MethodGet, "/api/v1/admin/orders/recharge", hAdminRecharge},
	{http.MethodGet, "/api/v1/admin/withdraws", hAdminWithdraws},
	{http.MethodPut, "/api/v1/admin/withdraws/:id", ph(hAdminWithdrawUpdate)},
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
	candidates := []string{"../admin", "admin", filepath.Join("..", "admin")}
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
		if err != nil {
			// SPA 回退
			data, err = os.ReadFile(filepath.Join(root, "index.html"))
			if err != nil {
				http.Error(w, "not found", 404)
				return
			}
		}
		w.Header().Set("Content-Type", contentType(full))
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
