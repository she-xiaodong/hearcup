# Hearcup（一杯心晴）—— 即时语音电话倾诉平台

> 微信小程序（用户端 + 倾听者端同一小程序）+ Go 后端（标准库）+ Vue 管理后台
> 业务主色 `#3A9E8F`；用户侧计价统一为 **H币**（1 元 = 10 H币，内部按元记账，展示层换算）；倾听者侧收益/提现为 **¥人民币**。
> 生产域名：`shanlianba.com`（支付回调 / 小程序 baseUrl 一致）。

## 版本演进（重要背景）

- **V2.0（2026-08-30）**：曾接入腾讯云 TUICallKit（IM + TRTC）做小程序内音视频来电。
- **V2.1（2026-09-03）**：改用 **电话拨号模式**——用户在倾听师详情页「选时长档位（15/30/45/60/75/90/105/120 分钟）→ 下单支付 → 确认后返回手机号 → `wx.makePhoneCall` 拨打系统电话 → 通话结束自助上报时长结算（超出套餐按单价补扣）→ 评价」。
- **2026-09-04**：**彻底清除全部 TUICallKit / 腾讯云 IM / 订阅消息遗产**（前端组件目录、`server/im.go`、`server/subscribe_msg.go`、TRTC/UserSig 配置、旧呼叫状态接口 `accept/reject/cancel/miss/status/旧end`、登录时 IM 账号开通、保活音频与锁屏引导等）。**现版本不依赖任何腾讯云实时音视频能力**，来电完全走运营商电话。

---

## 项目结构
```
Hearcup_new/
├── 需求文档.docx / UI设计参考/
├── miniprogram/            # 微信原生小程序（单程序）
│   ├── app.js              # 入口；globalData.config：useMock + baseUrl（可持久化）
│   ├── app.wxss            # ★ 全局设计令牌（主色 #3A9E8F 体系）
│   ├── styles/icons.wxss   # ★ 扁平 SVG 图标集（全面替代 emoji）
│   ├── components/provider-card/   # 首页倾听师卡片（性别徽标/等级/在线/起价/H号）
│   ├── custom-tab-bar/     # 自定义 tabBar（首页/通话/我的）
│   ├── pages/              # index 首页 · calls 通话记录 · profile 我的 · listener 倾听者平台
│   │                       # · listener-detail 详情(选时长) · calling-phone 拨号页 · income 收益明细
│   │                       # · provider-calls 服务订单(接听记录) · recharge/apply/about/feedback/settings/devcheck …
│   └── utils/              # api.js(接口层) · store.js · mock.js(演示) · fmt.js(收益/通话格式化)
├── server/                 # Go 后端（标准库 + go-sql-driver/mysql），端口 8099
│   ├── main.go             # 路由 + 静态托管后台 + 启动
│   ├── config.go           # 环境变量配置（微信登录/支付/商家转账/MySQL/JWT）
│   ├── store.go            # 数据模型 + 内存态
│   ├── mysql.go            # ★ MySQL 持久化（显式列 REPLACE/加载，InnoDB）
│   ├── handlers.go         # 全部业务接口（入驻/下单/支付/拨号结算/评价/收益/接叫…）
│   ├── jwt.go / wechat.go / wxpay.go   # JWT / 微信登录 / 微信支付+商家转账
│   └── test_e2e.py         # 端到端 curl 测试
├── admin/                  # Vue3 + Element Plus 管理后台（vite build → Go 托管）
├── docs/微信后台配置清单.md  # ⚠️ V2.0 归档（TUICallKit/IM/订阅消息已下线，仅供参考）
├── _deploy.py              # ★ 安全部署：只更新源码 + Linux 二进制，绝不覆盖服务器 .env/data
└── README.md
```

---

## 核心业务流

1. **用户端**：首页卡片展示倾听师（性别小图标 / 等级 / 在线离线 / 「15 分钟档 H币起」/ H号）→ 详情页（头像、性别、等级、从业年限、擅长领域、H号；**时长下拉**选档）→ 下单（默认扣 **H币余额**，不足引导充值）→ 支付成功返回对方手机号 → 系统电话拨打 → 通话中自助「结束通话」按实际分钟结算（超出套餐补差）→ 通话记录可**评价**（星级+文字，回写并重算倾听师均分）。
2. **倾听者端（倾听者平台页，入口在「我的」）**：上下线开关 → 收益卡（今日/可提现/累计 + 申请提现，走**微信商家转账到零钱**、需手动领取）→ 收益明细 / 服务订单 / 提现记录 → 入驻状态管理。

---

## 运行

```bash
# 后端
cd server
go run . -port 8099            # 或 go build -o hearcup_server . && ./hearcup_server -port 8099
# 端到端 curl 测试（本地 JSON 兜底可跑通主流程）
python3 test_e2e.py

# 管理后台
cd admin && npm install && npm run build   # 产物 dist/ 由 Go 托管 /admin/

# Linux 交叉编译 + 部署（生产）
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o hearcup_server_linux .
python _deploy.py              # SSH 到 39.96.31.188:8822 → /webroot/www/hearcup
```

**小程序（微信开发者工具）**：导入 `miniprogram/`；`useMock:false` + baseUrl 填 `https://shanlianba.com`（或局域网 IP）。真机调试需关演示数据并勾选「不校验合法域名」。

---

## 环境变量（`server/.env`，已被 .gitignore 忽略；服务器 .env 以线上为准，部署脚本绝不覆盖）

| 变量 | 说明 |
|---|---|
| `HEARCUP_MYSQL_DSN` | MySQL 连接串（生产必配，不再回退 JSON） |
| `HEARCUP_WX_APPID` / `HEARCUP_WX_SECRET` | 微信小程序 appid/secret（code→openid） |
| `HEARCUP_WXPAY_MCHID` / `SERIAL` / `APIV3_KEY` / `PRIVATE_KEY` / `NOTIFY_URL` | 微信支付 v3 商户参数 + 回调地址 |
| `HEARCUP_WXPAY_TRANSFER_SCENE_ID` / `_INFOS` / `NOTIFY_URL` | 商家转账到零钱（分佣打款）场景报备 |
| `HEARCUP_FREE_CALL` / `HEARCUP_JWT_SECRET` | 免费模式开关 / JWT 密钥 |

> TRTC / IM / 订阅消息相关变量已随 TUICallKit 一并移除。

---

## 部署要点（死规定）

- 生产域名唯一 **`shanlianba.com`**；后端 `systemd/setsid` 启动于 8099。
- `_deploy.py` 只上传「源码 + `hearcup_server_linux`」，**跳过 `.env` 与 `data/`**。
- 后台前端改动需先 `npm run build` 再部署（dist 由 Go 托管）。
- 小程序改动需在微信开发者工具手动上传发布。
