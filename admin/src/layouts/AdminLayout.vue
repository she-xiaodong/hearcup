<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="logo">🍵 一杯心晴</div>
      <el-menu :default-active="active" router background-color="transparent" text-color="#cfd3dc" active-text-color="#4FB8A8">
        <el-menu-item index="/dashboard">📊 数据看板</el-menu-item>
        <el-menu-item index="/providers">👩 服务者管理</el-menu-item>
        <el-sub-menu index="finance">
          <template #title>💰 订单财务</template>
          <el-menu-item index="/calls">通话订单</el-menu-item>
          <el-menu-item index="/recharge">充值记录</el-menu-item>
          <el-menu-item index="/withdraws">提现审核</el-menu-item>
          <el-menu-item index="/transfers">打款记录</el-menu-item>
        </el-sub-menu>
        <el-menu-item index="/users">👤 用户管理</el-menu-item>
        <el-menu-item index="/notifications">🔔 提示管理</el-menu-item>
      </el-menu>
    </aside>
    <main class="content">
      <div class="topbar">
        <span class="crumb">{{ title }}</span>
        <el-button text @click="logout">退出登录</el-button>
      </div>
      <div class="page-wrap">
        <router-view />
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const active = computed(() => route.path)
const title = computed(() => route.meta?.title || '管理后台')

function logout() {
  localStorage.removeItem('admin_token')
  router.push('/login')
}
</script>

<style scoped>
.layout { display: flex; min-height: 100vh; }
.sidebar { width: 210px; background: #2D3142; color: #fff; flex-shrink: 0; }
.logo { padding: 22px 20px; font-size: 18px; font-weight: bold; color: #4FB8A8; }
.sidebar :deep(.el-menu) { border-right: none; }
.sidebar :deep(.el-menu-item.is-active) { background: rgba(79,184,168,0.18); }
.content { flex: 1; display: flex; flex-direction: column; background: var(--hc-bg); min-width: 0; }
.topbar { height: 56px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 28px; background: #fff; border-bottom: 1px solid #eee; }
.crumb { font-weight: 600; color: #2D3142; }
.page-wrap { padding: 24px 28px; flex: 1; overflow: auto; }
</style>
