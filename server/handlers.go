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
	}
	return &cp
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
		// TUICallKit 初始化所需凭据：前端据此 init 后即可收发通话邀请
		"im": map[string]interface{}{
			"sdk_app_id": appCfg.TRTCAppID,
			"user_id":    imUserID(uid),
			"user_sig":   generateUserSig(imUserID(uid)),
		},
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
	// 历史评价
	ratings := []map[string]interface{}{}
	for _, c := range store.db.Calls {
		if c.ProviderID == id && c.UserRating > 0 {
			ratings = append(ratings, map[string]interface{}{
				"rating": c.UserRating, "comment": c.UserComment, "user_name": store.db.Users[c.UserID].Nickname,
			})
		}
	}
	sendOK(w, map[string]interface{}{"provider": dp, "ratings": ratings})
}

// ---------- 呼叫（核心）----------

func hCallInvite(w http.ResponseWriter, r *http.Request) {
	uid, ok := requireUser(r)
	if !ok {
		fail(w, "未登录")
		return
	}
	var body struct {
		ProviderID int64 `json:"provider_id"`
		CallType   int   `json:"call_type"`
	}
	readJSON(r, &body)
	if body.CallType != 1 && body.CallType != 2 {
		body.CallType = 1
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
	u := store.db.Users[uid]
	if u.Balance < store.db.Config.MinBalance {
		fail(w, fmt.Sprintf("余额不足，至少需 %.2f 元", store.db.Config.MinBalance))
		return
	}
	// 冻结 3 分钟费用
	u.Balance -= store.db.Config.MinBalance
	u.Frozen += store.db.Config.MinBalance
	p.IsBusy = 1

	// 计费单价：语音=基础价；视频=基础价×加价倍率（四舍五入到分）
	unitPrice := p.PricePerMinute
	if body.CallType == 2 {
		rate := store.db.Config.VideoRate
		if rate <= 0 {
			rate = 1.5
		}
		unitPrice = float64(int(p.PricePerMinute*rate*100+0.5)) / 100
	}

	store.db.SeqCall++
	seq := store.db.SeqCall
	roomID := fmt.Sprintf("call_%d_%d", now(), body.ProviderID)
	rec := &CallRecord{
		ID: seq, UserID: uid, ProviderID: body.ProviderID, RoomID: roomID,
		CallType: body.CallType, StartTime: now(), UnitPrice: unitPrice,
		Status: 0, CreatedAt: now(), UpdatedAt: now(),
	}
	store.db.Calls[rec.ID] = rec

	// IM 身份：统一使用 hearcup_{uid} 单一身份（不再区分 user_/provider_ 前缀）。
	// TUICallKit 依据此 userID 完成「在线→信令直发 / 离线→推送触达」的自动路由。
	callerID := imUserID(uid)
	calleeID := imUserID(p.UserID)

	// TUICallKit 的 roomID 必须是 1~2147483647 的数字，与业务字符串 room_id 并存：
	// 前者给 SDK 用（音视频房间），后者给本服务用（计费关联主键）。
	trtcRoomID := 1000000 + int(seq)
	store.save()
	sendOK(w, map[string]interface{}{
		// —— 业务侧（计费关联）——
		"room_id": roomID,
		"call_id": seq,
		// —— TUICallKit 侧 ——
		"sdk_app_id":        appCfg.TRTCAppID,
		"trtc_room_id":      trtcRoomID,
		"caller_im_user_id": callerID,
		"caller_im_sig":     generateUserSig(callerID),
		"callee_im_user_id": calleeID,
		// 通话参数
		"call_type":        body.CallType,
		"timeout":          callInviteTimeout,
		"unit_price":       unitPrice,
		"unit_price_coins": round2(unitPrice * coinRate()),
		"coin_name":        coinName(),
		// 被叫展示信息（来电 UI 用）
		"callee_nickname": p.RealName,
		"callee_avatar":   p.Avatar,
	})
}

// callInviteTimeout 呼叫邀请超时时间（秒）。主叫侧 TUICallKit 与服务端兜底校验共用此值。
const callInviteTimeout = 60

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

	// 未被接听的终态：解冻主叫余额 + 释放被叫忙碌
	if kind == "reject" || kind == "cancel" || kind == "miss" {
		if rec.Status == 0 {
			u := store.db.Users[rec.UserID]
			if u != nil && u.Frozen >= store.db.Config.MinBalance {
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
			"user_rating": c.UserRating, "provider_name": store.db.Providers[c.ProviderID].RealName,
			"user_name": store.db.Users[c.UserID].Nickname, "created_at": c.CreatedAt,
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
	var body Provider
	readJSON(r, &body)
	body.Role = 1 // 统一「倾听者」，不再区分倾听师/咨询师
	if body.RealName == "" || body.Phone == "" || body.Intro == "" || body.Expertise == "" {
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
	// 单价下放到服务者，默认 10 H币/分 = 1 元/分（可在后台服务者管理中调整）
	price := 1.0
	p := &Provider{
		ID: store.db.SeqProvider, UserID: uid, Role: 1, RealName: body.RealName,
		IDCard: body.IDCard, Phone: body.Phone, Intro: body.Intro, Expertise: body.Expertise,
		Certificates: body.Certificates, TrainingProof: body.TrainingProof,
		CertificateNo: body.CertificateNo, CertificateImage: body.CertificateImage,
		YearsOfExp: body.YearsOfExp, Background: body.Background,
		PricePerMinute: price, Level: 1, IsOnline: 0, IsBusy: 0, Rating: 0,
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
	store.mu.Lock()
	defer store.mu.Unlock()
	list := []*Provider{}
	for _, p := range store.db.Providers {
		list = append(list, decorateProvider(p))
	}
	sendOK(w, list)
}

func hAdminApplications(w http.ResponseWriter, r *http.Request) {
	_, ok := requireAdmin(r)
	if !ok {
		fail(w, "无权限")
		return
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	list := []*Provider{}
	for _, p := range store.db.Providers {
		if p.Status == 0 {
			list = append(list, decorateProvider(p))
		}
	}
	sendOK(w, list)
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
	store.mu.Lock()
	defer store.mu.Unlock()
	list := []map[string]interface{}{}
	for _, c := range store.db.Calls {
		list = append(list, map[string]interface{}{
			"id": c.ID, "user_name": store.db.Users[c.UserID].Nickname,
			"provider_name": store.db.Providers[c.ProviderID].RealName,
			"call_type":     c.CallType, "duration": c.Duration, "amount": c.Amount,
			"provider_income": c.ProviderIncome, "platform_fee": c.PlatformFee,
			"status": c.Status, "created_at": c.CreatedAt,
		})
	}
	sendOK(w, list)
}

func hAdminRecharge(w http.ResponseWriter, r *http.Request) {
	_, ok := requireAdmin(r)
	if !ok {
		fail(w, "无权限")
		return
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	list := []map[string]interface{}{}
	for _, o := range store.db.Recharges {
		list = append(list, map[string]interface{}{
			"order_no": o.OrderNo, "user_name": store.db.Users[o.UserID].Nickname,
			"amount": o.Amount, "pay_status": o.PayStatus, "pay_time": o.PayTime,
		})
	}
	sendOK(w, list)
}

func hAdminWithdraws(w http.ResponseWriter, r *http.Request) {
	_, ok := requireAdmin(r)
	if !ok {
		fail(w, "无权限")
		return
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	list := []map[string]interface{}{}
	for _, wd := range store.db.Withdraws {
		list = append(list, map[string]interface{}{
			"id": wd.ID, "provider_name": store.db.Providers[wd.ProviderID].RealName,
			"amount": wd.Amount, "status": wd.Status, "created_at": wd.CreatedAt,
		})
	}
	sendOK(w, list)
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
	store.mu.Lock()
	defer store.mu.Unlock()
	wd, ok := store.db.Withdraws[id]
	if !ok {
		fail(w, "提现记录不存在")
		return
	}
	wd.Status = body.Status
	wd.Remark = body.Remark
	t := now()
	if body.Status == 1 {
		wd.ApprovedAt = t
	} else if body.Status == 2 {
		wd.PaidAt = t
	} else if body.Status == 3 {
		// 拒绝：退还可提现
		if p, ok := store.db.Providers[wd.ProviderID]; ok {
			p.Withdrawable += wd.Amount
		}
	}
	wd.UpdatedAt = t
	store.save()
	sendOK(w, map[string]interface{}{"status": wd.Status})
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
	sendOK(w, map[string]interface{}{"total": len(list), "list": list})
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
