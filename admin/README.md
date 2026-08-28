# Hearcup 管理后台（Vue 3 + Element Plus）

一杯心晴（Hearcup）V1.0 管理后台前端，对应需求第三部分 3.3。

## 技术栈
- Vue 3 + Vite 5
- Element Plus（UI 组件）
- Vue Router 4
- Axios（接口请求，已配置 `/api` 代理到后端 `:8080`）

## 目录结构
```
admin/
├── index.html
├── vite.config.js
├── package.json
└── src/
    ├── main.js
    ├── App.vue
    ├── router/index.js
    ├── api/index.js          # 后台接口封装
    └── views/
        ├── Login.vue         # 登录（Casbin RBAC：超级管理员/运营/财务）
        ├── Dashboard.vue     # 数据看板（今日指标 + 近7日趋势）
        └── Providers.vue     # 服务者管理（列表/审核/上下线）
```

## 已实现
- ✅ 工程脚手架、路由、登录页（暖色治愈风）
- ✅ 数据看板：4 个核心指标卡 + 近 7 日趋势（手绘 SVG，无额外图表依赖）
- ✅ 服务者管理：列表 + 待审核 Tab + 通过/拒绝/上下线（演示数据）

## 待实现
- 接入真实 `/api/v1/admin/*` 接口（当前为演示数据）
- 入驻申请详情查看、费率配置、订单/提现管理、操作日志

## 运行
```bash
cd admin
npm install
npm run dev      # http://localhost:5173
```
