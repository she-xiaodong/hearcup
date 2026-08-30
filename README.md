# Hearcup（一杯心晴）V1.0 —— 可测试版本

> 即时语音/视频倾诉平台 · 微信小程序（**用户端 + 服务者端合并为同一小程序**）+ Go 后端 + 零构建管理后台
> 核心闭环：**选择服务者 → 点击呼叫 → 接通倾诉 → 按分钟扣费 → 评价**。
> 本版本目标是「可测试」：后端离线可跑、接口可 curl 测、管理后台浏览器可开、小程序 api 层已打通后端。

---

## ⚠️ 与原需求技术选型的偏离（重要）

需求文档第二部分指定 **Gin + GORM + MySQL + Redis + Casbin**。但本机 **Go 代理（proxy.golang.org）不可达**，`go mod tidy` 无法拉取这些依赖，且 MySQL/Redis 未就绪。为保证「可测试版本」能在本机离线 `go run` 并端到端验证，后端改为：

| 需求指定 | 本版实现 | 说明 |
|---------|---------|------|
| Gin | 标准库 `net/http` 自写轻量路由 | 零外部依赖，离线可编译 |
| GORM + MySQL | **零依赖 `go-sql-driver/mysql`（配置驱动）+ JSON 文件兜底** | 设 `HEARCUP_MYSQL_DSN` 即写 MySQL；不设则回退 JSON，对外 API 不变 |
| Redis | 暂不需要（单实例内存态） | V2 再接 |
| Casbin | JWT 角色（`user` / `admin`） | 后台接口统一 `requireAdmin` 鉴权 |
| JWT 库 | 自实现 HMAC-SHA256（标准库） | 算法等价，秘钥在 `jwt.go` 配置 |

**接口路径、入参、返回结构严格对齐需求第五部分**，业务字段与 `providers` 等 7 张表一一对应。将来要切回 Gin+GORM+MySQL，只需替换 `store.go` / `handlers.go` 内部实现，对外 API 不变。

---

## 项目结构
```
Hearcup_new/
├── 需求文档.docx
├── UI设计参考/
├── miniprogram/          # 微信原生小程序（单程序：首页/通话/我的/入驻/充值/详情/通话中/自检）
│   ├── app.js            # 入口；globalData.config：useMock 开关 + baseUrl（可持久化）
│   ├── styles/icons.wxss # ★ 扁平 SVG 图标集（18 个 + tabBar 双态，全面替代 emoji）
│   ├── pages/devcheck/   # ★ 开发者自检页：一键验证后端/登录/支付/TRTC 全链路
│   ├── utils/api.js      # ★ 与后端的统一接口层（真实后端 + mock 兜底，字段映射）
│   ├── utils/store.js    # 本地状态 + 缓存
│   ├── utils/mock.js     # 演示数据（useMock=true 时使用）
│   └── test_api_node.js  # node 桩测试：验证 api 层真能打通后端
├── server/               # Go 后端（仅依赖 go-sql-driver/mysql，其它标准库）
│   ├── main.go           # 路由 + 静态托管后台 + 启动 + 配置加载
│   ├── config.go         # ★ 环境变量配置（MySQL/TRTC/微信/支付/JWT）
│   ├── store.go          # 7 张表模型 + 内存存储 + JSON 持久化 + 种子数据
│   ├── mysql.go          # ★ MySQL 持久化（REPLACE 写回 / 启动加载，InnoDB）
│   ├── handlers.go       # 全部 V1.0 接口 + 计费逻辑（第六部分）
│   ├── jwt.go            # HMAC-SHA256 JWT + TRTC UserSig 生成
│   ├── wechat.go         # ★ 微信登录 code2Session（openid/unionid）
│   ├── wxpay.go          # ★ 微信支付 v3（下单签名 / 支付参数 / 回调 AES 解密）
│   ├── handlers.go 尾部   # /api/v1/debug/env 环境自检 + /api/v1/admin/users 用户列表
│   └── test_e2e.py       # 端到端 curl 测试（15 项断言）
└── admin/                # 零构建管理后台（纯 HTML+JS，由 Go 直接托管）
    └── index.html        # 登录/看板/服务者/审核/订单/提现/费率
```

---

## 如何运行（三步即可测）

### 1. 启动后端
```bash
cd server
go run . -port 8099
# 或先编译： go build -o hearcup_server . && ./hearcup_server -port 8099
```
- 首次启动自动在 `server/data/db.json` 写入**种子数据**：1 普通用户（余额 50）、2 在线服务者（倾听师 Lily / 咨询师 张博士）、1 待审核申请、2 管理员（admin/admin123、operator/op123456）。
- 接口根：`http://localhost:8099/api/v1/...`
- 管理后台：`http://localhost:8099/admin/`（由 Go 直接托管，无需 npm）

### 2. 跑后端端到端测试（验证核心闭环）
```bash
cd server && python3 test_e2e.py
```
覆盖：登录 → 在线列表 → 发起呼叫 → 挂断计费 → 充值 → 入驻 → 后台审核 → 看板，全部断言通过（15/15）。另含专项计费验证（向上取整、抽成 20%、冻结结算）。

### 3. 跑小程序 api 层对接测试（验证前端能打通后端）
```bash
cd miniprogram && node test_api_node.js
```
给 `wx` 打桩后驱动 `utils/api.js` 真实请求后端，验证 login / 在线列表 / 呼叫 / 计费 / 充值 / 入驻 全部通过。

### 小程序（微信开发者工具）
- 导入 `miniprogram/` 目录（AppID 用 `wxdae65eafc8e6174f`）。
- `miniprogram/app.js` 中 `globalData.config`：
  - `useMock: true` → 走本地演示数据（离线可用，先看 UI）。
  - `useMock: false` → 连真实后端（开发者工具需勾选「不校验合法域名」）。
- `baseUrl` **真机调试必须填电脑的局域网 IP**（如 `http://192.168.1.6:8099`）——`localhost` 手机访问不到。
- 更省事的做法：进「我的 → 开发者自检」页，改完地址点保存（会持久化到 storage），再点「一键自检」。

### 真机联调：开发者自检页
路径 `pages/devcheck/devcheck`（入口：我的 → 开发者自检）。一次点检可看清楚每一段链路通不通：

| 检查项 | 说明 |
|---|---|
| 后端可达 | 测 `baseUrl` 是否可达（真机填错 IP 会立刻暴露） |
| MySQL / TRTC / 微信登录 / 微信支付 | 拉 `/api/v1/debug/env`，逐项显示是否生效 |
| 微信登录 | 真实 `wx.login` → `code2Session`，**直接显示换回来的 openid**，并标注是真实微信还是演示账号 |
| 服务者列表 / 账户余额 | 验证业务接口 |

「真链路实测」区可发起 **¥10 真实支付**（拉起微信收银台）与 **呼叫测试**（验证能否取到真实 TRTC UserSig）。

### 运维观测接口
| 接口 | 用途 |
|---|---|
| `GET /api/v1/debug/env` | 环境自检：各项集成是否生效。仅返回「是否配置 + 脱敏尾号」，**不返回任何密钥明文** |
| `GET /api/v1/admin/users` | 用户列表（需 admin token），带 `is_real_wx` 标记，真机扫码后可在后台确认真实 openid 已落库 |

---

## 外部依赖接入（环境变量配置，全部「配置驱动 + 优雅回退」）

所有外部服务（MySQL / 腾讯 TRTC / 微信登录 / 微信支付）都通过环境变量注入，**未配置时自动回退到 MVP 占位逻辑**，保证「无真实凭据也能跑通、能测试」（e2e 15/15 不破）。配置在 `server/config.go` 的 `loadConfig()` 中读取，启动即生效；也可把变量写在 `server/.env`（启动自动加载，已加入 `.gitignore`，私钥仅以文件路径注入）。

| 变量 | 说明 | 未配置时的回退 |
|------|------|---------------|
| `HEARCUP_MYSQL_DSN` | MySQL 连接串，如 `root:root@tcp(127.0.0.1:3306)/hearcup?charset=utf8mb4&parseTime=true` | 写 `data/db.json` |
| `HEARCUP_TRTC_APPID` / `HEARCUP_TRTC_SECRET` | 腾讯云 TRTC SDKAppID / 密钥 | `sdk_app_id=0`，UserSig 返回 `MOCKSIG_` 占位 |
| `HEARCUP_WX_APPID` / `HEARCUP_WX_SECRET` | 微信小程序 appid / secret | `auth/login` 直接把 code 当 openid（演示码） |
| `HEARCUP_WXPAY_MCHID` / `HEARCUP_WXPAY_SERIAL` | 微信支付 商户号 / API 证书序列号 | `recharge/create` 创建即模拟到账 |
| `HEARCUP_WXPAY_APIV3_KEY` | 微信支付 APIv3 密钥（回调 AES 解密） | 回调返回失败 |
| `HEARCUP_WXPAY_PRIVATE_KEY` | 商户 API 私钥 PEM（内容或文件路径） | 无法下单 |
| `HEARCUP_WXPAY_NOTIFY_URL` | 支付结果回调公网地址 | 默认 `http://localhost:8099/api/v1/pay/callback` |
| `HEARCUP_SUBSCRIBE_TPL_ID` | 微信订阅消息模板 ID（未接来电离线兜底） | 空 → 跳过订阅消息发送 |
| `HEARCUP_JWT_SECRET` | JWT 签名密钥 | 内置默认值 |

**本机已验证可用的配置（MySQL）：**
```bash
export HEARCUP_MYSQL_DSN='root:root@tcp(127.0.0.1:3306)/hearcup?charset=utf8mb4&parseTime=true'
./hearcup_server -port 8099
```
> ⚠️ 本机 MySQL 8.0 默认引擎为 MyISAM 且建表会崩（Incorrect file format），`mysql.go` 已强制 `ENGINE=InnoDB` 规避；若换其它 MySQL 也建议保持 InnoDB。

**微信支付 v3 回调**：`POST /api/v1/pay/callback`（无需鉴权）。已完成 AES-GCM 解密与订单入账；生产环境建议再补「平台证书验签」（需商户平台下载证书），代码已留 TODO。

---

## 计费逻辑（已实现，需求第六部分）
- 单价：倾听师 1 元/分、咨询师 2 元/分（后台可配）。
- 呼叫前冻结 3 分钟费用（`balance -= 3, frozen += 3`），余额 < 3 元拦截（需求 6.1）。
- 挂断结算：时长**向上取整**分钟 → 费用 = 分钟 × 单价；平台抽成 20%（可配），服务者收入 = 费用 × 80%。
- 冻结差额退还；超出部分从主余额补扣；主余额不足进入**透支保护**（最多欠 2 元，见 `handlers.go` `hCallEnd`）。

## 管理后台功能（零构建，浏览器可用）
登录 → 数据看板（今日通话/收入/在线数/新增用户 + 7 日趋势图）→ 服务者管理（上下线/禁用）→ 入驻审核（通过/拒绝）→ 订单财务（通话/充值）→ 提现管理（通过/打款/拒绝）→ 费率配置。

## 图标系统（扁平 SVG，全面替代 emoji）

小程序与管理后台的图标**全部为内联扁平 SVG，零图片文件、零外链依赖、零 emoji**。

**实现方式**：小程序端用 WXSS `background-image: url("data:image/svg+xml,...")` 渲染真实 SVG——微信原生 `<image>` 对 SVG 支持不稳，而 WXSS 背景图是稳定路径。由于本项目 tabBar 为 `"custom": true`，不受「tabBar 图标必须是 PNG」的限制，因此 tabBar 也能直接用 SVG。

**设计规范**：24×24 视框 · 1.8 描边 · 圆头圆角（`stroke-linecap/linejoin: round`）· `fill: none` 纯描边扁平风。

| 分类 | 数量 | 配色 | 使用场景 |
|---|---|---|---|
| tabBar | 3 组 × 双态 | 未选中 `#8A8FA3` / 选中 `#4FB8A8` | 首页 / 通话 / 我的 |
| 常规图标 | 10 个 | 青绿 `#4FB8A8` | 浅色底（钱包 / 叶片 / 莲花 / 沙漏 / 齿轮 / 新芽 / 麦克风 / 电话 / 扳手 / 退出） |
| 反白图标 | 8 个 | 白色 `#FFFFFF` | 深色或彩色底（通话页控件 / 渐变头像 / 橙色按钮） |

**覆盖位置**：tabBar、首页余额胶囊与在线状态点、详情页呼叫按钮、通话页静音/视频/挂断控件、我的页菜单与角色图标、通话记录头像、入驻页角色卡与完成页、服务者卡片头像。

图标预览：`miniprogram/_icon_preview.html`（浏览器直接打开，可看到每种底色下的实际效果）。

---

## 外部依赖接入状态（已用真实凭据对腾讯/微信服务器验证 ✅）
以下四项均已实现，且**本机已用真实 AppID / 密钥 / 商户证书对腾讯云与微信支付生产服务器发起过真实请求并通过校验**（非仅代码就绪）：

- **MySQL 持久化** ✅ 已验证：配置 `HEARCUP_MYSQL_DSN` 后全量读写 MySQL，删 `db.json` 重启仍从 MySQL 加载。
- **TRTC 真实 UserSig** ✅ 已验证：注入真实 `HEARCUP_TRTC_APPID/SECRET` 后，`generateUserSig()` 生成真实签名（解码核验 `sdkappid` 正确、非 MOCK）。
- **微信登录** ✅ 已验证：`auth/login` 用真实 `code` 调 `code2Session` 返回微信 `errcode=40029`（无效 code，证明 appid/secret 有效、请求格式正确）。
- **微信支付 v3** ✅ 已验证：`recharge/create` 调 JSAPI 下单，微信返回「无效 openid」（**非 401**），证明 RSA 签名、商户号、证书序列号、appid 全部被微信接受。

**凭据存放**：真实凭据写入 `server/.env`（已被 `.gitignore` 忽略；私钥仅以文件路径注入，不落密钥体）。启动后端时 `loadConfig()` 自动读取，无需手动 export。

**上线前还需两件「环境」条件（非代码问题）：**
1. **真实用户 openid**：需要真机/开发者工具里真实微信用户扫码登录，拿到真实 openid 才能走完支付（当前测试用 `openid_*` 演示用户，自动走模拟入账）。
2. **支付回调公网 HTTPS**：`HEARCUP_WXPAY_NOTIFY_URL` 必须是公网可访问的 HTTPS 地址（内网/localhost 收不到微信回调），上线部署到云服务器或内网穿透后替换即可。微信支付回调的「平台证书验签」代码已留 TODO，拿到平台证书后即可补齐。

> 真机联调只需在 `server` 目录启动后端（自动读 `.env`），并在小程序侧填入对应 AppID / 密钥 / 证书。

---

## 音视频通话接入（TUICallKit v5.0.0，V1.1）

通话能力基于腾讯云 **TUICallKit**（`@trtc/calls-uikit-wx`，IM + TRTC 双引擎），采用官方 demo 同款 **vendor 拷贝方式**集成：`miniprogram/TUICallKit/` 即 `node_modules/@trtc/calls-uikit-wx` 的拷贝（已删除 `debug/`）。

### 涉及的文件
- `miniprogram/utils/callkit.js` —— TUICallKit 封装层（`init` / `calls` / `hangup` / 来电状态监听）
- `miniprogram/utils/startcall.js` —— 首页/详情页共用的发起呼叫流程（余额校验 → 建单冻结 → 发起）
- `miniprogram/utils/api.js` —— 新增 `invite` / `reportCallResult` / `setProviderOnline(Offline)` / `getProviderEarnings`
- `miniprogram/pages/listener/*` —— 倾听者工作台（入驻状态 / 上下线 / 收益 / 保活引导 / 静音后台音频）
- `miniprogram/static/silence.wav` —— 1 秒静音音频，用于降低后台被回收概率
- `miniprogram/app.json` —— 注册全局来电页 `TUICallKit/pages/globalCall/globalCall`
- `server/im.go` —— IM 服务端客户端（账号开通 / 在线查询 / 未接通知），关键职责边界见文件头注释

### npm 依赖（已手动构建好，直接编译即可）
`miniprogram_npm/` 已手动构建完成，包含 TUICallKit 所需的全部 npm 依赖，且 `@tencentcloud/lite-chat` 已做瘦身（只保留 `basic.js`，省去 5.6M 冗余变体）。**miniprogram_npm 已提交 git**，clone 后无需重新构建。

> ⚠️ **不要点微信开发者工具的「构建 npm」**：手动构建已做了 lite-chat 瘦身（只留 `basic.js`，自包含无 require）。重新构建会把 lite-chat 完整版（5.6M，含 node/professional/standard/plugins 等冗余变体）带进主包，导致主包超 2M 限制。
>
> 若日后升级 TUICallKit 或依赖版本，需重新生成 miniprogram_npm：先「构建 npm」，再手动瘦身——把 `node_modules/@tencentcloud/lite-chat/basic.js` 拷入 `miniprogram_npm/@tencentcloud/lite-chat/` 并删除该目录下 `index.js`。

### 体积核算（压缩后估算）
业务代码 ~0.6M + TUICallKit UI ~0.7M + 引擎 ~0.5M + lite-chat/basic ~0.25M + trtc-component-wx ~0.13M ≈ 原始 2.2M、压缩后约 1.3~1.5M，**在 2M 主包限制内**。前提是 lite-chat 已瘦身（当前 miniprogram_npm 已完成）；若仍超限，再上分包方案（全局通话页迁入 `subPackages`）。

### 上线前环境要求（微信后台手动配置）
音视频组件权限、域名白名单、订阅消息模板、隐私声明，详见 **`docs/微信后台配置清单.md`**（含老板强调的全部避坑要点）。

> 注意：微信开发者工具不支持 `live-pusher/live-player` 原生组件，音视频必须**真机**测试；且需企业主体小程序（个人小程序无此权限）。
