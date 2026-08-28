# Hearcup 后端服务（Go）

一杯心晴（Hearcup）V1.0 后端，基于需求文档第二部分技术选型。

## 技术栈
- Go 1.21+ / Gin v1.9
- GORM v2 + MySQL 8.0
- Redis 7.0（在线状态、限流、余额冻结）
- JWT 鉴权 / Casbin RBAC（管理后台）
- PowerWeChat v3（微信登录、订阅消息）
- wechatpay-go（微信支付 v3）
- 腾讯云 TRTC（实时音视频）

## 目录结构
```
server/
├── main.go                  # 入口
├── go.mod
└── internal/
    ├── config/        # 配置（环境变量）
    ├── models/        # 7 张核心表 GORM 模型（需求第四部分）
    ├── middleware/    # JWT 鉴权
    └── router/        # 路由 + 接口骨架（需求第五部分）
```

## 已实现
- ✅ 项目骨架、Gin 路由、全部 V1.0 接口路由注册（handler 暂为占位）
- ✅ 7 张核心表的 GORM 模型（`internal/models/models.go`）
- ✅ JWT 中间件、配置加载

## 待实现（按需求第八部分 12 周路线图）
- 阶段一：DB/Redis 连接、Swagger、Docker
- 阶段二：微信登录、JWT 签发、用户信息
- 阶段三：管理后台（go-admin 或自研 Vue 后台）
- 阶段四：入驻申请、审核、在线状态、双角色
- 阶段五：微信支付 v3、预充值、余额、对账
- 阶段六：TRTC 集成、呼叫全流程、计费引擎（需求第六部分）

## 运行（占位骨架，尚未接入 DB）
```bash
cd server
go mod tidy
go run main.go
# 健康检查
curl http://localhost:8080/health
```
