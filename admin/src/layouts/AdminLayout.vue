<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="logo">
        <svg class="ico logo-ico" viewBox="0 0 24 24" v-html="icons.cup"></svg>
        <span>Hearcup</span>
      </div>

      <el-menu
        :default-active="active"
        router
        background-color="transparent"
        text-color="#2f3a3a"
        active-text-color="#ffffff"
      >
        <el-menu-item index="/dashboard">
          <svg class="ico" viewBox="0 0 24 24" v-html="icons.dashboard"></svg><span>数据看板</span>
        </el-menu-item>
        <el-menu-item index="/providers">
          <svg class="ico" viewBox="0 0 24 24" v-html="icons.providers"></svg><span>服务者管理</span>
        </el-menu-item>
        <el-sub-menu index="finance">
          <template #title>
            <svg class="ico" viewBox="0 0 24 24" v-html="icons.orders"></svg><span>订单财务</span>
          </template>
          <el-menu-item index="/calls">通话订单</el-menu-item>
          <el-menu-item index="/recharge">充值记录</el-menu-item>
          <el-menu-item index="/withdraws">提现审核</el-menu-item>
          <el-menu-item index="/transfers">打款记录</el-menu-item>
        </el-sub-menu>
        <el-menu-item index="/users">
          <svg class="ico" viewBox="0 0 24 24" v-html="icons.users"></svg><span>用户管理</span>
        </el-menu-item>
        <el-menu-item index="/notifications">
          <svg class="ico" viewBox="0 0 24 24" v-html="icons.bell"></svg><span>提示管理</span>
        </el-menu-item>
        <el-menu-item v-if="isSuper" index="/admins">
          <svg class="ico" viewBox="0 0 24 24" v-html="icons.admins"></svg><span>管理员管理</span>
        </el-menu-item>
      </el-menu>

      <div class="logout" @click="logout">
        <svg class="ico" viewBox="0 0 24 24" v-html="icons.logout"></svg>
        <span>退出登录</span>
      </div>
    </aside>

    <main class="content">
      <div class="topbar">
        <span class="crumb">{{ title }}</span>
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
// 当前登录角色（登录时写入 localStorage；兼容旧会话：仅明确 operator/finance 隐藏入口，
// 角色缺失/旧会话默认可见，越权由后端 requireSuper 兜底拦截）
const isSuper = computed(() => {
  const role = localStorage.getItem('admin_role')
  return role !== 'operator' && role !== 'finance'
})

function logout() {
  localStorage.removeItem('admin_token')
  localStorage.removeItem('admin_role')
  localStorage.removeItem('admin_name')
  router.push('/login')
}

// 扁平描边图标（内联 SVG，stroke=currentColor，选中时随文字变白）——沿用旧版单文件后台的图标
const icons = {
  cup: '<path d="M5 9h11v4a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V9z"/><path d="M16 10h2.5a2 2 0 0 1 0 4H16"/><path d="M8 3v2M11 3v2"/>',
  dashboard: '<path d="M4 20V4M4 20h16"/><rect x="7.5" y="12" width="3" height="6"/><rect x="12.5" y="8" width="3" height="10"/><rect x="17.5" y="14" width="3" height="4"/>',
  providers: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c0-3.3 2.7-5.5 5.5-5.5s5.5 2.2 5.5 5.5"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.5c2.2.4 3.5 2.2 3.5 5"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 2.7-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 15c2.4.3 3.5 2.4 3.5 5"/>',
  orders: '<rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18"/><circle cx="17" cy="14.5" r="1.3"/>',
  withdraws: '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18"/><path d="M16.5 14.5h2"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  transfers: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M2.5 10h19"/><path d="M6 15h4"/>',
  admins: '<circle cx="12" cy="8.5" r="3.2"/><path d="M4.5 20c0-3 3-5 7.5-5s7.5 2 7.5 5"/><path d="M17 4l.9 2 2 .9-2 .9-.9 2-.9-2-2-.9 2-.9z"/>',
  logout: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M9 12h11M16 9l3 3-3 3"/>'
}
</script>

<style scoped>
.layout { display: flex; min-height: 100vh; }
.sidebar {
  width: 210px; background: #fff; color: #2f3a3a; flex-shrink: 0;
  border-right: 1px solid #eee5dc; display: flex; flex-direction: column;
}
.logo {
  padding: 24px 16px 20px; display: flex; align-items: center; gap: 8px;
  color: #3A9E8F; font-size: 19px; font-weight: 700;
}
.logo-ico { width: 22px; height: 22px; }
.ico {
  width: 18px; height: 18px; flex: none; margin-right: 9px;
  stroke: currentColor; fill: none; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round;
}
.sidebar :deep(.el-menu) { border-right: none; flex: 1; padding: 0 6px; }
.sidebar :deep(.el-menu-item),
.sidebar :deep(.el-sub-menu__title) {
  height: 44px; line-height: 44px; margin: 4px 8px; border-radius: 10px; color: #2f3a3a;
}
.sidebar :deep(.el-menu-item:hover),
.sidebar :deep(.el-sub-menu__title:hover) { background: #f6faf8; }
.sidebar :deep(.el-menu-item.is-active) { background: #3A9E8F; color: #fff; }
.sidebar :deep(.el-sub-menu .el-menu-item) { min-width: 0; }
.logout {
  display: flex; align-items: center; padding: 14px 16px; margin: 12px 8px;
  border-radius: 10px; color: #8a9a98; cursor: pointer; font-size: 14px;
}
.logout:hover { background: #f6faf8; color: #2f3a3a; }
.logout .ico { margin-right: 9px; }

.content { flex: 1; display: flex; flex-direction: column; background: #FBF7F2; min-width: 0; }
.topbar {
  height: 56px; display: flex; align-items: center; padding: 0 28px;
  background: #fff; border-bottom: 1px solid #eee5dc;
}
.crumb { font-weight: 600; color: #2f3a3a; font-size: 16px; }
.page-wrap { padding: 24px 28px; flex: 1; overflow: auto; }
</style>
