import { createRouter, createWebHistory } from 'vue-router'
import Login from '../views/Login.vue'
import Dashboard from '../views/Dashboard.vue'
import Providers from '../views/Providers.vue'

const routes = [
  { path: '/', redirect: '/login' },
  { path: '/login', component: Login },
  { path: '/dashboard', component: Dashboard, meta: { title: '数据看板' } },
  { path: '/providers', component: Providers, meta: { title: '服务者管理' } }
]

export default createRouter({ history: createWebHistory(), routes })
