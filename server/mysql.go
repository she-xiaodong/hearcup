package main

import (
	"database/sql"
	"fmt"
	"strconv"
	"strings"

	_ "github.com/go-sql-driver/mysql"
)

// 打开 MySQL；DSN 为空或连不上时返回 nil（调用方回退到 JSON 文件）。
func openMySQL(dsn string) *sql.DB {
	if dsn == "" {
		return nil
	}
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		fmt.Println("[mysql] 打开失败:", err)
		return nil
	}
	if err := db.Ping(); err != nil {
		fmt.Println("[mysql] 连接失败（回退 JSON）:", err)
		_ = db.Close()
		return nil
	}
	if err := ensureSchema(db); err != nil {
		fmt.Println("[mysql] 建表失败:", err)
		_ = db.Close()
		return nil
	}
	fmt.Println("[mysql] 已连接并初始化")
	return db
}

func ensureSchema(db *sql.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id BIGINT PRIMARY KEY, openid VARCHAR(128), unionid VARCHAR(128),
			phone VARCHAR(32), h_no VARCHAR(16), nickname VARCHAR(64), avatar MEDIUMTEXT,
			gender INT, balance DOUBLE, frozen_balance DOUBLE, status INT,
			created_at BIGINT, updated_at BIGINT)`,
		`CREATE TABLE IF NOT EXISTS providers (
			id BIGINT PRIMARY KEY, user_id BIGINT, role INT, real_name VARCHAR(64),
			gender INT, age INT, city VARCHAR(64), education VARCHAR(32), major VARCHAR(64),
			id_card VARCHAR(64), phone VARCHAR(32), intro TEXT, expertise VARCHAR(128),
			certificates VARCHAR(512), training_proof VARCHAR(512), certificate_no VARCHAR(128),
			certificate_image VARCHAR(512), education_image VARCHAR(512), counselor_image VARCHAR(512),
			years_of_exp INT, consult_hours INT, background VARCHAR(256),
			price_per_minute DOUBLE, price_tiers TEXT, level INT, is_online INT, is_busy INT,
			rating DOUBLE, total_sessions INT, total_earnings DOUBLE, withdrawable DOUBLE,
			daily_limit INT, today_sessions INT, status INT, reject_reason VARCHAR(256),
			approved_at BIGINT, created_at BIGINT, updated_at BIGINT)`,
		`CREATE TABLE IF NOT EXISTS recharges (
			id BIGINT PRIMARY KEY, user_id BIGINT, order_no VARCHAR(64), amount DOUBLE,
			pay_status INT, transaction_id VARCHAR(64), pay_time BIGINT,
			created_at BIGINT, updated_at BIGINT)`,
		`CREATE TABLE IF NOT EXISTS calls (
			id BIGINT PRIMARY KEY, user_id BIGINT, provider_id BIGINT, room_id VARCHAR(128),
			call_type INT, start_time BIGINT, end_time BIGINT, duration INT,
			unit_price DOUBLE, amount DOUBLE, provider_income DOUBLE, platform_fee DOUBLE,
			status INT, user_rating INT, user_comment TEXT,
			order_no VARCHAR(64), pay_status INT, package_minutes INT, pay_time BIGINT,
			created_at BIGINT, updated_at BIGINT)`,
		`CREATE TABLE IF NOT EXISTS withdraws (
			id BIGINT PRIMARY KEY, provider_id BIGINT, amount DOUBLE, fee DOUBLE, method INT,
			openid VARCHAR(128), status INT, remark VARCHAR(256), approved_at BIGINT,
			paid_at BIGINT, created_at BIGINT, updated_at BIGINT)`,
		`CREATE TABLE IF NOT EXISTS tags (
			id INT PRIMARY KEY, name VARCHAR(32), icon VARCHAR(256), sort INT)`,
		`CREATE TABLE IF NOT EXISTS admins (
			id BIGINT PRIMARY KEY, username VARCHAR(64), password VARCHAR(128),
			real_name VARCHAR(64), phone VARCHAR(24), role VARCHAR(32), status INT,
			last_login_at BIGINT, created_at BIGINT, updated_at BIGINT)`,
		`CREATE TABLE IF NOT EXISTS feedbacks (
			id BIGINT PRIMARY KEY, user_id BIGINT, content TEXT, contact VARCHAR(128),
			created_at BIGINT)`,
		`CREATE TABLE IF NOT EXISTS notifications (
			id BIGINT PRIMARY KEY, title VARCHAR(128), content TEXT,
			target VARCHAR(16), status INT, created_at BIGINT,
			updated_at BIGINT, published_at BIGINT)`,
		`CREATE TABLE IF NOT EXISTS transfers (
			id BIGINT PRIMARY KEY, withdraw_id BIGINT, provider_id BIGINT,
			provider_name VARCHAR(64), openid VARCHAR(128), amount DOUBLE,
			out_bill_no VARCHAR(64), wx_bill_no VARCHAR(64), state VARCHAR(32),
			status INT, fail_reason VARCHAR(512), remark VARCHAR(256),
			package_info TEXT,
			created_at BIGINT, updated_at BIGINT)`,
		`CREATE TABLE IF NOT EXISTS t_config (
			id INT PRIMARY KEY, price_listener DOUBLE, price_counselor DOUBLE,
			platform_rate DOUBLE, min_balance DOUBLE, overdraft DOUBLE, min_withdraw DOUBLE)`,
	}
	for _, s := range stmts {
		// 该 MySQL 实例 MyISAM 引擎异常（建表报 Incorrect file format 并断开连接），
		// 强制使用 InnoDB 规避。
		s = strings.TrimRight(s, " \n\t") + " ENGINE=InnoDB"
		if _, err := db.Exec(s); err != nil {
			return err
		}
	}
	// 迁移：旧库 t_config 补 video_rate 列（列已存在时报错直接忽略，幂等）
	_, _ = db.Exec("ALTER TABLE t_config ADD COLUMN video_rate DOUBLE DEFAULT 1.5")
	// 迁移：虚拟币换算配置（coin_rate 默认 10：1元=10 H币；coin_name 默认「H币」）
	_, _ = db.Exec("ALTER TABLE t_config ADD COLUMN coin_rate DOUBLE DEFAULT 10")
	_, _ = db.Exec("ALTER TABLE t_config ADD COLUMN coin_name VARCHAR(32) DEFAULT 'H币'")
	// 旧数据「心晴币」→「H币」（幂等）
	_, _ = db.Exec("UPDATE t_config SET coin_name='H币' WHERE coin_name='心晴币'")
	// 迁移：用户 H号（旧库补 h_no 列）
	_, _ = db.Exec("ALTER TABLE users ADD COLUMN h_no VARCHAR(16)")
	// 迁移：管理员手机号（找回密码用，旧库补 phone 列）
	_, _ = db.Exec("ALTER TABLE admins ADD COLUMN phone VARCHAR(24)")
	// 迁移：清理 v1.6 临时加的银行卡列（改为微信零钱提现，不再用银行卡）
	_, _ = db.Exec("ALTER TABLE providers DROP COLUMN bank_account_name")
	_, _ = db.Exec("ALTER TABLE providers DROP COLUMN bank_card_no")
	_, _ = db.Exec("ALTER TABLE providers DROP COLUMN bank_name")
	_, _ = db.Exec("ALTER TABLE providers DROP COLUMN bank_branch")
	// 迁移：头像扩容为 MEDIUMTEXT（存 base64 data URI）
	_, _ = db.Exec("ALTER TABLE users MODIFY avatar MEDIUMTEXT")
	// 迁移：倾听师新增字段（性别、年龄、城市、学历、专业、证书图片、价格档位、咨询时长）
	_, _ = db.Exec("ALTER TABLE providers ADD COLUMN gender INT DEFAULT 0")
	_, _ = db.Exec("ALTER TABLE providers ADD COLUMN age INT DEFAULT 0")
	_, _ = db.Exec("ALTER TABLE providers ADD COLUMN city VARCHAR(64)")
	_, _ = db.Exec("ALTER TABLE providers ADD COLUMN education VARCHAR(32)")
	_, _ = db.Exec("ALTER TABLE providers ADD COLUMN major VARCHAR(64)")
	_, _ = db.Exec("ALTER TABLE providers ADD COLUMN education_image VARCHAR(512)")
	_, _ = db.Exec("ALTER TABLE providers ADD COLUMN counselor_image VARCHAR(512)")
	_, _ = db.Exec("ALTER TABLE providers ADD COLUMN price_tiers TEXT")
	_, _ = db.Exec("ALTER TABLE providers ADD COLUMN consult_hours INT DEFAULT 0")
	// 迁移：通话订单套餐预付制（先下单支付，再拨号）
	_, _ = db.Exec("ALTER TABLE calls ADD COLUMN order_no VARCHAR(64)")
	_, _ = db.Exec("ALTER TABLE calls ADD COLUMN pay_status INT DEFAULT 0")
	_, _ = db.Exec("ALTER TABLE calls ADD COLUMN package_minutes INT DEFAULT 0")
	_, _ = db.Exec("ALTER TABLE calls ADD COLUMN pay_time BIGINT DEFAULT 0")
	// 迁移：为历史倾听师补齐默认价格档位（15~120 分钟，按单价 1 元/分打 9 折）
	_, _ = db.Exec("UPDATE providers SET price_tiers='{\"15\":15.0,\"30\":28.5,\"45\":40.5,\"60\":54.0,\"75\":67.5,\"90\":81.0,\"105\":94.5,\"120\":108.0}' WHERE price_tiers IS NULL OR price_tiers=''")
	// 迁移：提现单关联微信转账单号与状态（商家转账到零钱）
	_, _ = db.Exec("ALTER TABLE withdraws ADD COLUMN transfer_no VARCHAR(64)")
	_, _ = db.Exec("ALTER TABLE withdraws ADD COLUMN transfer_state VARCHAR(32)")
	_, _ = db.Exec("ALTER TABLE transfers ADD COLUMN package_info TEXT")
	return nil
}

func replaceRows(db *sql.DB, table string, cols []string, rows [][]interface{}) error {
	if len(rows) == 0 {
		return nil
	}
	ph := strings.Repeat("?,", len(cols))
	ph = ph[:len(ph)-1]
	q := fmt.Sprintf("REPLACE INTO %s (%s) VALUES (%s)", table, strings.Join(cols, ","), ph)
	for _, r := range rows {
		if _, err := db.Exec(q, r...); err != nil {
			return err
		}
	}
	return nil
}

// 把内存数据全量写回 MySQL（REPLACE=按主键删除再插，幂等）。数据量小，MVP 够用。
func (s *Store) persistMySQL() {
	if s.sql == nil {
		return
	}
	db := s.db
	// users
	urows := [][]interface{}{}
	for _, u := range db.Users {
		urows = append(urows, []interface{}{u.ID, u.Openid, u.Unionid, u.Phone, u.HNo, u.Nickname, u.Avatar, u.Gender, u.Balance, u.Frozen, u.Status, u.CreatedAt, u.UpdatedAt})
	}
	_ = replaceRows(s.sql, "users", []string{"id", "openid", "unionid", "phone", "h_no", "nickname", "avatar", "gender", "balance", "frozen_balance", "status", "created_at", "updated_at"}, urows)

	// providers
	prows := [][]interface{}{}
	for _, p := range db.Providers {
		prows = append(prows, []interface{}{p.ID, p.UserID, p.Role, p.RealName, p.Gender, p.Age, p.City, p.Education, p.Major, p.IDCard, p.Phone, p.Intro, p.Expertise, p.Certificates, p.TrainingProof, p.CertificateNo, p.CertificateImage, p.EducationImage, p.CounselorImage, p.YearsOfExp, p.ConsultHours, p.Background, p.PricePerMinute, p.PriceTiers, p.Level, p.IsOnline, p.IsBusy, p.Rating, p.TotalSessions, p.TotalEarnings, p.Withdrawable, p.DailyLimit, p.TodaySessions, p.Status, p.RejectReason, p.ApprovedAt, p.CreatedAt, p.UpdatedAt})
	}
	_ = replaceRows(s.sql, "providers", []string{"id", "user_id", "role", "real_name", "gender", "age", "city", "education", "major", "id_card", "phone", "intro", "expertise", "certificates", "training_proof", "certificate_no", "certificate_image", "education_image", "counselor_image", "years_of_exp", "consult_hours", "background", "price_per_minute", "price_tiers", "level", "is_online", "is_busy", "rating", "total_sessions", "total_earnings", "withdrawable", "daily_limit", "today_sessions", "status", "reject_reason", "approved_at", "created_at", "updated_at"}, prows)

	// recharges
	rrows := [][]interface{}{}
	for _, o := range db.Recharges {
		rrows = append(rrows, []interface{}{o.ID, o.UserID, o.OrderNo, o.Amount, o.PayStatus, o.TransactionID, o.PayTime, o.CreatedAt, o.UpdatedAt})
	}
	_ = replaceRows(s.sql, "recharges", []string{"id", "user_id", "order_no", "amount", "pay_status", "transaction_id", "pay_time", "created_at", "updated_at"}, rrows)

	// calls
	crows := [][]interface{}{}
	for _, c := range db.Calls {
		crows = append(crows, []interface{}{c.ID, c.UserID, c.ProviderID, c.RoomID, c.CallType, c.StartTime, c.EndTime, c.Duration, c.UnitPrice, c.Amount, c.ProviderIncome, c.PlatformFee, c.Status, c.UserRating, c.UserComment, c.OrderNo, c.PayStatus, c.PackageMinutes, c.PayTime, c.CreatedAt, c.UpdatedAt})
	}
	_ = replaceRows(s.sql, "calls", []string{"id", "user_id", "provider_id", "room_id", "call_type", "start_time", "end_time", "duration", "unit_price", "amount", "provider_income", "platform_fee", "status", "user_rating", "user_comment", "order_no", "pay_status", "package_minutes", "pay_time", "created_at", "updated_at"}, crows)

	// withdraws
	wrows := [][]interface{}{}
	for _, w := range db.Withdraws {
		wrows = append(wrows, []interface{}{w.ID, w.ProviderID, w.Amount, w.Fee, w.Method, w.Openid, w.Status, w.Remark, w.ApprovedAt, w.PaidAt, w.CreatedAt, w.UpdatedAt})
	}
	_ = replaceRows(s.sql, "withdraws", []string{"id", "provider_id", "amount", "fee", "method", "openid", "status", "remark", "approved_at", "paid_at", "created_at", "updated_at"}, wrows)

	// tags
	trows := [][]interface{}{}
	for _, t := range db.Tags {
		trows = append(trows, []interface{}{t.ID, t.Name, t.Icon, t.Sort})
	}
	_ = replaceRows(s.sql, "tags", []string{"id", "name", "icon", "sort"}, trows)

	// admins
	arows := [][]interface{}{}
	for _, a := range db.Admins {
		arows = append(arows, []interface{}{a.ID, a.Username, a.Password, a.RealName, a.Phone, a.Role, a.Status, a.LastLogin, a.CreatedAt, a.UpdatedAt})
	}
	_ = replaceRows(s.sql, "admins", []string{"id", "username", "password", "real_name", "phone", "role", "status", "last_login_at", "created_at", "updated_at"}, arows)

	// feedbacks
	frows := [][]interface{}{}
	for _, f := range db.Feedbacks {
		frows = append(frows, []interface{}{f.ID, f.UserID, f.Content, f.Contact, f.CreatedAt})
	}
	_ = replaceRows(s.sql, "feedbacks", []string{"id", "user_id", "content", "contact", "created_at"}, frows)

	// notifications
	nrows := [][]interface{}{}
	for _, n := range db.Notifications {
		nrows = append(nrows, []interface{}{n.ID, n.Title, n.Content, n.Target, n.Status, n.CreatedAt, n.UpdatedAt, n.PublishedAt})
	}
	_ = replaceRows(s.sql, "notifications", []string{"id", "title", "content", "target", "status", "created_at", "updated_at", "published_at"}, nrows)

	// transfers（商家转账到零钱记录）
	trows2 := [][]interface{}{}
	for _, t := range db.Transfers {
		trows2 = append(trows2, []interface{}{t.ID, t.WithdrawID, t.ProviderID, t.ProviderName, t.Openid, t.Amount, t.OutBillNo, t.WxBillNo, t.State, t.Status, t.FailReason, t.Remark, t.PackageInfo, t.CreatedAt, t.UpdatedAt})
	}
	_ = replaceRows(s.sql, "transfers", []string{"id", "withdraw_id", "provider_id", "provider_name", "openid", "amount", "out_bill_no", "wx_bill_no", "state", "status", "fail_reason", "remark", "package_info", "created_at", "updated_at"}, trows2)

	// config
	vr := db.Config.VideoRate
	if vr <= 0 {
		vr = 1.5
	}
	cr := db.Config.CoinRate
	if cr <= 0 {
		cr = 10
	}
	cn := db.Config.CoinName
	if cn == "" {
		cn = "H币"
	}
	_ = replaceRows(s.sql, "t_config", []string{"id", "price_listener", "price_counselor", "video_rate", "coin_rate", "coin_name", "platform_rate", "min_balance", "overdraft", "min_withdraw"},
		[][]interface{}{{1, db.Config.PriceListener, db.Config.PriceCounselor, vr, cr, cn, db.Config.PlatformRate, db.Config.MinBalance, db.Config.Overdraft, db.Config.MinWithdraw}})
}

// 从 MySQL 载入内存。若表为空，返回 false（调用方负责 seed）。
func (s *Store) loadFromMySQL() bool {
	if s.sql == nil {
		return false
	}
	db := s.sql
	// users
	urows, err := db.Query("SELECT id,openid,unionid,phone,h_no,nickname,avatar,gender,balance,frozen_balance,status,created_at,updated_at FROM users")
	if err != nil {
		return false
	}
	var maxU int64
	for urows.Next() {
		u := &User{}
		_ = urows.Scan(&u.ID, &u.Openid, &u.Unionid, &u.Phone, &u.HNo, &u.Nickname, &u.Avatar, &u.Gender, &u.Balance, &u.Frozen, &u.Status, &u.CreatedAt, &u.UpdatedAt)
		s.db.Users[u.ID] = u
		maxU = max64(maxU, u.ID)
	}
	urows.Close()
	if maxU == 0 {
		return false // 空库，需要 seed
	}
	s.db.SeqUser = maxU

	// providers
	prows, _ := db.Query("SELECT id,user_id,role,real_name,gender,age,city,education,major,id_card,phone,intro,expertise,certificates,training_proof,certificate_no,certificate_image,education_image,counselor_image,years_of_exp,consult_hours,background,price_per_minute,price_tiers,level,is_online,is_busy,rating,total_sessions,total_earnings,withdrawable,daily_limit,today_sessions,status,reject_reason,approved_at,created_at,updated_at FROM providers")
	var maxP int64
	for prows.Next() {
		p := &Provider{}
		_ = prows.Scan(&p.ID, &p.UserID, &p.Role, &p.RealName, &p.Gender, &p.Age, &p.City, &p.Education, &p.Major, &p.IDCard, &p.Phone, &p.Intro, &p.Expertise, &p.Certificates, &p.TrainingProof, &p.CertificateNo, &p.CertificateImage, &p.EducationImage, &p.CounselorImage, &p.YearsOfExp, &p.ConsultHours, &p.Background, &p.PricePerMinute, &p.PriceTiers, &p.Level, &p.IsOnline, &p.IsBusy, &p.Rating, &p.TotalSessions, &p.TotalEarnings, &p.Withdrawable, &p.DailyLimit, &p.TodaySessions, &p.Status, &p.RejectReason, &p.ApprovedAt, &p.CreatedAt, &p.UpdatedAt)
		s.db.Providers[p.ID] = p
		maxP = max64(maxP, p.ID)
	}
	prows.Close()
	s.db.SeqProvider = maxP

	// recharges
	rrows, _ := db.Query("SELECT id,user_id,order_no,amount,pay_status,transaction_id,pay_time,created_at,updated_at FROM recharges")
	var maxR int64
	for rrows.Next() {
		o := &RechargeOrder{}
		_ = rrows.Scan(&o.ID, &o.UserID, &o.OrderNo, &o.Amount, &o.PayStatus, &o.TransactionID, &o.PayTime, &o.CreatedAt, &o.UpdatedAt)
		s.db.Recharges[o.ID] = o
		maxR = max64(maxR, o.ID)
	}
	rrows.Close()
	s.db.SeqRecharge = maxR

	// calls
	crows, _ := db.Query("SELECT id,user_id,provider_id,room_id,call_type,start_time,end_time,duration,unit_price,amount,provider_income,platform_fee,status,user_rating,user_comment,order_no,pay_status,package_minutes,pay_time,created_at,updated_at FROM calls")
	var maxC int64
	for crows.Next() {
		c := &CallRecord{}
		_ = crows.Scan(&c.ID, &c.UserID, &c.ProviderID, &c.RoomID, &c.CallType, &c.StartTime, &c.EndTime, &c.Duration, &c.UnitPrice, &c.Amount, &c.ProviderIncome, &c.PlatformFee, &c.Status, &c.UserRating, &c.UserComment, &c.OrderNo, &c.PayStatus, &c.PackageMinutes, &c.PayTime, &c.CreatedAt, &c.UpdatedAt)
		s.db.Calls[c.ID] = c
		maxC = max64(maxC, c.ID)
	}
	crows.Close()
	s.db.SeqCall = maxC

	// withdraws
	wrows, _ := db.Query("SELECT id,provider_id,amount,fee,method,openid,status,remark,approved_at,paid_at,created_at,updated_at FROM withdraws")
	var maxW int64
	for wrows.Next() {
		w := &WithdrawRecord{}
		_ = wrows.Scan(&w.ID, &w.ProviderID, &w.Amount, &w.Fee, &w.Method, &w.Openid, &w.Status, &w.Remark, &w.ApprovedAt, &w.PaidAt, &w.CreatedAt, &w.UpdatedAt)
		s.db.Withdraws[w.ID] = w
		maxW = max64(maxW, w.ID)
	}
	wrows.Close()
	s.db.SeqWithdraw = maxW

	// tags
	trows, _ := db.Query("SELECT id,name,icon,sort FROM tags")
	var maxT int64
	for trows.Next() {
		t := &Tag{}
		_ = trows.Scan(&t.ID, &t.Name, &t.Icon, &t.Sort)
		s.db.Tags[int64(t.ID)] = t
		maxT = max64(maxT, int64(t.ID))
	}
	trows.Close()
	s.db.SeqTag = maxT

	// admins
	arows, _ := db.Query("SELECT id,username,password,real_name,phone,role,status,last_login_at,created_at,updated_at FROM admins")
	var maxA int64
	for arows.Next() {
		a := &Admin{}
		_ = arows.Scan(&a.ID, &a.Username, &a.Password, &a.RealName, &a.Phone, &a.Role, &a.Status, &a.LastLogin, &a.CreatedAt, &a.UpdatedAt)
		s.db.Admins[a.ID] = a
		maxA = max64(maxA, a.ID)
	}
	arows.Close()
	s.db.SeqAdmin = maxA

	// feedbacks
	fbrows, _ := db.Query("SELECT id,user_id,content,contact,created_at FROM feedbacks")
	var maxFb int64
	for fbrows.Next() {
		f := &Feedback{}
		_ = fbrows.Scan(&f.ID, &f.UserID, &f.Content, &f.Contact, &f.CreatedAt)
		s.db.Feedbacks[f.ID] = f
		maxFb = max64(maxFb, f.ID)
	}
	fbrows.Close()
	s.db.SeqFeedback = maxFb

	// notifications
	nrows, _ := db.Query("SELECT id,title,content,target,status,created_at,updated_at,published_at FROM notifications")
	var maxN int64
	for nrows.Next() {
		n := &Notification{}
		_ = nrows.Scan(&n.ID, &n.Title, &n.Content, &n.Target, &n.Status, &n.CreatedAt, &n.UpdatedAt, &n.PublishedAt)
		s.db.Notifications[n.ID] = n
		maxN = max64(maxN, n.ID)
	}
	nrows.Close()
	s.db.SeqNotification = maxN

	// transfers
	trows2, _ := db.Query("SELECT id,withdraw_id,provider_id,provider_name,openid,amount,out_bill_no,wx_bill_no,state,status,fail_reason,remark,package_info,created_at,updated_at FROM transfers")
	var maxTr int64
	for trows2.Next() {
		t := &TransferRecord{}
		_ = trows2.Scan(&t.ID, &t.WithdrawID, &t.ProviderID, &t.ProviderName, &t.Openid, &t.Amount, &t.OutBillNo, &t.WxBillNo, &t.State, &t.Status, &t.FailReason, &t.Remark, &t.PackageInfo, &t.CreatedAt, &t.UpdatedAt)
		s.db.Transfers[t.ID] = t
		maxTr = max64(maxTr, t.ID)
	}
	trows2.Close()
	s.db.SeqTransfer = maxTr

	// config（video_rate / coin_rate / coin_name 为后加列，扫描失败时保持默认值）
	var vr, cr float64
	var cn string
	if err := db.QueryRow("SELECT price_listener,price_counselor,video_rate,coin_rate,coin_name,platform_rate,min_balance,overdraft,min_withdraw FROM t_config WHERE id=1").
		Scan(&s.db.Config.PriceListener, &s.db.Config.PriceCounselor, &vr, &cr, &cn, &s.db.Config.PlatformRate, &s.db.Config.MinBalance, &s.db.Config.Overdraft, &s.db.Config.MinWithdraw); err == nil {
		if vr > 0 {
			s.db.Config.VideoRate = vr
		} else {
			s.db.Config.VideoRate = 1.5
		}
		if cr > 0 {
			s.db.Config.CoinRate = cr
		} else {
			s.db.Config.CoinRate = 10
		}
		if cn != "" {
			s.db.Config.CoinName = cn
		} else {
			s.db.Config.CoinName = "H币"
		}
	} else {
		_ = db.QueryRow("SELECT price_listener,price_counselor,platform_rate,min_balance,overdraft,min_withdraw FROM t_config WHERE id=1").
			Scan(&s.db.Config.PriceListener, &s.db.Config.PriceCounselor, &s.db.Config.PlatformRate, &s.db.Config.MinBalance, &s.db.Config.Overdraft, &s.db.Config.MinWithdraw)
		s.db.Config.VideoRate = 1.5
		s.db.Config.CoinRate = 10
		s.db.Config.CoinName = "H币"
	}

	return true
}

func max64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}

// 兼容：把字符串数字转 int64（保留备用）
func parseID(s string) int64 {
	v, _ := strconv.ParseInt(s, 10, 64)
	return v
}
