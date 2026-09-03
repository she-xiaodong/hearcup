import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/Login.vue'
import AdminLayout from '../layouts/AdminLayout.vue'
import Dashboard from '../views/Dashboard.vue'
import Providers from '../views/Providers.vue'
import Calls from '../views/Calls.vue'
import Recharge from '../views/Recharge.vue'
import Withdraws from '../views/Withdraws.vue'
import Transfers from '../views/Transfers.vue'
import Users from '../views/Users.vue'
import Notifications from '../views/Notifications.vue'

const routes = [
  { path: '/login', component: Login },
  {
    path: '/',
    component: AdminLayout,
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', component: Dashboard, meta: { title: '数据看板' } },
      { path: 'providers', component: Providers, meta: { title: '服务者管理' } },
      { path: 'calls', component: Calls, meta: { title: '通话订单' } },
      { path: 'recharge', component: Recharge, meta: { title: '充值记录' } },
      { path: 'withdraws', component: Withdraws, meta: { title: '提现审核' } },
      { path: 'transfers', component: Transfers, meta: { title: '打款记录' } },
      { path: 'users', component: Users, meta: { title: '用户管理' } },
      { path: 'notifications', component: Notifications, meta: { title: '提示管理' } }
    ]
  }
]

export default createRouter({ history: createWebHistory(), routes })
