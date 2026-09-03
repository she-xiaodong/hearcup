package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"math/big"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// ============ 数据模型（对应需求文档第四部分 7 张表）============

type User struct {
	ID        int64   `json:"id"`
	Openid    string  `json:"openid"`
	Unionid   string  `json:"unionid"`
	Phone     string  `json:"phone"`
	HNo       string  `json:"h_no"` // H号：8位不重复数字，容量将尽自动升 9 位、10 位……
	Nickname  string  `json:"nickname"`
	Avatar    string  `json:"avatar"`
	Gender    int     `json:"gender"`
	Balance   float64 `json:"balance"`
	Frozen    float64 `json:"frozen_balance"`
	Status    int     `json:"status"`
	CreatedAt int64   `json:"created_at"`
	UpdatedAt int64   `json:"updated_at"`
}

type Provider struct {
	ID               int64   `json:"id"`
	UserID           int64   `json:"user_id"`
	Role             int     `json:"role"` // 统一「倾听者」（历史字段，恒为 1）
	RealName         string  `json:"real_name"`
	Gender           int     `json:"gender"`           // 性别：0女 1男
	Age              int     `json:"age"`              // 年龄
	City             string  `json:"city"`             // 城市
	Education        string  `json:"education"`        // 学历
	Major            string  `json:"major"`            // 专业背景
	IDCard           string  `json:"id_card"`
	Phone            string  `json:"phone"`
	Intro            string  `json:"intro"`
	Expertise        string  `json:"expertise"` // 逗号分隔的擅长领域（文字标签）
	Certificates     string  `json:"certificates"`
	TrainingProof    string  `json:"training_proof"`
	CertificateNo    string  `json:"certificate_no"`
	CertificateImage string  `json:"certificate_image"`
	EducationImage   string  `json:"education_image"`   // 学历证书图片
	CounselorImage   string  `json:"counselor_image"`   // 咨询师证书图片
	YearsOfExp       int     `json:"years_of_exp"`
	ConsultHours     int     `json:"consult_hours"`     // 咨询时长（小时）
	Background       string  `json:"background"`
	PricePerMinute   float64 `json:"price_per_minute"`
	PriceTiers       string  `json:"price_tiers"`       // JSON字符串：{"15":15.0,"30":28.5,"45":40.5,"60":54.0,"75":67.5,"90":81.0,"105":94.5,"120":108.0}
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
	// —— 套餐预付制（先下单支付，再拨号）新增字段 ——
	OrderNo        string  `json:"order_no"`        // 订单号，CO 前缀，微信支付回调据此匹配
	PayStatus      int     `json:"pay_status"`      // 0待支付 1已支付 2已退款
	PackageMinutes int     `json:"package_minutes"` // 套餐时长：15/30/45/60/75/90/105/120
	PayTime        int64   `json:"pay_time"`
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
	// 微信转账关联（打款后回填）
	TransferNo   string `json:"transfer_no"`   // 商户转账单号 out_bill_no
	TransferState string `json:"transfer_state"` // 微信侧状态 ACCEPTED/PROCESSING/FINISHED/FAIL
	ApprovedAt int64   `json:"approved_at"`
	PaidAt     int64   `json:"paid_at"`
	CreatedAt  int64   `json:"created_at"`
	UpdatedAt  int64   `json:"updated_at"`
}

// TransferRecord 商家转账到零钱（分佣打款）记录：每次打款/重试一笔，与提现单 withdraw_id 关联。
type TransferRecord struct {
	ID           int64   `json:"id"`
	WithdrawID   int64   `json:"withdraw_id"`
	ProviderID   int64   `json:"provider_id"`
	ProviderName string  `json:"provider_name"`
	Openid       string  `json:"openid"`
	Amount       float64 `json:"amount"`       // 打款金额（元）
	OutBillNo    string  `json:"out_bill_no"`  // 商户单号
	WxBillNo     string  `json:"wx_bill_no"`   // 微信转账单号
	State        string  `json:"state"`        // 微信侧状态
	Status       int     `json:"status"`       // 0受理中 1成功 2失败
	FailReason   string  `json:"fail_reason"`
	Remark       string  `json:"remark"`
	CreatedAt    int64   `json:"created_at"`
	UpdatedAt    int64   `json:"updated_at"`
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

type Feedback struct {
	ID        int64  `json:"id"`
	UserID    int64  `json:"user_id"`
	Content   string `json:"content"`
	Contact   string `json:"contact"`
	CreatedAt int64  `json:"created_at"`
}

// 平台费率配置（需求 6.1 / 3.3.5）
type Config struct {
	PriceListener  float64 `json:"price_listener"`  // 倾听师单价 1元/分
	PriceCounselor float64 `json:"price_counselor"` // 咨询师单价 2元/分
	VideoRate      float64 `json:"video_rate"`      // 视频通话加价倍率：语音=基础价，视频=基础价×倍率（默认1.5）
	CoinRate       float64 `json:"coin_rate"`       // 虚拟币换算比例：1元 = coin_rate 个 H币（默认10）
	CoinName       string  `json:"coin_name"`       // 虚拟币名称（默认「H币」）
	PlatformRate   float64 `json:"platform_rate"`   // 平台抽成 0.2
	MinBalance     float64 `json:"min_balance"`      // 起呼最低余额 3元
	Overdraft      float64 `json:"overdraft"`        // 透支额度 2元
	MinWithdraw    float64 `json:"min_withdraw"`     // 最低提现 100元
}

// ============ 持久化存储 ============

// Notification 平台提示/通知（后台「提示管理」模块）
type Notification struct {
	ID          int64  `json:"id"`
	Title       string `json:"title"`
	Content     string `json:"content"`
	Target      string `json:"target"`       // all=全部用户 provider=仅服务者 user=仅普通用户
	Status      int    `json:"status"`       // 0草稿 1已发布
	CreatedAt   int64  `json:"created_at"`
	UpdatedAt   int64  `json:"updated_at"`
	PublishedAt int64  `json:"published_at"`
}

type DB struct {
	Users     map[int64]*User          `json:"users"`
	Providers map[int64]*Provider      `json:"providers"`
	Recharges map[int64]*RechargeOrder `json:"recharges"`
	Calls     map[int64]*CallRecord    `json:"calls"`
	Withdraws map[int64]*WithdrawRecord `json:"withdraws"`
	Transfers map[int64]*TransferRecord `json:"transfers"`
	Tags      map[int64]*Tag           `json:"tags"`
	Admins    map[int64]*Admin         `json:"admins"`
	Feedbacks map[int64]*Feedback      `json:"feedbacks"`
	Notifications map[int64]*Notification `json:"notifications"`
	SeqNotification int64 `json:"seq_notification"`
	SeqUser     int64 `json:"seq_user"`
	SeqProvider int64 `json:"seq_provider"`
	SeqRecharge int64 `json:"seq_recharge"`
	SeqCall     int64 `json:"seq_call"`
	SeqWithdraw int64 `json:"seq_withdraw"`
	SeqTransfer int64 `json:"seq_transfer"`
	SeqTag      int64 `json:"seq_tag"`
	SeqAdmin    int64 `json:"seq_admin"`
	SeqFeedback int64 `json:"seq_feedback"`
	Config     Config `json:"config"`
}

type Store struct {
	mu   sync.Mutex
	db   *DB
	path string
	sql  *sql.DB // MySQL 连接；nil 时回退 JSON 文件

	// H号分配索引（运行时，加载后重建；不持久化到 DB 结构）
	hNoUsed   map[string]bool
	hNoDigits int
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
		Transfers: map[int64]*TransferRecord{},
		Tags:      map[int64]*Tag{},
		Admins:    map[int64]*Admin{},
		Feedbacks: map[int64]*Feedback{},
		Config: Config{
			PriceListener: 1.0, PriceCounselor: 2.0, VideoRate: 1.5, CoinRate: 10, CoinName: "H币", PlatformRate: 0.2,
			MinBalance: 3.0, Overdraft: 2.0, MinWithdraw: 100.0,
		},
	}}
	// 优先用 MySQL（配置了 DSN 且可连）
	s.sql = openMySQL(appCfg.MySQLDSN)
	if s.sql != nil {
		if s.loadFromMySQL() {
			s.normalize()
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
		s.normalize()
		return s
	}
	s.seed()
	s.save()
	return s
}

// 种子数据：1 用户、2 在线倾听者、1 待审核申请、管理员、标签
func (s *Store) seed() {
	t := now()
	s.db.SeqUser = 0
	s.db.SeqProvider = 0
	s.db.SeqAdmin = 0
	s.db.SeqTag = 0

	// 标签（擅长领域，文字标签）
	for i, name := range []string{"恋爱", "婚姻", "家庭", "职场", "校园", "亲子", "情绪压力", "自我成长", "人际关系"} {
		s.db.SeqTag++
		s.db.Tags[s.db.SeqTag] = &Tag{ID: int(s.db.SeqTag), Name: name, Sort: i}
	}

	// 普通用户（用于发起呼叫 / 测试）
	s.db.SeqUser++
	u := &User{ID: s.db.SeqUser, Openid: "openid_user_demo", Nickname: "小耳朵", Avatar: "", Gender: 0, Balance: 50.0, Frozen: 0, Status: 1, CreatedAt: t, UpdatedAt: t}
	s.db.Users[u.ID] = u

	// 倾听者
	s.db.SeqUser++
	lu := &User{ID: s.db.SeqUser, Openid: "openid_listener_lily", Nickname: "Lily", Avatar: "", Gender: 1, Balance: 0, Frozen: 0, Status: 1, CreatedAt: t, UpdatedAt: t}
	s.db.Users[lu.ID] = lu
	s.db.SeqProvider++
	lily := &Provider{
		ID: s.db.SeqProvider, UserID: lu.ID, Role: 1, RealName: "李莉", Phone: "13800000001",
		Intro: "温柔倾听，陪你度过情绪低谷。", Expertise: "恋爱,家庭,自我成长", Certificates: "cert_lily_1.jpg",
		PricePerMinute: 1.0, Level: 2, IsOnline: 1, IsBusy: 0, Rating: 4.8, TotalSessions: 120,
		TotalEarnings: 360.0, Withdrawable: 360.0, DailyLimit: 10, TodaySessions: 0,
		Status: 1, ApprovedAt: t, CreatedAt: t, UpdatedAt: t,
	}
	s.db.Providers[lily.ID] = lily

	// 倾听者（资深）
	s.db.SeqUser++
	cu := &User{ID: s.db.SeqUser, Openid: "openid_counselor_zhang", Nickname: "张博士", Avatar: "", Gender: 1, Balance: 0, Frozen: 0, Status: 1, CreatedAt: t, UpdatedAt: t}
	s.db.Users[cu.ID] = cu
	s.db.SeqProvider++
	zhang := &Provider{
		ID: s.db.SeqProvider, UserID: cu.ID, Role: 1, RealName: "张明", Phone: "13800000002",
		Intro: "国家二级心理咨询师，专注情绪与职业规划。", Expertise: "情绪压力,职场,婚姻", Certificates: "cert_zhang_1.jpg",
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
		Intro: "想成为倾听者，帮助更多人。", Expertise: "校园,人际关系", Certificates: "cert_wang_1.jpg",
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

	// 为种子用户分配 H号
	s.assignHNoToMissing()
}

// ---------- H号（用户唯一数字号码）----------

// 重建 H号已用索引：扫描现有用户，记录已占用的 H号与最大位数。
func (s *Store) rebuildHNoIndex() {
	s.hNoUsed = map[string]bool{}
	digits := 8
	for _, u := range s.db.Users {
		if u.HNo != "" {
			s.hNoUsed[u.HNo] = true
			if len(u.HNo) > digits {
				digits = len(u.HNo)
			}
		}
	}
	s.hNoDigits = digits
}

// 给 H号缺失的用户补发 H号（用于种子数据与旧数据迁移），返回是否有新分配。
func (s *Store) assignHNoToMissing() bool {
	changed := false
	for _, u := range s.db.Users {
		if u.HNo == "" {
			u.HNo = s.generateHNo()
			changed = true
		}
	}
	return changed
}

// 启动时数据规范化：补发缺失 H号 + 统一历史角色为「倾听者」
func (s *Store) normalize() {
	changed := s.assignHNoToMissing()
	for _, p := range s.db.Providers {
		if p.Role != 1 {
			p.Role = 1
			changed = true
		}
	}
	if changed {
		s.save()
	}
}

// 生成一个不重复的 H号：默认 8 位数字，容量将尽（已用 ≥ 90%）或连续冲突过多时自动升位。
func (s *Store) generateHNo() string {
	if s.hNoUsed == nil {
		s.rebuildHNoIndex()
	}
	digits := s.hNoDigits
	if digits < 8 {
		digits = 8
	}
	for attempt := 0; ; attempt++ {
		min := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(digits-1)), nil) // 10^(digits-1)
		max := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(digits)), nil)   // 10^digits
		span := new(big.Int).Sub(max, min)
		n, err := rand.Int(rand.Reader, span)
		if err == nil {
			no := new(big.Int).Add(n, min).String()
			if !s.hNoUsed[no] {
				s.hNoUsed[no] = true
				s.hNoDigits = digits
				return no
			}
		}
		// 升位条件：连续冲突过多，或已用号码数 ≥ 当前位数容量的 90%
		capacity := new(big.Int).Sub(max, min).Int64()
		if attempt > 100000 || (capacity > 0 && int64(len(s.hNoUsed)) >= capacity*9/10) {
			digits++
			s.hNoDigits = digits
			attempt = 0
		}
	}
}

func dataDir() string {
	d, _ := filepath.Abs("data")
	_ = os.MkdirAll(d, 0755)
	return filepath.Join(d, "db.json")
}
