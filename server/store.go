package main

import (
	"database/sql"
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// ============ 数据模型（对应需求文档第四部分 7 张表）============

type User struct {
	ID       int64   `json:"id"`
	Openid   string  `json:"openid"`
	Unionid  string  `json:"unionid"`
	Phone    string  `json:"phone"`
	Nickname string  `json:"nickname"`
	Avatar   string  `json:"avatar"`
	Gender   int     `json:"gender"`
	Balance  float64 `json:"balance"`
	Frozen   float64 `json:"frozen_balance"`
	Status   int     `json:"status"`
	CreatedAt int64  `json:"created_at"`
	UpdatedAt int64  `json:"updated_at"`
}

type Provider struct {
	ID               int64   `json:"id"`
	UserID           int64   `json:"user_id"`
	Role             int     `json:"role"` // 1=倾听师 2=咨询师
	RealName         string  `json:"real_name"`
	IDCard           string  `json:"id_card"`
	Phone            string  `json:"phone"`
	Intro            string  `json:"intro"`
	Expertise        string  `json:"expertise"` // 逗号分隔 tag_id
	Certificates     string  `json:"certificates"`
	TrainingProof    string  `json:"training_proof"`
	CertificateNo    string  `json:"certificate_no"`
	CertificateImage string  `json:"certificate_image"`
	YearsOfExp       int     `json:"years_of_exp"`
	Background       string  `json:"background"`
	PricePerMinute   float64 `json:"price_per_minute"`
	Level            int     `json:"level"` // 1实习 2认证 3资深
	IsOnline         int     `json:"is_online"`
	IsBusy           int     `json:"is_busy"`
	Rating           float64 `json:"rating"`
	TotalSessions    int     `json:"total_sessions"`
	TotalEarnings    float64 `json:"total_earnings"`
	Withdrawable     float64 `json:"withdrawable"`
	DailyLimit       int     `json:"daily_limit"`
	TodaySessions    int     `json:"today_sessions"`
	Status           int     `json:"status"` // 0待审核 1通过 2拒绝 3禁用
	RejectReason     string  `json:"reject_reason"`
	ApprovedAt       int64   `json:"approved_at"`
	CreatedAt        int64   `json:"created_at"`
	UpdatedAt        int64   `json:"updated_at"`
	// 关联字段（不持久化）
	Nickname string `json:"nickname"`
	Avatar   string `json:"avatar"`
}

type RechargeOrder struct {
	ID            int64   `json:"id"`
	UserID        int64   `json:"user_id"`
	OrderNo       string  `json:"order_no"`
	Amount        float64 `json:"amount"`
	PayStatus     int     `json:"pay_status"` // 0待支付 1已支付 2已退款
	TransactionID string  `json:"transaction_id"`
	PayTime       int64   `json:"pay_time"`
	CreatedAt     int64   `json:"created_at"`
	UpdatedAt     int64   `json:"updated_at"`
}

type CallRecord struct {
	ID             int64   `json:"id"`
	UserID         int64   `json:"user_id"`
	ProviderID     int64   `json:"provider_id"`
	RoomID         string  `json:"room_id"`
	CallType       int     `json:"call_type"` // 1语音 2视频
	StartTime      int64   `json:"start_time"`
	EndTime        int64   `json:"end_time"`
	Duration       int     `json:"duration"` // 秒
	UnitPrice      float64 `json:"unit_price"`
	Amount         float64 `json:"amount"`
	ProviderIncome float64 `json:"provider_income"`
	PlatformFee    float64 `json:"platform_fee"`
	Status         int     `json:"status"` // 0进行中 1已结束 2异常中断
	UserRating     int     `json:"user_rating"`
	UserComment    string  `json:"user_comment"`
	CreatedAt      int64   `json:"created_at"`
	UpdatedAt      int64   `json:"updated_at"`
	// 关联字段
	ProviderName string `json:"provider_name"`
	UserName     string `json:"user_name"`
}

type WithdrawRecord struct {
	ID         int64   `json:"id"`
	ProviderID int64   `json:"provider_id"`
	Amount     float64 `json:"amount"`
	Fee        float64 `json:"fee"`
	Method     int     `json:"method"` // 1微信零钱
	Openid     string  `json:"openid"`
	Status     int     `json:"status"` // 0待审核 1审核通过 2已打款 3拒绝
	Remark     string  `json:"remark"`
	ApprovedAt int64   `json:"approved_at"`
	PaidAt     int64   `json:"paid_at"`
	CreatedAt  int64   `json:"created_at"`
	UpdatedAt  int64   `json:"updated_at"`
}

type Tag struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
	Icon string `json:"icon"`
	Sort int    `json:"sort"`
}

type Admin struct {
	ID        int64  `json:"id"`
	Username  string `json:"username"`
	Password  string `json:"password"` // sha256(plain)
	RealName  string `json:"real_name"`
	Role      string `json:"role"` // super/operator/finance
	Status    int    `json:"status"`
	LastLogin int64  `json:"last_login_at"`
	CreatedAt int64  `json:"created_at"`
	UpdatedAt int64  `json:"updated_at"`
}

// 平台费率配置（需求 6.1 / 3.3.5）
type Config struct {
	PriceListener  float64 `json:"price_listener"`  // 倾听师单价 1元/分
	PriceCounselor float64 `json:"price_counselor"` // 咨询师单价 2元/分
	PlatformRate   float64 `json:"platform_rate"`   // 平台抽成 0.2
	MinBalance     float64 `json:"min_balance"`      // 起呼最低余额 3元
	Overdraft      float64 `json:"overdraft"`        // 透支额度 2元
	MinWithdraw    float64 `json:"min_withdraw"`     // 最低提现 100元
}

// ============ 持久化存储 ============

type DB struct {
	Users     map[int64]*User          `json:"users"`
	Providers map[int64]*Provider      `json:"providers"`
	Recharges map[int64]*RechargeOrder `json:"recharges"`
	Calls     map[int64]*CallRecord    `json:"calls"`
	Withdraws map[int64]*WithdrawRecord `json:"withdraws"`
	Tags      map[int64]*Tag           `json:"tags"`
	Admins    map[int64]*Admin         `json:"admins"`
	SeqUser     int64 `json:"seq_user"`
	SeqProvider int64 `json:"seq_provider"`
	SeqRecharge int64 `json:"seq_recharge"`
	SeqCall     int64 `json:"seq_call"`
	SeqWithdraw int64 `json:"seq_withdraw"`
	SeqTag      int64 `json:"seq_tag"`
	SeqAdmin    int64 `json:"seq_admin"`
	Config     Config `json:"config"`
}

type Store struct {
	mu   sync.Mutex
	db   *DB
	path string
	sql  *sql.DB // MySQL 连接；nil 时回退 JSON 文件
}

var store *Store

func now() int64 { return time.Now().Unix() }

func (s *Store) save() {
	if s == nil || s.db == nil {
		return
	}
	b, err := json.MarshalIndent(s.db, "", "  ")
	if err == nil {
		_ = os.WriteFile(s.path, b, 0644)
	}
	s.persistMySQL()
}

func loadStore(path string) *Store {
	s := &Store{path: path, db: &DB{
		Users:     map[int64]*User{},
		Providers: map[int64]*Provider{},
		Recharges: map[int64]*RechargeOrder{},
		Calls:     map[int64]*CallRecord{},
		Withdraws: map[int64]*WithdrawRecord{},
		Tags:      map[int64]*Tag{},
		Admins:    map[int64]*Admin{},
		Config: Config{
			PriceListener: 1.0, PriceCounselor: 2.0, PlatformRate: 0.2,
			MinBalance: 3.0, Overdraft: 2.0, MinWithdraw: 100.0,
		},
	}}
	// 优先用 MySQL（配置了 DSN 且可连）
	s.sql = openMySQL(appCfg.MySQLDSN)
	if s.sql != nil {
		if s.loadFromMySQL() {
			return s
		}
		// 空库 → 种子并落库
		s.seed()
		s.persistMySQL()
		return s
	}
	// 回退 JSON 文件
	if b, err := os.ReadFile(path); err == nil {
		_ = json.Unmarshal(b, s.db)
		return s
	}
	s.seed()
	s.save()
	return s
}

// 种子数据：1 用户、2 在线服务者（1倾听师1咨询师）、管理员、标签
func (s *Store) seed() {
	t := now()
	s.db.SeqUser = 0
	s.db.SeqProvider = 0
	s.db.SeqAdmin = 0
	s.db.SeqTag = 0

	// 标签
	for i, name := range []string{"情感", "职场", "学业", "人际关系", "焦虑", "抑郁", "家庭", "自我成长"} {
		s.db.SeqTag++
		s.db.Tags[s.db.SeqTag] = &Tag{ID: int(s.db.SeqTag), Name: name, Sort: i}
	}

	// 普通用户（用于发起呼叫 / 测试）
	s.db.SeqUser++
	u := &User{ID: s.db.SeqUser, Openid: "openid_user_demo", Nickname: "小耳朵", Avatar: "", Gender: 0, Balance: 50.0, Frozen: 0, Status: 1, CreatedAt: t, UpdatedAt: t}
	s.db.Users[u.ID] = u

	// 倾听师
	s.db.SeqUser++
	lu := &User{ID: s.db.SeqUser, Openid: "openid_listener_lily", Nickname: "Lily", Avatar: "", Gender: 1, Balance: 0, Frozen: 0, Status: 1, CreatedAt: t, UpdatedAt: t}
	s.db.Users[lu.ID] = lu
	s.db.SeqProvider++
	lily := &Provider{
		ID: s.db.SeqProvider, UserID: lu.ID, Role: 1, RealName: "李莉", Phone: "13800000001",
		Intro: "温柔倾听，陪你度过情绪低谷。", Expertise: "1,5,8", Certificates: "cert_lily_1.jpg",
		PricePerMinute: 1.0, Level: 2, IsOnline: 1, IsBusy: 0, Rating: 4.8, TotalSessions: 120,
		TotalEarnings: 360.0, Withdrawable: 360.0, DailyLimit: 10, TodaySessions: 0,
		Status: 1, ApprovedAt: t, CreatedAt: t, UpdatedAt: t,
	}
	s.db.Providers[lily.ID] = lily

	// 咨询师
	s.db.SeqUser++
	cu := &User{ID: s.db.SeqUser, Openid: "openid_counselor_zhang", Nickname: "张博士", Avatar: "", Gender: 1, Balance: 0, Frozen: 0, Status: 1, CreatedAt: t, UpdatedAt: t}
	s.db.Users[cu.ID] = cu
	s.db.SeqProvider++
	zhang := &Provider{
		ID: s.db.SeqProvider, UserID: cu.ID, Role: 2, RealName: "张明", Phone: "13800000002",
		Intro: "国家二级心理咨询师，专注焦虑与职业规划。", Expertise: "2,3,6", Certificates: "cert_zhang_1.jpg",
		TrainingProof: "train_zhang.jpg", CertificateNo: "XK201900123", CertificateImage: "cert_zhang_pro.jpg",
		YearsOfExp: 8, Background: "北师大心理学硕士", PricePerMinute: 2.0, Level: 3, IsOnline: 1, IsBusy: 0,
		Rating: 4.9, TotalSessions: 300, TotalEarnings: 1200.0, Withdrawable: 1200.0, DailyLimit: 10,
		TodaySessions: 0, Status: 1, ApprovedAt: t, CreatedAt: t, UpdatedAt: t,
	}
	s.db.Providers[zhang.ID] = zhang

	// 一个待审核的入驻申请（用于后台审核演示）
	s.db.SeqUser++
	wu := &User{ID: s.db.SeqUser, Openid: "openid_wait_apply", Nickname: "待审小王", Avatar: "", Gender: 0, Balance: 0, Frozen: 0, Status: 1, CreatedAt: t, UpdatedAt: t}
	s.db.Users[wu.ID] = wu
	s.db.SeqProvider++
	wang := &Provider{
		ID: s.db.SeqProvider, UserID: wu.ID, Role: 1, RealName: "王五", Phone: "13800000003",
		Intro: "想成为倾听师，帮助更多人。", Expertise: "4,5", Certificates: "cert_wang_1.jpg",
		PricePerMinute: 1.0, Level: 1, IsOnline: 0, IsBusy: 0, Rating: 0, TotalSessions: 0,
		TotalEarnings: 0, Withdrawable: 0, DailyLimit: 10, TodaySessions: 0,
		Status: 0, CreatedAt: t, UpdatedAt: t,
	}
	s.db.Providers[wang.ID] = wang

	// 管理员（super / operator / finance）
	s.db.SeqAdmin++
	ad := &Admin{ID: s.db.SeqAdmin, Username: "admin", Password: sha256hex("admin123"), RealName: "超级管理员", Role: "super", Status: 1, CreatedAt: t, UpdatedAt: t}
	s.db.Admins[ad.ID] = ad
	s.db.SeqAdmin++
	op := &Admin{ID: s.db.SeqAdmin, Username: "operator", Password: sha256hex("op123456"), RealName: "运营小妹", Role: "operator", Status: 1, CreatedAt: t, UpdatedAt: t}
	s.db.Admins[op.ID] = op
}

func dataDir() string {
	d, _ := filepath.Abs("data")
	_ = os.MkdirAll(d, 0755)
	return filepath.Join(d, "db.json")
}
