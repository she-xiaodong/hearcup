package main

import (
	"bytes"
	"compress/zlib"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"time"
)

// TRTC / 微信 等外部依赖配置统一走 config.go 的 appCfg（环境变量注入）。

// ---------- 基础工具 ----------

func readJSON(r *http.Request, v interface{}) error {
	b, err := io.ReadAll(r.Body)
	if err != nil {
		return err
	}
	if len(b) == 0 {
		return nil
	}
	return json.Unmarshal(b, v)
}

func sendOK(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"code": 0, "data": data})
}

func fail(w http.ResponseWriter, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"code": 1, "msg": msg})
}

// respList 统一分页+返回格式：对已经过 keyword 过滤的全量切片 full，
// 按 page/page_size 截取，返回 {list, total, page, page_size}（前端 el-pagination 直接用）。
func respList(w http.ResponseWriter, full interface{}, r *http.Request) {
	rv := reflect.ValueOf(full)
	if rv.Kind() != reflect.Slice {
		sendOK(w, full)
		return
	}
	total := rv.Len()
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	ps, _ := strconv.Atoi(r.URL.Query().Get("page_size"))
	if ps < 1 || ps > 200 {
		ps = 20
	}
	start := (page - 1) * ps
	if start > total {
		start = total
	}
	end := start + ps
	if end > total {
		end = total
	}
	sendOK(w, map[string]interface{}{
		"list":      rv.Slice(start, end).Interface(),
		"total":     total,
		"page":      page,
		"page_size": ps,
	})
}

func getClaims(r *http.Request) (*claims, bool) {
	auth := r.Header.Get("Authorization")
	auth = strings.TrimPrefix(auth, "Bearer ")
	auth = strings.TrimSpace(auth)
	if auth == "" {
		return nil, false
	}
	c, err := parseToken(auth)
	if err != nil {
		return nil, false
	}
	return c, true
}

// maskPhone 隐藏手机号中间4位（隐私保护）
func maskPhone(phone string) string {
	if len(phone) != 11 {
		return phone
	}
	return phone[:3] + "****" + phone[7:]
}

func requireUser(r *http.Request) (int64, bool) {
	c, ok := getClaims(r)
	if !ok || c.Role != "user" {
		return 0, false
	}
	return c.UID, true
}

func requireAdmin(r *http.Request) (int64, bool) {
	c, ok := getClaims(r)
	if !ok || c.Role != "admin" {
		return 0, false
	}
	return c.UID, true
}

// 返回管理员角色（super/operator/finance）；非管理员或旧 token 无角色时返回空/默认 super
func adminRoleOf(r *http.Request) string {
	c, ok := getClaims(r)
	if !ok || c.Role != "admin" {
		return ""
	}
	if c.ARole == "" {
		return "super" // 兼容旧 token，默认视为超级管理员
	}
	return c.ARole
}

func requireSuper(r *http.Request) bool {
	return adminRoleOf(r) == "super"
}

func decorateProvider(p *Provider) *Provider {
	cp := *p
	if u, ok := store.db.Users[p.UserID]; ok {
		cp.Nickname = u.Nickname
		cp.Avatar = u.Avatar
		cp.HNo = u.HNo
	}
	// 15分钟档起价（元）：优先取配置档位里最小的分钟数，缺失则按单价×15 兜底。
	// 用户端「XX H币起」统一以此口径换算，避免列表价与详情首档不一致。
	cp.Tier15 = tier15Price(p)
	return &cp
}

// tier15Price 取 15 分钟档（或配置里最小的档位）价格（元）
func tier15Price(p *Provider) float64 {
	if p.PriceTiers != "" {
		m := map[string]float64{}
		if err := json.Unmarshal([]byte(p.PriceTiers), &m); err == nil && len(m) > 0 {
			var bestMin int64 = 1 << 40
			var best float64
			for k, v := range m {
				mi, err := strconv.ParseInt(k, 10, 64)
				if err != nil || mi <= 0 {
					continue
				}
				if mi < bestMin {
					bestMin = mi
					best = v
				}
			}
			if bestMin != 1<<40 {
				return round2(best)
			}
		}
	}
	// 无档位配置：按单价 × 15 分钟
	return round2(p.PricePerMinute * 15)
}

// ---------- 认证 ----------

func hAuthLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Code string `json:"code"`
	}
	readJSON(r, &body)
	if body.Code == "" {
		fail(w, "缺少 code")
		return
	}
	openid := body.Code
	unionid := ""
	// 真实微信登录：配置了 appid 且 code 不是 mock 前缀时，走 jscode2session 换 openid
	if appCfg.WXAppID != "" && !strings.HasPrefix(body.Code, "openid_") {
		wxOpenid, _, wxUnionid, err := wechatCode2Session(body.Code)
		if err != nil {
			fail(w, "微信登录失败: "+err.Error())
			return
		}
		openid = wxOpenid
		unionid = wxUnionid
	} else {
		if !strings.HasPrefix(openid, "openid_") {
			openid = "openid_" + body.Code
		}
	}
	store.mu.Lock()
	var uid int64
	for _, u := range store.db.Users {
		if u.Openid == openid {
			uid = u.ID
			break
		}
	}
	if uid == 0 {
		store.db.SeqUser++
		hNo := store.generateHNo()
		u := &User{ID: store.db.SeqUser, Openid: openid, Unionid: unionid, HNo: hNo, Nickname: "用户" + hNo, Balance: 0, Status: 1, CreatedAt: now(), UpdatedAt: now()}
		store.db.Users[u.ID] = u
		uid = u.ID
	} else if unionid != "" {
		store.db.Users[uid].Unionid = unionid
	}
	tok, _ := genToken(uid, "user")
	userCopy := *store.db.Users[uid]
	store.save()
	// 提前解锁：IM 账号开通涉及网络 IO，绝不能放在锁内（会阻塞所有请求）
	store.mu.Unlock()

	// 锁外：确保该用户在腾讯云 IM 中有可用账号，并同步昵称/头像（失败不阻断登录）
	imEnsureAccount(uid, userCopy.Nickname, userCopy.Avatar)

	sendOK(w, map[string]interface{}{
		"token": tok, "user": userCopy,
		"free_call": appCfg.FreeCall, // 免费通话模式标记：true 时前端跳过余额校验
	})
}

func hUserProfile(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(r)
	if !ok {
		fail(w, "未登录")
		return
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	sendOK(w, store.db.Users[uid])
}

// 更新昵称 / 头像（头像为 base64 data URI，用户点头像经 chooseAvatar 获取）
func hUserUpdateProfile(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(r)
	if !ok {
		fail(w, "未登录")
		return
	}
	var body struct {
		Nickname string `json:"nickname"`
		Avatar   string `json:"avatar"`
	}
	readJSON(r, &body)
	store.mu.Lock()
	defer store.mu.Unlock()
	u := store.db.Users[uid]
	if body.Nickname != "" {
		u.Nickname = strings.TrimSpace(body.Nickname)
		if len([]rune(u.Nickname)) > 20 {
			u.Nickname = string([]rune(u.Nickname)[:20])
		}
	}
	if body.Avatar != "" {
		u.Avatar = body.Avatar
	}
	u.UpdatedAt = now()
	store.save()
	sendOK(w, store.db.Users[uid])
}

// 意见反馈
func hFeedback(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(r)
	if !ok {
		fail(w, "未登录")
		return
	}
	var body struct {
		Content string `json:"content"`
		Contact string `json:"contact"`
	}
	readJSON(r, &body)
	if strings.TrimSpace(body.Content) == "" {
		fail(w, "请填写反馈内容")
		return
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	store.db.SeqFeedback++
	fb := &Feedback{
		ID: store.db.SeqFeedback, UserID: uid,
		Content: strings.TrimSpace(body.Content), Contact: strings.TrimSpace(body.Contact),
		CreatedAt: now(),
	}
	store.db.Feedbacks[fb.ID] = fb
	store.save()
	sendOK(w, map[string]interface{}{"id": fb.ID, "msg": "已收到你的反馈，谢谢！"})
}

func hUserBalance(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(r)
	if !ok {
		fail(w, "未登录")
		return
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	u := store.db.Users[uid]
	sendOK(w, map[string]interface{}{
		"balance": u.Balance, "frozen_balance": u.Frozen,
		"coin_rate": coinRate(), "coin_name": coinName(),
		"balance_coins": round2(u.Balance * coinRate()),
	})
}

// 虚拟币换算（1元 = coin_rate 个 H币）
func coinRate() float64 {
	if store.db.Config.CoinRate > 0 {
		return store.db.Config.CoinRate
	}
	return 10
}

func coinName() string {
	if store.db.Config.CoinName != "" {
		return store.db.Config.CoinName
	}
	return "H币"
}

func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

// fmtCoins 把虚拟币数量格式化成不带多余小数的字符串（150 → "150"，150.5 → "150.5"）
func fmtCoins(v float64) string {
	r := round2(v)
	if r == math.Trunc(r) {
		return strconv.FormatFloat(r, 'f', 0, 64)
	}
	return strconv.FormatFloat(r, 'f', -1, 64)
}

// ---------- 服务者（用户端）----------

func hProvidersOnline(w http.ResponseWriter, r *http.Request) {
	role := r.URL.Query().Get("role")
	store.mu.Lock()
	defer store.mu.Unlock()
	list := []*Provider{}
	for _, p := range store.db.Providers {
		if p.Status != 1 || p.IsOnline != 1 {
			continue
		}
		if role == "1" && p.Role != 1 {
			continue
		}
		if role == "2" && p.Role != 2 {
			continue
		}
		list = append(list, decorateProvider(p))
	}
	sort.Slice(list, func(i, j int) bool {
		if list[i].Rating != list[j].Rating {
			return list[i].Rating > list[j].Rating
		}
		if list[i].TotalSessions != list[j].TotalSessions {
			return list[i].TotalSessions > list[j].TotalSessions
		}
		return list[i].Level > list[j].Level
	})
	sendOK(w, map[string]interface{}{"total": len(list), "list": list})
}

// GET /api/v1/providers/all —— 返回所有已通过审核的倾听者（含离线），在线优先排序，供首页展示状态
func hProvidersAll(w http.ResponseWriter, r *http.Request) {
	store.mu.Lock()
	defer store.mu.Unlock()
	list := []*Provider{}
	for _, p := range store.db.Providers {
		if p.Status != 1 {
			continue
		}
		list = append(list, decorateProvider(p))
	}
	sort.Slice(list, func(i, j int) bool {
		if list[i].IsOnline != list[j].IsOnline {
			return list[i].IsOnline > list[j].IsOnline
		}
		if list[i].Rating != list[j].Rating {
			return list[i].Rating > list[j].Rating
		}
		if list[i].TotalSessions != list[j].TotalSessions {
			return list[i].TotalSessions > list[j].TotalSessions
		}
		return list[i].Level > list[j].Level
	})
	sendOK(w, map[string]interface{}{"total": len(list), "list": list})
}

func hProviderDetail(w http.ResponseWriter, r *http.Request, params map[string]string) {
	id, _ := strconv.ParseInt(params["id"], 10, 64)
	store.mu.Lock()
	defer store.mu.Unlock()
	p, ok := store.db.Providers[id]
	if !ok {
		fail(w, "服务者不存在")
		return
	}
	dp := decorateProvider(p)
	// 解析价格档位
	priceTiers := map[string]float64{}
	if p.PriceTiers != "" {
		_ = json.Unmarshal([]byte(p.PriceTiers), &priceTiers)
	}
	// 历史评价
	ratings := []map[string]interface{}{}
	for _, c := range store.db.Calls {
		if c.ProviderID == id && c.UserRating > 0 {
			ratings = append(ratings, map[string]interface{}{
				"rating": c.UserRating, "comment": c.UserComment, "user_name": store.db.Users[c.UserID].Nickname,
			})
		}
	}
	// 价格档位同时给出 H币口径，前端直接展示 H币（内部仍按元记账）
	tiersCoins := map[string]float64{}
	for k, v := range priceTiers {
		tiersCoins[k] = round2(v * coinRate())
	}
	sendOK(w, map[string]interface{}{
		"provider":               dp,
		"price_tiers":            priceTiers,
		"price_tiers_coins":      tiersCoins,
		"price_per_minute_coins": round2(p.PricePerMinute * coinRate()),
		"coin_rate":              coinRate(),
		"coin_name":              coinName(),
		"ratings":                ratings,
	})
}

// ---------- 呼叫（核心）----------

// validPackageMinutes 允许的套餐时长档位（分钟）
var validPackageMinutes = map[int]bool{15: true, 30: true, 45: true, 60: true, 75: true, 90: true, 105: true, 120: true}

// packageAmount 计算套餐价：优先取倾听师自定义档位，未配置则按单价×时长
func packageAmount(p *Provider, minutes int) float64 {
	tiers := map[string]float64{}
	if p.PriceTiers != "" {
		_ = json.Unmarshal([]byte(p.PriceTiers), &tiers)
	}
	if v, ok := tiers[strconv.Itoa(minutes)]; ok && v > 0 {
		return v
	}
	return round2(float64(minutes) * p.PricePerMinute)
}

// hCallInvite 只「下单」，不扣费也不拨号。
// 新流程：选时长 → 下单 → 支付（/api/v1/call/pay）→ 确认（/api/v1/call/confirm）→ 才拿到号码拨号。
func hCallInvite(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(r)
	if !ok {
		fail(w, "未登录")
		return
	}
	var body struct {
		ProviderID int64 `json:"provider_id"`
		Minutes    int   `json:"minutes"` // 套餐时长：15/30/45/60/75/90/105/120
	}
	readJSON(r, &body)
	if !validPackageMinutes[body.Minutes] {
		fail(w, "时长档位无效")
		return
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	p, ok := store.db.Providers[body.ProviderID]
	if !ok || p.Status != 1 {
		fail(w, "服务者不存在或未通过审核")
		return
	}
	if p.UserID == uid {
		fail(w, "不能呼叫自己")
		return
	}
	if p.IsBusy == 1 {
		fail(w, "对方正在通话中")
		return
	}
	amount := packageAmount(p, body.Minutes)
	unitPrice := round2(amount / float64(body.Minutes))

	store.db.SeqCall++
	seq := store.db.SeqCall
	roomID := fmt.Sprintf("call_%d_%d", now(), body.ProviderID)
	orderNo := fmt.Sprintf("CO%d%03d", now(), seq)
	rec := &CallRecord{
		ID: seq, UserID: uid, ProviderID: body.ProviderID, RoomID: roomID,
		CallType: 1, StartTime: 0, // 支付确认后才开始计时
		UnitPrice: unitPrice, Amount: amount,
		OrderNo: orderNo, PayStatus: 0, PackageMinutes: body.Minutes,
		Status: 0, CreatedAt: now(), UpdatedAt: now(),
	}
	store.db.Calls[rec.ID] = rec
	store.save()
	sendOK(w, map[string]interface{}{
		"call_id":    seq,
		"order_no":   orderNo,
		"room_id":    roomID,
		"minutes":    body.Minutes,
		"amount":     amount,
		"unit_price": unitPrice,
		"pay_status": 0,
		// H币口径（内部按元记账，对外统一以 H币 展示）
		"amount_coins":     round2(amount * coinRate()),
		"unit_price_coins": round2(unitPrice * coinRate()),
		"coin_rate":        coinRate(),
		"coin_name":        coinName(),
		"balance":          store.db.Users[uid].Balance,
		"balance_coins":    round2(store.db.Users[uid].Balance * coinRate()),
		"provider": map[string]interface{}{
			"id": p.ID, "real_name": p.RealName, "nickname": p.Nickname, "avatar": p.Avatar,
		},
	})
}

// hCallPay 订单支付。pay_type: balance=余额扣款；wxpay=微信支付下单。
// 余额不足时返回 need_recharge=true，前端引导去充值。
func hCallPay(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(r)
	if !ok {
		fail(w, "未登录")
		return
	}
	var body struct {
		CallID  int64  `json:"call_id"`
		PayType string `json:"pay_type"` // balance | wxpay
	}
	readJSON(r, &body)
	if body.PayType == "" {
		body.PayType = "wxpay"
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	rec, ok := store.db.Calls[body.CallID]
	if !ok {
		fail(w, "订单不存在")
		return
	}
	if rec.UserID != uid {
		fail(w, "无权操作")
		return
	}
	if rec.PayStatus == 1 {
		sendOK(w, map[string]interface{}{"paid": true, "need_pay": false, "call_id": rec.ID})
		return
	}
	if rec.Status == 1 {
		fail(w, "订单已结束")
		return
	}
	u := store.db.Users[uid]

	// 余额支付：扣的是账户余额（内部按元记账，对外以 H币 展示）
	if body.PayType == "balance" {
		if u.Balance < rec.Amount {
			lack := round2(rec.Amount - u.Balance)
			sendOK(w, map[string]interface{}{
				"paid": false, "need_recharge": true,
				"amount": rec.Amount, "balance": u.Balance,
				"amount_coins":  round2(rec.Amount * coinRate()),
				"balance_coins": round2(u.Balance * coinRate()),
				"lack":          lack,
				"lack_coins":    round2(lack * coinRate()),
				"coin_rate":     coinRate(),
				"coin_name":     coinName(),
				"msg": fmt.Sprintf("余额不足，需 %s %s，当前 %s %s",
					fmtCoins(rec.Amount*coinRate()), coinName(),
					fmtCoins(u.Balance*coinRate()), coinName()),
			})
			return
		}
		u.Balance -= rec.Amount
		rec.PayStatus = 1
		rec.PayTime = now()
		rec.UpdatedAt = now()
		store.save()
		sendOK(w, map[string]interface{}{
			"paid": true, "need_pay": false, "call_id": rec.ID,
			"balance": u.Balance, "balance_coins": round2(u.Balance * coinRate()),
			"amount": rec.Amount, "amount_coins": round2(rec.Amount * coinRate()),
			"coin_rate": coinRate(), "coin_name": coinName(),
		})
		return
	}

	// 微信支付下单（未配置商户号或 mock 用户时直接免单入账，保证链路可跑通）
	if appCfg.WXPayMchID == "" || appCfg.WXAppID == "" || strings.HasPrefix(u.Openid, "openid_") {
		rec.PayStatus = 1
		rec.PayTime = now()
		rec.UpdatedAt = now()
		store.save()
		sendOK(w, map[string]interface{}{"paid": true, "need_pay": false, "call_id": rec.ID})
		return
	}
	payParams, err := createWxPayOrder(u.Openid, rec.OrderNo, rec.Amount)
	if err != nil {
		fmt.Println("[pay] 通话订单下单失败:", err)
		fail(w, "微信下单失败: "+err.Error())
		return
	}
	store.save()
	sendOK(w, map[string]interface{}{
		"paid": false, "need_pay": true, "call_id": rec.ID,
		"order_no": rec.OrderNo, "amount": rec.Amount, "pay_params": payParams,
	})
}

// callInviteTimeout 呼叫邀请超时时间（秒）。
const callInviteTimeout = 60

// hCallConfirmPay 支付成功后的确认：校验已支付 → 开始计时 → 返回双方手机号（此时才允许拨号）
func hCallConfirmPay(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(r)
	if !ok {
		fail(w, "未登录")
		return
	}
	var body struct {
		CallID int64 `json:"call_id"`
	}
	readJSON(r, &body)

	store.mu.Lock()
	defer store.mu.Unlock()
	rec, ok := store.db.Calls[body.CallID]
	if !ok {
		fail(w, "订单不存在")
		return
	}
	if rec.UserID != uid {
		fail(w, "无权操作")
		return
	}
	// 免费通话模式（FreeCall）下允许跳过支付；其余必须先支付
	if rec.PayStatus != 1 && !appCfg.FreeCall {
		fail(w, "订单未支付，请先完成支付")
		return
	}
	if rec.Status == 1 {
		fail(w, "订单已结束")
		return
	}
	if rec.StartTime == 0 {
		rec.StartTime = now()
		rec.UpdatedAt = now()
	}
	p := store.db.Providers[rec.ProviderID]
	u := store.db.Users[uid]

	// 获取双方手机号（用于直接拨号方案）
	callerPhone := maskPhone(u.Phone)
	calleePhone := maskPhone(p.Phone)

	store.save()
	sendOK(w, map[string]interface{}{
		"room_id":             rec.RoomID,
		"call_id":             rec.ID,
		"caller_phone":        u.Phone,
		"callee_phone":        p.Phone,
		"caller_phone_masked": callerPhone,
		"callee_phone_masked": calleePhone,
		"caller_nickname":     u.Nickname,
		"callee_nickname":     p.RealName,
		"caller_avatar":       u.Avatar,
		"callee_avatar":       p.Avatar,
		"minutes":             rec.PackageMinutes,
		"amount":              rec.Amount,
		// H币口径
		"amount_coins":     round2(rec.Amount * coinRate()),
		"unit_price_coins": round2(rec.UnitPrice * coinRate()),
		"coin_rate":        coinRate(),
		"coin_name":        coinName(),
		"unit_price":       rec.UnitPrice,
	})
}

// ---------- 呼叫结果回调（接听 / 拒接 / 取消 / 超时未接）----------

// hCallResult 统一处理呼叫终态：释放被叫忙碌态、未接通时解冻主叫余额。
// 由前端在 TUICallKit 回调（onCallEnd / onCallNotConnected / 超时）时上报。
func hCallResult(w http.ResponseWriter, r *http.Request, kind string) {
	uid, ok := requireUser(r)
	if !ok {
		fail(w, "未登录")
		return
	}
	var b struct {
		RoomID string `json:"room_id"`
		CallID int64  `json:"call_id"`
	}
	readJSON(r, &b)

	nickname := ""
	store.mu.Lock()
	var rec *CallRecord
	if b.CallID > 0 {
		rec = store.db.Calls[b.CallID]
	}
	if rec == nil && b.RoomID != "" {
		for _, c := range store.db.Calls {
			if c.RoomID == b.RoomID {
				rec = c
				break
			}
		}
	}
	if rec == nil {
		store.mu.Unlock()
		fail(w, "通话不存在")
		return
	}
	// 仅主叫或被叫本人可上报结果
	if rec.UserID != uid && !userOwnsProvider(uid, rec.ProviderID) {
		store.mu.Unlock()
		fail(w, "无权操作")
		return
	}

	// 未被接听的终态：解冻主叫余额 + 释放被叫忙碌（免费模式无冻结，跳过解冻）
	if kind == "reject" || kind == "cancel" || kind == "miss" {
		if rec.Status == 0 {
			u := store.db.Users[rec.UserID]
			if u != nil && !appCfg.FreeCall && u.Frozen >= store.db.Config.MinBalance {
				u.Frozen -= store.db.Config.MinBalance
				u.Balance += store.db.Config.MinBalance
			}
			rec.Status = 2 // 2=未接通
		}
		if p := store.db.Providers[rec.ProviderID]; p != nil {
			p.IsBusy = 0
		}
		nickname = store.db.Users[rec.UserID].Nickname
	}
	rec.UpdatedAt = now()
	store.save()
	store.mu.Unlock()

	// 超时未接：给倾听者补发通知，避免其完全无感知（网络 IO，放在锁外）
	// 双通道：IM 离线推送（实时）+ 订阅消息（小程序被回收时的兜底）
	if kind == "miss" {
		if p := getProviderNoLock(rec.ProviderID); p != nil {
			imSendMissedCall(p.UserID, nickname, rec.CallType)
			sendMissedCallSubscribe(p.UserID, nickname, rec.CallType, rec.RoomID)
		}
	}
	sendOK(w, map[string]interface{}{"result": kind, "room_id": rec.RoomID})
}

func hCallAccept(w http.ResponseWriter, r *http.Request) { hCallResult(w, r, "accept") }
func hCallReject(w http.ResponseWriter, r *http.Request) { hCallResult(w, r, "reject") }
func hCallCancel(w http.ResponseWriter, r *http.Request) { hCallResult(w, r, "cancel") }
func hCallMiss(w http.ResponseWriter, r *http.Request)   { hCallResult(w, r, "miss") }

// userOwnsProvider 判断该用户是否是此服务者账号的持有者
func userOwnsProvider(uid, providerID int64) bool {
	p, ok := store.db.Providers[providerID]
	return ok && p.UserID == uid
}

// getProviderNoLock 在不持锁的场景下安全读取 provider 快照（仅用于触发外部 IO）
func getProviderNoLock(providerID int64) *Provider {
	store.mu.Lock()
	defer store.mu.Unlock()
	if p, ok := store.db.Providers[providerID]; ok {
		cp := *p
		return &cp
	}
	return nil
}

func hCallStatus(w http.ResponseWriter, r *http.Request, params map[string]string) {
	roomID := params["roomId"]
	store.mu.Lock()
	defer store.mu.Unlock()
	for _, c := range store.db.Calls {
		if c.RoomID == roomID {
			sendOK(w, map[string]interface{}{"status": c.Status, "amount": c.Amount, "duration": c.Duration})
			return
		}
	}
	fail(w, "通话不存在")
}

// 计费核心：向上取整分钟、单价、平台抽成、冻结结算、透支保护
func hCallEnd(w http.ResponseWriter, r *http.Request) {
	_, ok := requireUser(r)
	if !ok {
		fail(w, "未登录")
		return
	}
	var body struct {
		RoomID string `json:"room_id"`
	}
	readJSON(r, &body)
	store.mu.Lock()
	defer store.mu.Unlock()
	var rec *CallRecord
	for _, c := range store.db.Calls {
		if c.RoomID == body.RoomID {
			rec = c
			break
		}
	}
	if rec == nil {
		fail(w, "通话不存在")
		return
	}
	if rec.Status == 1 {
		sendOK(w, map[string]interface{}{"amount": rec.Amount})
		return
	}
	u := store.db.Users[rec.UserID]
	p := store.db.Providers[rec.ProviderID]
	endT := now()
	duration := int(endT - rec.StartTime)
	if duration < 0 {
		duration = 0
	}
	minutes := duration / 60
	if duration%60 > 0 {
		minutes++ // 向上取整
	}
	if minutes < 1 && duration > 0 {
		minutes = 1
	}
	amount := float64(minutes) * rec.UnitPrice
	platformFee := amount * store.db.Config.PlatformRate
	providerIncome := amount - platformFee

	if appCfg.FreeCall {
		// 免费通话模式：不扣费、不动余额，金额记 0（支付被限制时先跑通通话）
		amount = 0
		platformFee = 0
		providerIncome = 0
	} else {
		// 结算冻结余额
		frozenUsed := store.db.Config.MinBalance
		if amount <= frozenUsed {
			// 退回冻结差额
			u.Frozen -= frozenUsed
			u.Balance += (frozenUsed - amount)
		} else {
			u.Frozen -= frozenUsed
			diff := amount - frozenUsed
			u.Balance -= diff
			if u.Balance < -store.db.Config.Overdraft {
				u.Balance = -store.db.Config.Overdraft // 透支保护
			}
		}
	}
	// 服务者收益
	p.Withdrawable += providerIncome
	p.TotalEarnings += providerIncome
	p.TotalSessions++
	p.IsBusy = 0
	p.TodaySessions++

	rec.EndTime = endT
	rec.Duration = duration
	rec.Amount = amount
	rec.ProviderIncome = providerIncome
	rec.PlatformFee = platformFee
	rec.Status = 1
	rec.UpdatedAt = endT
	store.save()
	sendOK(w, map[string]interface{}{
		"duration": duration, "minutes": minutes, "amount": amount,
		"provider_income": providerIncome, "platform_fee": platformFee, "balance": u.Balance,
	})
}

// 电话拨号方案：前端上报通话时长并结算（避免依赖 TUICallKit）
func hCallEndWithMinutes(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(r)
	if !ok {
		fail(w, "未登录")
		return
	}
	var body struct {
		RoomID  string `json:"room_id"`
		CallID  int64  `json:"call_id"`
		Minutes int    `json:"minutes"` // 前端上报的时长（分钟）
	}
	readJSON(r, &body)

	store.mu.Lock()
	defer store.mu.Unlock()

	var rec *CallRecord
	if body.CallID > 0 {
		rec = store.db.Calls[body.CallID]
	}
	if rec == nil && body.RoomID != "" {
		for _, c := range store.db.Calls {
			if c.RoomID == body.RoomID {
				rec = c
				break
			}
		}
	}
	if rec == nil {
		fail(w, "通话不存在")
		return
	}

	// 仅主叫或被叫本人可结束通话
	if rec.UserID != uid && !userOwnsProvider(uid, rec.ProviderID) {
		fail(w, "无权操作")
		return
	}

	if rec.Status == 1 {
		sendOK(w, map[string]interface{}{"amount": rec.Amount})
		return
	}

	u := store.db.Users[rec.UserID]
	p := store.db.Providers[rec.ProviderID]

	// 使用前端上报的时长（最少1分钟）
	minutes := body.Minutes
	if minutes < 1 {
		minutes = 1
	}
	duration := minutes * 60 // 转换为秒

	// 套餐预付制：已付金额 = 套餐价；实际通话超出套餐时按单价补扣超出部分
	packMinutes := rec.PackageMinutes
	if packMinutes <= 0 {
		packMinutes = int(rec.Amount / rec.UnitPrice)
	}
	amount := rec.Amount
	extra := 0.0
	if minutes > packMinutes {
		extra = round2(float64(minutes-packMinutes) * rec.UnitPrice)
		amount = round2(amount + extra)
	}
	platformFee := round2(amount * store.db.Config.PlatformRate)
	providerIncome := round2(amount - platformFee)

	if appCfg.FreeCall {
		// 免费通话模式：不扣费、不动余额，金额记 0
		amount = 0
		platformFee = 0
		providerIncome = 0
	} else if extra > 0 {
		// 超出套餐：从余额补扣（允许小额透支，按配置兜底）
		u.Balance -= extra
		if u.Balance < -store.db.Config.Overdraft {
			u.Balance = -store.db.Config.Overdraft
		}
	}

	// 服务者收益
	p.Withdrawable += providerIncome
	p.TotalEarnings += providerIncome
	p.TotalSessions++
	p.IsBusy = 0
	p.TodaySessions++

	rec.EndTime = now()
	rec.Duration = duration
	rec.Amount = amount
	rec.ProviderIncome = providerIncome
	rec.PlatformFee = platformFee
	rec.Status = 1
	rec.UpdatedAt = now()
	store.save()

	sendOK(w, map[string]interface{}{
		"duration": duration, "minutes": minutes, "amount": amount,
		"extra": extra, "package_minutes": packMinutes,
		"provider_income": providerIncome, "platform_fee": platformFee, "balance": u.Balance,
		// H币口径（内部按元结算，对外统一 H币）
		"amount_coins":  round2(amount * coinRate()),
		"extra_coins":   round2(extra * coinRate()),
		"balance_coins": round2(u.Balance * coinRate()),
		"coin_rate":     coinRate(),
		"coin_name":     coinName(),
	})
}

func hCallRating(w http.ResponseWriter, r *http.Request) {
	_, ok := requireUser(r)
	if !ok {
		fail(w, "未登录")
		return
	}
	var body struct {
		RoomID  string `json:"room_id"`
		Rating  int    `json:"rating"`
		Comment string `json:"comment"`
	}
	readJSON(r, &body)
	store.mu.Lock()
	defer store.mu.Unlock()
	for _, c := range store.db.Calls {
		if c.RoomID == body.RoomID {
			c.UserRating = body.Rating
			c.UserComment = body.Comment
			c.UpdatedAt = now()
			// 更新服务者评分（简单均值）
			p := store.db.Providers[c.ProviderID]
			if p != nil && body.Rating > 0 {
				p.Rating = (p.Rating*float64(p.TotalSessions-1) + float64(body.Rating)) / float64(p.TotalSessions)
			}
			store.save()
			sendOK(w, map[string]interface{}{"ok": true})
			return
		}
	}
	fail(w, "通话不存在")
}

func hCallRecords(w http.ResponseWriter, r *http.Request) {
	_, ok := requireUser(r)
	if !ok {
		fail(w, "未登录")
		return
	}
	uidStr := r.URL.Query().Get("user_id")
	pidStr := r.URL.Query().Get("provider_id")
	store.mu.Lock()
	defer store.mu.Unlock()
	list := []map[string]interface{}{}
	for _, c := range store.db.Calls {
		if uidStr != "" && strconv.FormatInt(c.UserID, 10) != uidStr {
			continue
		}
		if pidStr != "" && strconv.FormatInt(c.ProviderID, 10) != pidStr {
			continue
		}
		list = append(list, map[string]interface{}{
			"id": c.ID, "room_id": c.RoomID, "call_type": c.CallType,
			"duration": c.Duration, "amount": c.Amount, "status": c.Status,
			"user_rating": c.UserRating, "user_comment": c.UserComment,
			"provider_name": store.db.Providers[c.ProviderID].RealName,
			"user_name":     store.db.Users[c.UserID].Nickname, "created_at": c.CreatedAt,
		})
	}
	sendOK(w, list)
}

// ---------- 充值 ----------

func hRechargeCreate(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(r)
	if !ok {
		fail(w, "未登录")
		return
	}
	var body struct {
		Amount float64 `json:"amount"`
	}
	readJSON(r, &body)
	if body.Amount < 10 {
		fail(w, "充值金额不得低于 10 元")
		return
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	store.db.SeqRecharge++
	orderNo := fmt.Sprintf("RC%d%03d", now(), store.db.SeqRecharge)
	order := &RechargeOrder{
		ID: store.db.SeqRecharge, UserID: uid, OrderNo: orderNo,
		Amount: body.Amount, PayStatus: 0, CreatedAt: now(), UpdatedAt: now(),
	}
	store.db.Recharges[order.ID] = order
	u := store.db.Users[uid]
	// 真实微信支付：仅对「真实微信 openid」发起下单；mock 用户（openid_ 前缀）走演示入账，
	// 既保证本地 e2e 不被真实支付打断，又对真实用户走完整支付链路。
	if appCfg.WXPayMchID != "" && appCfg.WXAppID != "" && !strings.HasPrefix(u.Openid, "openid_") {
		fmt.Println("[pay] 发起微信下单 openid=", u.Openid, " order=", orderNo, " amount=", body.Amount)
		payParams, err := createWxPayOrder(u.Openid, orderNo, body.Amount)
		if err != nil {
			fmt.Println("[pay] 下单失败:", err)
			fail(w, "微信下单失败: "+err.Error())
			return
		}
		fmt.Println("[pay] 下单成功 package=", payParams["package"])
		store.save()
		sendOK(w, map[string]interface{}{
			"order_no": orderNo, "amount": body.Amount,
			"coins": round2(body.Amount * coinRate()), "coin_name": coinName(),
			"need_pay": true, "pay_params": payParams,
		})
		return
	}
	// MVP 模拟入账
	order.PayStatus = 1
	order.TransactionID = fmt.Sprintf("TXN%d", now())
	order.PayTime = now()
	if u.Balance < 0 {
		owe := -u.Balance
		if body.Amount >= owe {
			u.Balance = body.Amount - owe
		} else {
			u.Balance = -(owe - body.Amount)
		}
	} else {
		u.Balance += body.Amount
	}
	store.save()
	sendOK(w, map[string]interface{}{
		"id": order.ID, "order_no": orderNo, "amount": body.Amount,
		"coins": round2(body.Amount * coinRate()), "coin_name": coinName(),
		"pay_status": order.PayStatus, "pay_time": order.PayTime,
	})
}

func hRechargeRecords(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(r)
	if !ok {
		fail(w, "未登录")
		return
	}
	uidStr := r.URL.Query().Get("user_id")
	if uidStr == "" {
		uidStr = strconv.FormatInt(uid, 10)
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	list := []map[string]interface{}{}
	for _, o := range store.db.Recharges {
		if strconv.FormatInt(o.UserID, 10) != uidStr {
			continue
		}
		list = append(list, map[string]interface{}{
			"order_no": o.OrderNo, "amount": o.Amount, "pay_status": o.PayStatus, "pay_time": o.PayTime,
		})
	}
	sendOK(w, list)
}

// ---------- 服务者（服务者端）----------

func hProviderApply(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(r)
	if !ok {
		fail(w, "未登录")
		return
	}
	var body struct {
		RealName         string `json:"real_name"`
		Gender           int    `json:"gender"`
		Age              int    `json:"age"`
		City             string `json:"city"`
		Education        string `json:"education"`
		Major            string `json:"major"`
		IDCard           string `json:"id_card"`
		Phone            string `json:"phone"`
		Intro            string `json:"intro"`
		Expertise        string `json:"expertise"`
		Certificates     string `json:"certificates"`
		TrainingProof    string `json:"training_proof"`
		CertificateNo    string `json:"certificate_no"`
		CertificateImage string `json:"certificate_image"`
		EducationImage   string `json:"education_image"`
		CounselorImage   string `json:"counselor_image"`
		YearsOfExp       int    `json:"years_of_exp"`
		ConsultHours     int    `json:"consult_hours"`
		Background       string `json:"background"`
	}
	readJSON(r, &body)
	if body.RealName == "" || body.Phone == "" || body.IDCard == "" || body.Intro == "" || body.Expertise == "" {
		fail(w, "必填项缺失")
		return
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	// 复用已有申请
	for _, p := range store.db.Providers {
		if p.UserID == uid {
			fail(w, "已有入驻申请，状态："+statusText(p.Status))
			return
		}
	}
	store.db.SeqProvider++
	// 价格档位：15/30/45/60/75/90/105/120分钟（默认单价1元/分，批量打9折）
	pricePerMinute := 1.0
	priceTiers := map[string]float64{
		"15":  15.0,
		"30":  28.5,
		"45":  40.5,
		"60":  54.0,
		"75":  67.5,
		"90":  81.0,
		"105": 94.5,
		"120": 108.0,
	}
	priceTiersJSON, _ := json.Marshal(priceTiers)

	p := &Provider{
		ID: store.db.SeqProvider, UserID: uid, Role: 1,
		RealName: body.RealName, Gender: body.Gender, Age: body.Age, City: body.City,
		Education: body.Education, Major: body.Major,
		IDCard: body.IDCard, Phone: body.Phone, Intro: body.Intro, Expertise: body.Expertise,
		Certificates: body.Certificates, TrainingProof: body.TrainingProof,
		CertificateNo: body.CertificateNo, CertificateImage: body.CertificateImage,
		EducationImage: body.EducationImage, CounselorImage: body.CounselorImage,
		YearsOfExp: body.YearsOfExp, ConsultHours: body.ConsultHours,
		Background:     body.Background,
		PricePerMinute: pricePerMinute, PriceTiers: string(priceTiersJSON),
		Level: 1, IsOnline: 0, IsBusy: 0, Rating: 0,
		TotalSessions: 0, TotalEarnings: 0, Withdrawable: 0, DailyLimit: 10,
		TodaySessions: 0, Status: 0, CreatedAt: now(), UpdatedAt: now(),
	}
	store.db.Providers[p.ID] = p
	store.save()
	sendOK(w, map[string]interface{}{"id": p.ID, "status": 0, "msg": "已提交，等待审核"})
}

func hProviderStatus(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(r)
	if !ok {
		fail(w, "未登录")
		return
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	for _, p := range store.db.Providers {
		if p.UserID == uid {
			sendOK(w, decorateProvider(p))
			return
		}
	}
	sendOK(w, map[string]interface{}{"status": -1, "msg": "未申请入驻"})
}

func hProviderOnline(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(r)
	if !ok {
		fail(w, "未登录")
		return
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	for _, p := range store.db.Providers {
		if p.UserID == uid {
			if p.Status != 1 {
				fail(w, "审核未通过，无法上线")
				return
			}
			p.IsOnline = 1
			p.UpdatedAt = now()
			store.save()
			sendOK(w, map[string]interface{}{"is_online": 1})
			return
		}
	}
	fail(w, "尚未入驻")
}

func hProviderOffline(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(r)
	if !ok {
		fail(w, "未登录")
		return
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	for _, p := range store.db.Providers {
		if p.UserID == uid {
			p.IsOnline = 0
			p.IsBusy = 0
			p.UpdatedAt = now()
			store.save()
			sendOK(w, map[string]interface{}{"is_online": 0})
			return
		}
	}
	fail(w, "尚未入驻")
}

func hProviderEarnings(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(r)
	if !ok {
		fail(w, "未登录")
		return
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	var me *Provider
	for _, p := range store.db.Providers {
		if p.UserID == uid {
			me = p
			break
		}
	}
	if me == nil {
		fail(w, "尚未入驻")
		return
	}
	today := startOfToday()
	todayIncome := 0.0
	details := []map[string]interface{}{}
	for _, c := range store.db.Calls {
		if c.ProviderID == me.ID && c.Status == 1 {
			if c.EndTime >= today {
				todayIncome += c.ProviderIncome
			}
			details = append(details, map[string]interface{}{
				"created_at": c.CreatedAt, "duration": c.Duration, "income": c.ProviderIncome,
				"user_name": store.db.Users[c.UserID].Nickname,
			})
		}
	}
	// 已完成收入 = 累计已打款的提现金额；未完成收入 = 尚未提现的可提现余额
	completedIncome := 0.0
	for _, wd := range store.db.Withdraws {
		if wd.ProviderID == me.ID && wd.Status == 2 {
			completedIncome += wd.Amount
		}
	}
	sendOK(w, map[string]interface{}{
		"pending_income":   round2(me.Withdrawable), // 未完成收入（可提现余额）
		"completed_income": round2(completedIncome), // 已完成收入（已打款）
		"withdrawable":     me.Withdrawable, "total_earnings": me.TotalEarnings,
		"today_income": todayIncome, "details": details,
	})
}

// hProviderCalls：倾听者本人的「接叫记录」（来电列表），含每次通话的时长/收益/评价
func hProviderCalls(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(r)
	if !ok {
		fail(w, "未登录")
		return
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	var me *Provider
	for _, p := range store.db.Providers {
		if p.UserID == uid {
			me = p
			break
		}
	}
	if me == nil {
		fail(w, "尚未入驻")
		return
	}
	list := []map[string]interface{}{}
	for _, c := range store.db.Calls {
		if c.ProviderID != me.ID {
			continue
		}
		list = append(list, map[string]interface{}{
			"id":         c.ID,
			"room_id":    c.RoomID,
			"call_type":  c.CallType,
			"user_name":  store.db.Users[c.UserID].Nickname,
			"duration":   c.Duration, // 秒
			"minutes":    c.PackageMinutes,
			"amount":     c.Amount,         // 用户实付（元）
			"income":     c.ProviderIncome, // 本人收益（元）
			"fee":        c.PlatformFee,    // 平台服务费（元）
			"rating":     c.UserRating,
			"comment":    c.UserComment,
			"status":     c.Status,
			"created_at": c.CreatedAt,
		})
	}
	sort.Slice(list, func(i, j int) bool {
		return list[i]["created_at"].(int64) > list[j]["created_at"].(int64)
	})
	sendOK(w, list)
}

func hProviderWithdraw(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(r)
	if !ok {
		fail(w, "未登录")
		return
	}
	var body struct {
		Amount float64 `json:"amount"`
	}
	readJSON(r, &body)
	store.mu.Lock()
	defer store.mu.Unlock()
	var me *Provider
	for _, p := range store.db.Providers {
		if p.UserID == uid {
			me = p
			break
		}
	}
	if me == nil {
		fail(w, "尚未入驻")
		return
	}
	if body.Amount < store.db.Config.MinWithdraw {
		fail(w, fmt.Sprintf("提现金额不得低于 %.0f 元", store.db.Config.MinWithdraw))
		return
	}
	if body.Amount > transferSingleMax {
		fail(w, fmt.Sprintf("单笔提现不能超过 %.0f 元（微信单笔转账上限）", transferSingleMax))
		return
	}
	if body.Amount > me.Withdrawable {
		fail(w, "可提现余额不足")
		return
	}
	me.Withdrawable -= body.Amount
	store.db.SeqWithdraw++
	rec := &WithdrawRecord{
		ID: store.db.SeqWithdraw, ProviderID: me.ID, Amount: body.Amount, Fee: 0,
		Method: 1, Openid: store.db.Users[uid].Openid, Status: 0, CreatedAt: now(), UpdatedAt: now(),
	}
	store.db.Withdraws[rec.ID] = rec
	store.save()
	sendOK(w, map[string]interface{}{"id": rec.ID, "status": 0, "msg": "提现申请已提交"})
}

// ---------- 管理后台 ----------

func hAdminLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	readJSON(r, &body)
	store.mu.Lock()
	defer store.mu.Unlock()
	for _, a := range store.db.Admins {
		if a.Username == body.Username && a.Password == sha256hex(body.Password) {
			if a.Status != 1 {
				fail(w, "账号已禁用")
				return
			}
			a.LastLogin = now()
			a.UpdatedAt = now()
			tok, _ := genAdminToken(a.ID, a.Role)
			store.save()
			sendOK(w, map[string]interface{}{"token": tok, "admin": a})
			return
		}
	}
	fail(w, "账号或密码错误")
}

func hAdminDashboard(w http.ResponseWriter, r *http.Request) {
	_, ok := requireAdmin(r)
	if !ok {
		fail(w, "无权限")
		return
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	today := startOfToday()
	todayCalls := 0
	todayIncome := 0.0
	online := 0
	newUsers := 0
	for _, c := range store.db.Calls {
		if c.Status == 1 && c.EndTime >= today {
			todayCalls++
			todayIncome += c.Amount
		}
	}
	for _, p := range store.db.Providers {
		if p.IsOnline == 1 && p.Status == 1 {
			online++
		}
	}
	for _, u := range store.db.Users {
		if u.CreatedAt >= today {
			newUsers++
		}
	}
	// 近 7 日趋势
	trend := []map[string]interface{}{}
	for i := 6; i >= 0; i-- {
		dayStart := startOfToday() - int64(i)*86400
		dayEnd := dayStart + 86400
		dc, di := 0, 0.0
		for _, c := range store.db.Calls {
			if c.Status == 1 && c.EndTime >= dayStart && c.EndTime < dayEnd {
				dc++
				di += c.Amount
			}
		}
		trend = append(trend, map[string]interface{}{
			"date": time.Unix(dayStart, 0).Format("01-02"), "calls": dc, "income": di,
		})
	}
	sendOK(w, map[string]interface{}{
		"today_calls": todayCalls, "today_income": todayIncome,
		"online_providers": online, "new_users": newUsers, "trend": trend,
	})
}

func hAdminProviders(w http.ResponseWriter, r *http.Request) {
	_, ok := requireAdmin(r)
	if !ok {
		fail(w, "无权限")
		return
	}
	keyword := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("keyword")))
	store.mu.Lock()
	defer store.mu.Unlock()
	list := []*Provider{}
	for _, p := range store.db.Providers {
		if keyword != "" {
			hay := strings.ToLower(fmt.Sprintf("%d %s %s %s %s %s", p.ID, p.Nickname, p.RealName, p.City, p.Phone, p.Education))
			if !strings.Contains(hay, keyword) {
				continue
			}
		}
		list = append(list, decorateProvider(p))
	}
	respList(w, list, r)
}

func hAdminApplications(w http.ResponseWriter, r *http.Request) {
	_, ok := requireAdmin(r)
	if !ok {
		fail(w, "无权限")
		return
	}
	keyword := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("keyword")))
	store.mu.Lock()
	defer store.mu.Unlock()
	list := []*Provider{}
	for _, p := range store.db.Providers {
		if p.Status != 0 {
			continue
		}
		if keyword != "" {
			hay := strings.ToLower(fmt.Sprintf("%d %s %s %s %s %s", p.ID, p.Nickname, p.RealName, p.City, p.Phone, p.Education))
			if !strings.Contains(hay, keyword) {
				continue
			}
		}
		list = append(list, decorateProvider(p))
	}
	respList(w, list, r)
}

func hAdminApprove(w http.ResponseWriter, r *http.Request, params map[string]string) {
	_, ok := requireAdmin(r)
	if !ok {
		fail(w, "无权限")
		return
	}
	id, _ := strconv.ParseInt(params["id"], 10, 64)
	var body struct {
		Approve bool   `json:"approve"`
		Reason  string `json:"reason"`
	}
	readJSON(r, &body)
	store.mu.Lock()
	defer store.mu.Unlock()
	p, ok := store.db.Providers[id]
	if !ok {
		fail(w, "服务者不存在")
		return
	}
	if body.Approve {
		p.Status = 1
		p.ApprovedAt = now()
	} else {
		p.Status = 2
		p.RejectReason = body.Reason
	}
	p.UpdatedAt = now()
	store.save()
	sendOK(w, map[string]interface{}{"status": p.Status})
}

func hAdminProviderUpdate(w http.ResponseWriter, r *http.Request, params map[string]string) {
	_, ok := requireAdmin(r)
	if !ok {
		fail(w, "无权限")
		return
	}
	id, _ := strconv.ParseInt(params["id"], 10, 64)
	var body struct {
		RealName       string  `json:"real_name"`
		Gender         int     `json:"gender"`
		Age            int     `json:"age"`
		City           string  `json:"city"`
		Education      string  `json:"education"`
		Major          string  `json:"major"`
		YearsOfExp     int     `json:"years_of_exp"`
		ConsultHours   int     `json:"consult_hours"`
		Intro          string  `json:"intro"`
		Expertise      string  `json:"expertise"`
		PricePerMinute float64 `json:"price_per_minute"`
		PriceTiers     string  `json:"price_tiers"`
		Level          int     `json:"level"`
		DailyLimit     int     `json:"daily_limit"`
	}
	readJSON(r, &body)
	// 校验
	if body.Gender != 0 && body.Gender != 1 {
		fail(w, "性别无效")
		return
	}
	if body.Age > 0 && body.Age < 18 {
		fail(w, "年龄必须≥18岁")
		return
	}
	if body.YearsOfExp < 0 {
		fail(w, "从业年限无效")
		return
	}
	if body.ConsultHours < 0 {
		fail(w, "咨询时长无效")
		return
	}
	if body.Level > 0 && body.Level < 1 || body.Level > 3 {
		fail(w, "认证等级无效")
		return
	}
	if body.DailyLimit < 0 {
		fail(w, "每日限额无效")
		return
	}
	if body.PricePerMinute < 0 {
		fail(w, "单价无效")
		return
	}
	if body.PriceTiers != "" {
		var tiers map[string]float64
		if err := json.Unmarshal([]byte(body.PriceTiers), &tiers); err != nil {
			fail(w, "价格档位格式无效（需JSON对象）")
			return
		}
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	p, ok := store.db.Providers[id]
	if !ok {
		fail(w, "服务者不存在")
		return
	}
	// 只更新非零字段
	if body.RealName != "" {
		p.RealName = body.RealName
	}
	if body.Gender == 0 || body.Gender == 1 {
		p.Gender = body.Gender
	}
	if body.Age >= 18 {
		p.Age = body.Age
	}
	if body.City != "" {
		p.City = body.City
	}
	if body.Education != "" {
		p.Education = body.Education
	}
	if body.Major != "" {
		p.Major = body.Major
	}
	if body.YearsOfExp >= 0 {
		p.YearsOfExp = body.YearsOfExp
	}
	if body.ConsultHours >= 0 {
		p.ConsultHours = body.ConsultHours
	}
	if body.Intro != "" {
		p.Intro = body.Intro
	}
	if body.Expertise != "" {
		p.Expertise = body.Expertise
	}
	if body.PricePerMinute >= 0 {
		p.PricePerMinute = body.PricePerMinute
	}
	if body.PriceTiers != "" {
		p.PriceTiers = body.PriceTiers
	}
	if body.Level >= 1 && body.Level <= 3 {
		p.Level = body.Level
	}
	if body.DailyLimit >= 0 {
		p.DailyLimit = body.DailyLimit
	}
	p.UpdatedAt = now()
	store.save()
	sendOK(w, decorateProvider(p))
}

func hAdminProviderStatus(w http.ResponseWriter, r *http.Request, params map[string]string) {
	_, ok := requireAdmin(r)
	if !ok {
		fail(w, "无权限")
		return
	}
	id, _ := strconv.ParseInt(params["id"], 10, 64)
	var body struct {
		Status         int     `json:"status"` // 1启用 3禁用
		IsOnline       int     `json:"is_online"`
		PricePerMinute float64 `json:"price_per_minute"` // 单价（元/分，后台可调，默认 1.0=10 H币）
	}
	readJSON(r, &body)
	store.mu.Lock()
	defer store.mu.Unlock()
	p, ok := store.db.Providers[id]
	if !ok {
		fail(w, "服务者不存在")
		return
	}
	if body.Status == 1 || body.Status == 3 {
		p.Status = body.Status
	}
	if body.IsOnline == 0 || body.IsOnline == 1 {
		p.IsOnline = body.IsOnline
		if body.IsOnline == 0 {
			p.IsBusy = 0
		}
	}
	if body.PricePerMinute > 0 {
		p.PricePerMinute = body.PricePerMinute
	}
	p.UpdatedAt = now()
	store.save()
	sendOK(w, decorateProvider(p))
}

func hAdminCalls(w http.ResponseWriter, r *http.Request) {
	_, ok := requireAdmin(r)
	if !ok {
		fail(w, "无权限")
		return
	}
	keyword := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("keyword")))
	store.mu.Lock()
	defer store.mu.Unlock()
	list := []map[string]interface{}{}
	for _, c := range store.db.Calls {
		un := store.db.Users[c.UserID].Nickname
		pn := store.db.Providers[c.ProviderID].RealName
		if keyword != "" {
			hay := strings.ToLower(fmt.Sprintf("%d %s %s", c.ID, un, pn))
			if !strings.Contains(hay, keyword) {
				continue
			}
		}
		list = append(list, map[string]interface{}{
			"id": c.ID, "user_name": un,
			"provider_name": pn,
			"call_type":     c.CallType, "duration": c.Duration, "amount": c.Amount,
			"provider_income": c.ProviderIncome, "platform_fee": c.PlatformFee,
			"status": c.Status, "created_at": c.CreatedAt,
		})
	}
	respList(w, list, r)
}

func hAdminRecharge(w http.ResponseWriter, r *http.Request) {
	_, ok := requireAdmin(r)
	if !ok {
		fail(w, "无权限")
		return
	}
	keyword := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("keyword")))
	store.mu.Lock()
	defer store.mu.Unlock()
	list := []map[string]interface{}{}
	for _, o := range store.db.Recharges {
		un := store.db.Users[o.UserID].Nickname
		if keyword != "" {
			hay := strings.ToLower(fmt.Sprintf("%s %s", o.OrderNo, un))
			if !strings.Contains(hay, keyword) {
				continue
			}
		}
		list = append(list, map[string]interface{}{
			"order_no": o.OrderNo, "user_name": un,
			"amount": o.Amount, "pay_status": o.PayStatus, "pay_time": o.PayTime,
			"created_at": o.CreatedAt,
		})
	}
	respList(w, list, r)
}

func hAdminWithdraws(w http.ResponseWriter, r *http.Request) {
	_, ok := requireAdmin(r)
	if !ok {
		fail(w, "无权限")
		return
	}
	keyword := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("keyword")))
	store.mu.Lock()
	defer store.mu.Unlock()
	list := []map[string]interface{}{}
	for _, wd := range store.db.Withdraws {
		pn := store.db.Providers[wd.ProviderID].RealName
		if keyword != "" {
			hay := strings.ToLower(fmt.Sprintf("%d %s", wd.ID, pn))
			if !strings.Contains(hay, keyword) {
				continue
			}
		}
		list = append(list, map[string]interface{}{
			"id": wd.ID, "provider_name": pn,
			"amount": wd.Amount, "status": wd.Status, "created_at": wd.CreatedAt,
			"transfer_no": wd.TransferNo, "transfer_state": wd.TransferState,
		})
	}
	respList(w, list, r)
}

// 微信「商家转账到零钱」限额（微信平台硬性规则，超限将被拒付 / 触发风控）
const (
	transferSingleMax       = 200.0   // 单笔最大 200 元
	transferUserDailyMax    = 2000.0  // 单日向同一服务者累计 2000 元
	transferCompanyDailyMax = 50000.0 // 公司单日累计 50000 元
)

// 统计某服务者当日已受理（Status=1）的转账总额
func transferDailyUsedByProvider(providerID, since int64) float64 {
	used := 0.0
	for _, t := range store.db.Transfers {
		if t.ProviderID == providerID && t.Status == 1 && t.CreatedAt >= since {
			used += t.Amount
		}
	}
	return used
}

// 统计公司当日已受理（Status=1）的转账总额
func transferDailyUsedCompany(since int64) float64 {
	used := 0.0
	for _, t := range store.db.Transfers {
		if t.Status == 1 && t.CreatedAt >= since {
			used += t.Amount
		}
	}
	return used
}

func hAdminWithdrawUpdate(w http.ResponseWriter, r *http.Request, params map[string]string) {
	_, ok := requireAdmin(r)
	if !ok {
		fail(w, "无权限")
		return
	}
	id, _ := strconv.ParseInt(params["id"], 10, 64)
	var body struct {
		Status int    `json:"status"` // 1通过 2打款 3拒绝
		Remark string `json:"remark"`
	}
	readJSON(r, &body)

	// 先在校内锁内做校验并取出发款所需数据，避免在持锁状态下发起网络请求（微信接口耗时）。
	store.mu.Lock()
	wd, ok := store.db.Withdraws[id]
	if !ok {
		store.mu.Unlock()
		fail(w, "提现记录不存在")
		return
	}
	if body.Status == 2 && wd.Status == 2 {
		store.mu.Unlock()
		fail(w, "该提现已打款，无需重复")
		return
	}
	// 打款：准备参数（openid 缺失时回退到 服务者→用户）
	amount := wd.Amount
	openid := wd.Openid
	providerName := ""
	var providerID int64
	if p, ok := store.db.Providers[wd.ProviderID]; ok {
		providerName = p.RealName
		providerID = p.ID
		if openid == "" && p.UserID != 0 {
			if u := store.db.Users[p.UserID]; u != nil {
				openid = u.Openid
			}
		}
	}
	store.mu.Unlock()

	// 打款：调用微信「商家转账到零钱」
	if body.Status == 2 {
		// —— 微信转账额度校验（平台硬性限额，超限直接拦截，避免被拒付/触发风控）——
		if amount > transferSingleMax {
			fail(w, fmt.Sprintf("单笔转账不能超过 %.0f 元（当前 %.2f 元）", transferSingleMax, amount))
			return
		}
		store.mu.Lock()
		since := startOfToday()
		usedUser := transferDailyUsedByProvider(providerID, since)
		usedCompany := transferDailyUsedCompany(since)
		store.mu.Unlock()
		if amount+usedUser > transferUserDailyMax {
			fail(w, fmt.Sprintf("该服务者今日转账额度已满（单日上限 %.0f 元，已用 %.2f 元）", transferUserDailyMax, usedUser))
			return
		}
		if amount+usedCompany > transferCompanyDailyMax {
			fail(w, fmt.Sprintf("今日公司转账额度已满（单日上限 %.0f 元，已用 %.2f 元）", transferCompanyDailyMax, usedCompany))
			return
		}
		if openid == "" {
			fail(w, "该服务者无 openid，无法打款")
			return
		}
		// 商户单号：WD + 时间戳 + 随机，保证唯一且仅含数字字母
		outBillNo := "WD" + strconv.FormatInt(now(), 10) + randomNonce()[:6]
		resp, err := createWxTransferToBalance(openid, outBillNo, amount, "Hearcup 倾听者分佣")
		if err != nil {
			// 打款失败：记录转账失败单，但提现单不标记为已打款（保持审核通过，可重试）
			store.mu.Lock()
			store.db.SeqTransfer++
			tr := &TransferRecord{
				ID: store.db.SeqTransfer, WithdrawID: wd.ID, ProviderID: providerID,
				ProviderName: providerName, Openid: openid, Amount: amount,
				OutBillNo: outBillNo, State: "FAIL", Status: 2, FailReason: err.Error(),
				Remark: body.Remark, CreatedAt: now(), UpdatedAt: now(),
			}
			store.db.Transfers[tr.ID] = tr
			store.save()
			store.mu.Unlock()
			fmt.Println("[transfer] 打款失败 withdraw_id=", wd.ID, " err=", err.Error())
			fail(w, "微信打款失败: "+err.Error())
			return
		}
		// 受理成功（state 多为 ACCEPTED/PROCESSING，结果异步通知）
		state := ""
		if s, ok := resp["state"].(string); ok {
			state = s
		}
		wxBillNo := ""
		if b, ok := resp["transfer_bill_no"].(string); ok {
			wxBillNo = b
		}
		// 领取凭证：新版「商家转账到零钱」发起后须倾听者手动领取，package_info 供小程序调 wx.requestMerchantTransfer
		packageInfo := ""
		if p, ok := resp["package_info"].(string); ok {
			packageInfo = p
		}
		store.mu.Lock()
		store.db.SeqTransfer++
		tr := &TransferRecord{
			ID: store.db.SeqTransfer, WithdrawID: wd.ID, ProviderID: providerID,
			ProviderName: providerName, Openid: openid, Amount: amount,
			OutBillNo: outBillNo, WxBillNo: wxBillNo, State: state, Status: 1,
			Remark: body.Remark, PackageInfo: packageInfo, CreatedAt: now(), UpdatedAt: now(),
		}
		store.db.Transfers[tr.ID] = tr
		wd.Status = 2
		wd.TransferNo = outBillNo
		wd.TransferState = state
		wd.PaidAt = now()
		wd.Remark = body.Remark
		wd.UpdatedAt = now()
		store.save()
		store.mu.Unlock()
		fmt.Println("[transfer] 打款受理成功 withdraw_id=", wd.ID, " out_bill_no=", outBillNo, " state=", state)
		sendOK(w, map[string]interface{}{"status": 2, "transfer_no": outBillNo, "transfer_state": state, "msg": "微信已受理打款"})
		return
	}

	// 通过 / 拒绝：常规更新
	store.mu.Lock()
	wd.Status = body.Status
	wd.Remark = body.Remark
	t := now()
	if body.Status == 1 {
		wd.ApprovedAt = t
	} else if body.Status == 3 {
		// 拒绝：退还可提现
		if p, ok := store.db.Providers[wd.ProviderID]; ok {
			p.Withdrawable += wd.Amount
		}
	}
	wd.UpdatedAt = t
	store.save()
	store.mu.Unlock()
	sendOK(w, map[string]interface{}{"status": wd.Status})
}

// hAdminTransfers：转账记录（商家转账到零钱）列表，分页 + 搜索（服务者名 / 商户单号 / 微信状态）
func hAdminTransfers(w http.ResponseWriter, r *http.Request) {
	_, ok := requireAdmin(r)
	if !ok {
		fail(w, "无权限")
		return
	}
	keyword := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("keyword")))
	store.mu.Lock()
	defer store.mu.Unlock()
	list := []map[string]interface{}{}
	for _, tr := range store.db.Transfers {
		if keyword != "" {
			hay := strings.ToLower(fmt.Sprintf("%d %s %s %s", tr.ID, tr.ProviderName, tr.OutBillNo, tr.State))
			if !strings.Contains(hay, keyword) {
				continue
			}
		}
		list = append(list, map[string]interface{}{
			"id": tr.ID, "withdraw_id": tr.WithdrawID, "provider_name": tr.ProviderName,
			"openid": tr.Openid, "amount": tr.Amount, "out_bill_no": tr.OutBillNo,
			"wx_bill_no": tr.WxBillNo, "state": tr.State, "status": tr.Status,
			"fail_reason": tr.FailReason, "remark": tr.Remark,
			"created_at": tr.CreatedAt, "updated_at": tr.UpdatedAt,
		})
	}
	// 按 ID 倒序（最新在前）
	sort.Slice(list, func(i, j int) bool { return list[i]["id"].(int64) > list[j]["id"].(int64) })
	respList(w, list, r)
}

// hAdminTransferQuery：按转账记录 ID 重新向微信查询最新状态并回写（结果异步，受理后可轮询）。
func hAdminTransferQuery(w http.ResponseWriter, r *http.Request, params map[string]string) {
	_, ok := requireAdmin(r)
	if !ok {
		fail(w, "无权限")
		return
	}
	id, _ := strconv.ParseInt(params["id"], 10, 64)
	store.mu.Lock()
	tr, ok := store.db.Transfers[id]
	if !ok {
		store.mu.Unlock()
		fail(w, "转账记录不存在")
		return
	}
	outBillNo := tr.OutBillNo
	store.mu.Unlock()
	if outBillNo == "" {
		fail(w, "该记录无商户单号，无法查询")
		return
	}
	resp, err := queryWxTransfer(outBillNo)
	if err != nil {
		fail(w, "查询失败: "+err.Error())
		return
	}
	state := ""
	if s, ok := resp["state"].(string); ok {
		state = s
	}
	wxBillNo := ""
	if b, ok := resp["transfer_bill_no"].(string); ok {
		wxBillNo = b
	}
	pkgInfo := ""
	if p, ok := resp["package_info"].(string); ok {
		pkgInfo = p
	}
	store.mu.Lock()
	tr.State = state
	if wxBillNo != "" {
		tr.WxBillNo = wxBillNo
	}
	if pkgInfo != "" {
		tr.PackageInfo = pkgInfo
	}
	tr.UpdatedAt = now()
	if state == "FINISHED" {
		tr.Status = 1
	} else if state == "FAIL" {
		tr.Status = 2
	}
	if wd, ok := store.db.Withdraws[tr.WithdrawID]; ok {
		wd.TransferState = state
	}
	store.save()
	store.mu.Unlock()
	sendOK(w, map[string]interface{}{"state": state, "wx_bill_no": wxBillNo, "msg": "已更新"})
}

// hProviderTransfers：倾听者查看自己的分佣转账记录（仅本人名下），含待领取标记与领取凭证。
// 新版「商家转账到零钱」发起后，收款方须在小程序手动领取，package_info 为调起领取页凭证。
func hProviderTransfers(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(r)
	if !ok {
		fail(w, "未登录")
		return
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	var me *Provider
	for _, p := range store.db.Providers {
		if p.UserID == uid {
			me = p
			break
		}
	}
	if me == nil {
		fail(w, "尚未入驻")
		return
	}
	list := []map[string]interface{}{}
	for _, tr := range store.db.Transfers {
		if tr.ProviderID != me.ID {
			continue
		}
		// 有领取凭证即视为待领取（state 可能是 WAIT_USER_CONFIRM/ACCEPTED/PROCESSING，以凭证为准最稳）
		canClaim := tr.Status == 1 && tr.PackageInfo != ""
		item := map[string]interface{}{
			"id":          tr.ID,
			"withdraw_id": tr.WithdrawID,
			"amount":      tr.Amount,
			"state":       tr.State,
			"status":      tr.Status,
			"wx_bill_no":  tr.WxBillNo,
			"created_at":  tr.CreatedAt,
			"updated_at":  tr.UpdatedAt,
			"can_claim":   canClaim,
			"mch_id":      appCfg.WXPayMchID,
			"app_id":      appCfg.WXAppID,
		}
		if canClaim {
			item["package_info"] = tr.PackageInfo
		}
		list = append(list, item)
	}
	// 按创建时间倒序（最新在前）
	sort.Slice(list, func(i, j int) bool {
		return list[i]["created_at"].(int64) > list[j]["created_at"].(int64)
	})
	sendOK(w, list)
}

// hProviderTransferClaim：倾听者发起领取——重新向微信查询最新状态/领取凭证并回写，
// 返回最新 package_info 供小程序调 wx.requestMerchantTransfer 调起领取页。仅能领取本人名下转账。
func hProviderTransferClaim(w http.ResponseWriter, r *http.Request, params map[string]string) {
	uid, ok := requireUser(r)
	if !ok {
		fail(w, "未登录")
		return
	}
	id, _ := strconv.ParseInt(params["id"], 10, 64)
	store.mu.Lock()
	var me *Provider
	for _, p := range store.db.Providers {
		if p.UserID == uid {
			me = p
			break
		}
	}
	if me == nil {
		store.mu.Unlock()
		fail(w, "尚未入驻")
		return
	}
	tr, ok := store.db.Transfers[id]
	if !ok || tr.ProviderID != me.ID {
		store.mu.Unlock()
		fail(w, "转账记录不存在")
		return
	}
	outBillNo := tr.OutBillNo
	store.mu.Unlock()
	if outBillNo == "" {
		fail(w, "该记录无商户单号，无法领取")
		return
	}
	// 已到账：直接返回，无需再唤起领取
	if tr.Status == 1 && (tr.State == "FINISHED" || tr.State == "SUCCESS") {
		sendOK(w, map[string]interface{}{"state": tr.State, "package_info": "", "can_claim": false, "msg": "已领取到账", "mch_id": appCfg.WXPayMchID, "app_id": appCfg.WXAppID})
		return
	}
	resp, err := queryWxTransfer(outBillNo)
	if err != nil {
		fail(w, "查询失败: "+err.Error())
		return
	}
	state := ""
	if s, ok := resp["state"].(string); ok {
		state = s
	}
	wxBillNo := ""
	if b, ok := resp["transfer_bill_no"].(string); ok {
		wxBillNo = b
	}
	pkgInfo := ""
	if p, ok := resp["package_info"].(string); ok {
		pkgInfo = p
	}
	store.mu.Lock()
	tr.State = state
	if wxBillNo != "" {
		tr.WxBillNo = wxBillNo
	}
	if pkgInfo != "" {
		tr.PackageInfo = pkgInfo
	}
	tr.UpdatedAt = now()
	if state == "FINISHED" {
		tr.Status = 1
	} else if state == "FAIL" {
		tr.Status = 2
	}
	if wd, ok := store.db.Withdraws[tr.WithdrawID]; ok {
		wd.TransferState = state
	}
	store.save()
	store.mu.Unlock()
	canClaim := tr.Status == 1 && pkgInfo != ""
	sendOK(w, map[string]interface{}{"state": state, "package_info": pkgInfo, "can_claim": canClaim, "msg": "ok", "mch_id": appCfg.WXPayMchID, "app_id": appCfg.WXAppID})
}

// ---------- 提示管理（平台通知）----------

// GET /api/v1/admin/notifications —— 列表（分页 + 关键字搜索标题/内容）
func hAdminNotifications(w http.ResponseWriter, r *http.Request) {
	_, ok := requireAdmin(r)
	if !ok {
		fail(w, "无权限")
		return
	}
	keyword := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("keyword")))
	store.mu.Lock()
	defer store.mu.Unlock()
	list := []*Notification{}
	for _, n := range store.db.Notifications {
		if keyword != "" {
			hay := strings.ToLower(n.Title + " " + n.Content)
			if !strings.Contains(hay, keyword) {
				continue
			}
		}
		list = append(list, n)
	}
	// 按 ID 倒序（新建的在后）
	sort.Slice(list, func(i, j int) bool { return list[i].ID > list[j].ID })
	respList(w, list, r)
}

// POST /api/v1/admin/notifications —— 新建
func hAdminNotificationCreate(w http.ResponseWriter, r *http.Request) {
	_, ok := requireAdmin(r)
	if !ok {
		fail(w, "无权限")
		return
	}
	var body struct {
		Title   string `json:"title"`
		Content string `json:"content"`
		Target  string `json:"target"`
		Status  int    `json:"status"`
	}
	readJSON(r, &body)
	if body.Title == "" {
		fail(w, "标题不能为空")
		return
	}
	if body.Target == "" {
		body.Target = "all"
	}
	t := now()
	store.mu.Lock()
	store.db.SeqNotification++
	n := &Notification{
		ID:          store.db.SeqNotification,
		Title:       body.Title,
		Content:     body.Content,
		Target:      body.Target,
		Status:      body.Status,
		CreatedAt:   t,
		UpdatedAt:   t,
		PublishedAt: t,
	}
	store.db.Notifications[n.ID] = n
	store.save()
	store.mu.Unlock()
	sendOK(w, n)
}

// PUT /api/v1/admin/notifications/:id —— 编辑
func hAdminNotificationUpdate(w http.ResponseWriter, r *http.Request, params map[string]string) {
	_, ok := requireAdmin(r)
	if !ok {
		fail(w, "无权限")
		return
	}
	id, _ := strconv.ParseInt(params["id"], 10, 64)
	var body struct {
		Title   string `json:"title"`
		Content string `json:"content"`
		Target  string `json:"target"`
		Status  int    `json:"status"`
	}
	readJSON(r, &body)
	store.mu.Lock()
	defer store.mu.Unlock()
	n, ok := store.db.Notifications[id]
	if !ok {
		fail(w, "通知不存在")
		return
	}
	if body.Title != "" {
		n.Title = body.Title
	}
	n.Content = body.Content
	if body.Target != "" {
		n.Target = body.Target
	}
	n.Status = body.Status
	n.UpdatedAt = now()
	if body.Status == 1 && n.PublishedAt == 0 {
		n.PublishedAt = now()
	}
	store.save()
	sendOK(w, n)
}

// DELETE /api/v1/admin/notifications/:id —— 删除
func hAdminNotificationDelete(w http.ResponseWriter, r *http.Request, params map[string]string) {
	_, ok := requireAdmin(r)
	if !ok {
		fail(w, "无权限")
		return
	}
	id, _ := strconv.ParseInt(params["id"], 10, 64)
	store.mu.Lock()
	defer store.mu.Unlock()
	if _, ok := store.db.Notifications[id]; !ok {
		fail(w, "通知不存在")
		return
	}
	delete(store.db.Notifications, id)
	store.save()
	sendOK(w, map[string]interface{}{"id": id})
}

func hAdminConfig(w http.ResponseWriter, r *http.Request) {
	_, ok := requireAdmin(r)
	if !ok {
		fail(w, "无权限")
		return
	}
	if r.Method == http.MethodPut {
		var c Config
		readJSON(r, &c)
		store.mu.Lock()
		// 单价已下放到每个服务者（默认 10 H币/分），全局不再配置倾听师/咨询师单价
		if c.PlatformRate > 0 {
			store.db.Config.PlatformRate = c.PlatformRate
		}
		if c.MinBalance >= 0 {
			store.db.Config.MinBalance = c.MinBalance
		}
		if c.Overdraft >= 0 {
			store.db.Config.Overdraft = c.Overdraft
		}
		if c.MinWithdraw > 0 {
			store.db.Config.MinWithdraw = c.MinWithdraw
		}
		store.mu.Unlock()
		store.save()
	}
	sendOK(w, store.db.Config)
}

// ---------- 辅助 ----------

func statusText(s int) string {
	switch s {
	case 0:
		return "待审核"
	case 1:
		return "已通过"
	case 2:
		return "已拒绝"
	case 3:
		return "已禁用"
	}
	return "未知"
}

func startOfToday() int64 {
	t := time.Now()
	d := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
	return d.Unix()
}

// 生成 TRTC UserSig（腾讯 TLSSigAPIv2 算法；SDKAppID=0 时返回占位签名）
func generateUserSig(userID string) string {
	if appCfg.TRTCAppID == 0 {
		return "MOCKSIG_" + userID
	}
	expire := 86400
	return generateUserSigAt(userID, now(), expire)
}

// generateUserSigAt 允许注入固定时间戳，便于与腾讯官方 SDK 做逐字符交叉验证（见 im_probe_test.go）。
func generateUserSigAt(userID string, ts int64, expire int) string {
	if appCfg.TRTCAppID == 0 {
		return "MOCKSIG_" + userID
	}
	// ① 待签名串：腾讯官方 TLSSigAPIv2 固定格式，字段名/顺序/换行不可变。
	//    注意：userbuf（payload 的 base64）仅在需要房间级权限时参与签名，普通 UserSig 不含该行。
	content := fmt.Sprintf("TLS.identifier:%s\nTLS.sdkappid:%d\nTLS.time:%d\nTLS.expire:%d\n",
		userID, appCfg.TRTCAppID, ts, expire)
	sig := base64.StdEncoding.EncodeToString(hmacSHA256(appCfg.TRTCSecret, content))

	// ② payload JSON：字段顺序与官方 SDK 保持一致（zlib 对字节序敏感，对齐后可与官方实现逐字符比对）。
	//    带 userbuf 时需额外追加 "TLS.userbuf" 字段，此处不涉房权限，故省略。
	doc := fmt.Sprintf(
		`{"TLS.ver":"2.0","TLS.identifier":"%s","TLS.sdkappid":%d,"TLS.time":%d,"TLS.expire":%d,"TLS.sig":"%s"}`,
		userID, appCfg.TRTCAppID, ts, expire, sig)

	// ③ 官方规范：JSON → zlib deflate → base64 → 腾讯私有 URL-safe 转义。
	//    历史上曾误用「明文 JSON 直接 base64」，服务端按压缩格式解压失败，返回 70003 UserSig 非法。
	var buf bytes.Buffer
	zw := zlib.NewWriter(&buf)
	_, _ = zw.Write([]byte(doc))
	_ = zw.Close()
	return tencentBase64URLEscape(base64.StdEncoding.EncodeToString(buf.Bytes()))
}

// tencentBase64URLEscape 腾讯私有 base64url 变体：+ → *、/ → -、= → _。
// 与官方 tls-sig-api-v2（node/go）实现保持一致，注意它并非标准 RFC4648 base64url。
func tencentBase64URLEscape(s string) string {
	s = strings.ReplaceAll(s, "+", "*")
	s = strings.ReplaceAll(s, "/", "-")
	s = strings.ReplaceAll(s, "=", "_")
	return s
}

// ---------- 运维观测（真机联调用） ----------

// mask 只保留末尾 4 位，避免泄露完整凭据
func mask(s string) string {
	if s == "" {
		return ""
	}
	if len(s) <= 8 {
		return "****"
	}
	return "****" + s[len(s)-4:]
}

// GET /api/v1/debug/env —— 环境自检：返回各项外部集成的「生效状态」
// 只暴露是否配置与脱敏尾号，绝不返回密钥明文。
func hDebugEnv(w http.ResponseWriter, r *http.Request) {
	mysqlOK := store != nil && store.sql != nil
	sendOK(w, map[string]interface{}{
		"mysql": map[string]interface{}{
			"enabled": mysqlOK,
			"dsn":     boolText(mysqlOK),
		},
		"trtc": map[string]interface{}{
			"enabled":  appCfg.TRTCAppID != 0 && appCfg.TRTCSecret != "",
			"sdkappid": appCfg.TRTCAppID,
			"secret":   boolText(appCfg.TRTCSecret != ""),
		},
		"wechat_login": map[string]interface{}{
			"enabled": appCfg.WXAppID != "" && appCfg.WXSecret != "",
			"appid":   mask(appCfg.WXAppID),
			"secret":  boolText(appCfg.WXSecret != ""),
		},
		"wechat_pay": map[string]interface{}{
			"enabled":     appCfg.WXPayMchID != "" && appCfg.WXPayPrivateKey != "",
			"mchid":       mask(appCfg.WXPayMchID),
			"serial":      mask(appCfg.WXPaySerial),
			"apiv3_key":   boolText(appCfg.WXPayAPIv3Key != ""),
			"private_key": boolText(appCfg.WXPayPrivateKey != ""),
			"notify_url":  appCfg.WXPayNotifyURL,
		},
		"jwt": map[string]interface{}{
			"custom_secret": appCfg.JWTSecret != "",
		},
		"free_call": appCfg.FreeCall,
	})
}

func boolText(b bool) string {
	if b {
		return "已配置"
	}
	return "未配置（走演示兜底）"
}

// GET /api/v1/admin/users —— 用户列表（含 H号/头像/余额 + 通话/消费/充值聚合统计）
func hAdminUsers(w http.ResponseWriter, r *http.Request) {
	_, ok := requireAdmin(r)
	if !ok {
		fail(w, "无权限")
		return
	}
	store.mu.Lock()
	defer store.mu.Unlock()

	// 聚合：通话次数 + 消费总额（已结束的通话扣费）
	callCount := map[int64]int{}
	spent := map[int64]float64{}
	for _, c := range store.db.Calls {
		callCount[c.UserID]++
		if c.Status == 1 {
			spent[c.UserID] += c.Amount
		}
	}
	// 聚合：充值次数 + 充值总额（已支付）
	rechargeCount := map[int64]int{}
	recharged := map[int64]float64{}
	for _, o := range store.db.Recharges {
		rechargeCount[o.UserID]++
		if o.PayStatus == 1 {
			recharged[o.UserID] += o.Amount
		}
	}

	// 搜索：按 H号 / 昵称 / 手机号 / openid 模糊匹配
	keyword := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("keyword")))

	list := make([]map[string]interface{}, 0, len(store.db.Users))
	for _, u := range store.db.Users {
		if keyword != "" {
			hay := strings.ToLower(u.HNo + " " + u.Nickname + " " + u.Phone + " " + u.Openid)
			if !strings.Contains(hay, keyword) {
				continue
			}
		}
		list = append(list, map[string]interface{}{
			"id":              u.ID,
			"h_no":            u.HNo,
			"openid":          u.Openid,
			"unionid":         u.Unionid,
			"is_real_wx":      !strings.HasPrefix(u.Openid, "openid_"),
			"nickname":        u.Nickname,
			"avatar":          u.Avatar,
			"phone":           u.Phone,
			"balance":         u.Balance,
			"frozen":          u.Frozen,
			"status":          u.Status,
			"call_count":      callCount[u.ID],
			"total_spent":     round2(spent[u.ID]),
			"recharge_count":  rechargeCount[u.ID],
			"total_recharged": round2(recharged[u.ID]),
			"created_at":      u.CreatedAt,
		})
	}
	// 按注册时间倒序，最新的排前面，方便找刚扫码登录的用户
	sort.Slice(list, func(i, j int) bool {
		return list[i]["created_at"].(int64) > list[j]["created_at"].(int64)
	})
	respList(w, list, r)
}

// GET /api/v1/admin/users/:id —— 单个用户详情（基本信息 + 通话/消费/充值记录）
func hAdminUserDetail(w http.ResponseWriter, r *http.Request, params map[string]string) {
	_, ok := requireAdmin(r)
	if !ok {
		fail(w, "无权限")
		return
	}
	id, _ := strconv.ParseInt(params["id"], 10, 64)
	store.mu.Lock()
	defer store.mu.Unlock()

	u, ok := store.db.Users[id]
	if !ok {
		fail(w, "用户不存在")
		return
	}

	// 通话记录（也是消费来源）
	calls := []map[string]interface{}{}
	for _, c := range store.db.Calls {
		if c.UserID != id {
			continue
		}
		calls = append(calls, map[string]interface{}{
			"id": c.ID, "call_type": c.CallType, "duration": c.Duration,
			"amount": c.Amount, "amount_coins": round2(c.Amount * coinRate()),
			"status":        c.Status,
			"provider_name": store.db.Providers[c.ProviderID].RealName,
			"created_at":    c.CreatedAt,
		})
	}
	sort.Slice(calls, func(i, j int) bool { return calls[i]["created_at"].(int64) > calls[j]["created_at"].(int64) })

	// 充值记录
	recharges := []map[string]interface{}{}
	for _, o := range store.db.Recharges {
		if o.UserID != id {
			continue
		}
		recharges = append(recharges, map[string]interface{}{
			"order_no": o.OrderNo, "amount": o.Amount, "pay_status": o.PayStatus,
			"pay_time": o.PayTime, "created_at": o.CreatedAt,
		})
	}
	sort.Slice(recharges, func(i, j int) bool { return recharges[i]["created_at"].(int64) > recharges[j]["created_at"].(int64) })

	sendOK(w, map[string]interface{}{
		"user": map[string]interface{}{
			"id": u.ID, "h_no": u.HNo, "nickname": u.Nickname, "avatar": u.Avatar,
			"phone": u.Phone, "openid": u.Openid, "balance": u.Balance, "frozen": u.Frozen,
			"status": u.Status, "created_at": u.CreatedAt,
		},
		"calls":     calls,
		"recharges": recharges,
	})
}

// ---------- 管理员管理（仅超级管理员 super 可操作）----------

// GET /api/v1/admin/admins —— 管理员列表
func hAdminAdmins(w http.ResponseWriter, r *http.Request) {
	if !requireSuper(r) {
		fail(w, "仅超级管理员可访问")
		return
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	list := make([]map[string]interface{}, 0, len(store.db.Admins))
	for _, a := range store.db.Admins {
		list = append(list, map[string]interface{}{
			"id": a.ID, "username": a.Username, "real_name": a.RealName,
			"role": a.Role, "status": a.Status, "last_login_at": a.LastLogin,
			"created_at": a.CreatedAt,
		})
	}
	sort.Slice(list, func(i, j int) bool { return list[i]["id"].(int64) < list[j]["id"].(int64) })
	sendOK(w, map[string]interface{}{"total": len(list), "list": list})
}

// POST /api/v1/admin/admins —— 新增管理员
func hAdminAdminCreate(w http.ResponseWriter, r *http.Request) {
	if !requireSuper(r) {
		fail(w, "仅超级管理员可操作")
		return
	}
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
		RealName string `json:"real_name"`
		Role     string `json:"role"` // super/operator/finance
	}
	readJSON(r, &body)
	if body.Username == "" || body.Password == "" {
		fail(w, "账号和密码必填")
		return
	}
	if body.Role != "super" && body.Role != "operator" && body.Role != "finance" {
		fail(w, "角色必须是 super/operator/finance")
		return
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	for _, a := range store.db.Admins {
		if a.Username == body.Username {
			fail(w, "账号已存在")
			return
		}
	}
	store.db.SeqAdmin++
	ad := &Admin{
		ID: store.db.SeqAdmin, Username: body.Username, Password: sha256hex(body.Password),
		RealName: body.RealName, Role: body.Role, Status: 1, CreatedAt: now(), UpdatedAt: now(),
	}
	store.db.Admins[ad.ID] = ad
	store.save()
	sendOK(w, map[string]interface{}{"id": ad.ID})
}

// PUT /api/v1/admin/admins/:id —— 更新角色/状态/密码
func hAdminAdminUpdate(w http.ResponseWriter, r *http.Request, params map[string]string) {
	if !requireSuper(r) {
		fail(w, "仅超级管理员可操作")
		return
	}
	id, _ := strconv.ParseInt(params["id"], 10, 64)
	var body struct {
		RealName string `json:"real_name"`
		Role     string `json:"role"`
		Status   int    `json:"status"`   // 1启用 3禁用
		Password string `json:"password"` // 非空则重置密码
	}
	readJSON(r, &body)
	store.mu.Lock()
	defer store.mu.Unlock()
	a, ok := store.db.Admins[id]
	if !ok {
		fail(w, "管理员不存在")
		return
	}
	if body.Role != "" && body.Role != "super" && body.Role != "operator" && body.Role != "finance" {
		fail(w, "角色必须是 super/operator/finance")
		return
	}
	if body.Role != "" {
		a.Role = body.Role
	}
	if body.RealName != "" {
		a.RealName = body.RealName
	}
	if body.Status == 1 || body.Status == 3 {
		a.Status = body.Status
	}
	if body.Password != "" {
		a.Password = sha256hex(body.Password)
	}
	a.UpdatedAt = now()
	store.save()
	sendOK(w, map[string]interface{}{"id": a.ID, "role": a.Role, "status": a.Status})
}
