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
import Admins from '../views/Admins.vue'

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
      { path: 'notifications', component: Notifications, meta: { title: '提示管理' } },
      { path: 'admins', component: Admins, meta: { title: '管理员管理', super: true } }
    ]
  }
]

const router = createRouter({ history: createWebHistory('/admin/'), routes })

router.beforeEach((to) => {
  const token = localStorage.getItem('admin_token')
  if (!token && to.path !== '/login') return '/login'
  if (token && to.path === '/login') return '/dashboard'
  // 超管专属页面：仅明确 operator/finance 拦截；角色缺失/旧会话放行，后端 requireSuper 兜底
  if (to.meta?.super) {
    const role = localStorage.getItem('admin_role')
    if (role === 'operator' || role === 'finance') return '/dashboard'
  }
  return true
})

export default router
