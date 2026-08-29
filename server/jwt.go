package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

var jwtSecret = "hearcup_dev_secret_change_me"

func sha256hex(s string) string {
	h := sha256.Sum256([]byte(s))
	return fmt.Sprintf("%x", h)
}

// 极简 JWT（HS256），仅依赖标准库，MVP 鉴权用
type claims struct {
	UID   int64  `json:"uid"`
	Role  string `json:"role"`  // user | admin
	ARole string `json:"arole"` // 管理员角色：super / operator / finance（仅 admin 有效）
	Exp   int64  `json:"exp"`
}

func genToken(uid int64, role string) (string, error) {
	c := claims{UID: uid, Role: role, Exp: time.Now().Add(7 * 24 * time.Hour).Unix()}
	payload, _ := json.Marshal(c)
	seg := b64url(payload)
	sig := signSeg(seg)
	return seg + "." + sig, nil
}

// 管理员登录专用：token 里携带具体管理员角色（super/operator/finance）
func genAdminToken(uid int64, adminRole string) (string, error) {
	c := claims{UID: uid, Role: "admin", ARole: adminRole, Exp: time.Now().Add(7 * 24 * time.Hour).Unix()}
	payload, _ := json.Marshal(c)
	seg := b64url(payload)
	sig := signSeg(seg)
	return seg + "." + sig, nil
}

func parseToken(tok string) (*claims, error) {
	parts := strings.Split(tok, ".")
	if len(parts) != 2 {
		return nil, fmt.Errorf("bad token")
	}
	if signSeg(parts[0]) != parts[1] {
		return nil, fmt.Errorf("bad signature")
	}
	var c claims
	if err := json.Unmarshal(b64urlDecode(parts[0]), &c); err != nil {
		return nil, err
	}
	if c.Exp < time.Now().Unix() {
		return nil, fmt.Errorf("token expired")
	}
	return &c, nil
}

func signSeg(seg string) string {
	mac := hmac.New(sha256.New, []byte(jwtSecret))
	mac.Write([]byte(seg))
	return b64url(mac.Sum(nil))
}

func b64url(b []byte) string {
	return base64.URLEncoding.EncodeToString(b)
}

func b64urlDecode(s string) []byte {
	b, _ := base64.URLEncoding.DecodeString(s)
	return b
}

func hmacSHA256(key, msg string) []byte {
	mac := hmac.New(sha256.New, []byte(key))
	mac.Write([]byte(msg))
	return mac.Sum(nil)
}
