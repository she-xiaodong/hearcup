<template>
  <div class="login-wrap">
    <div class="login-card">
      <div class="brand">
        <div class="logo">🍵</div>
        <h1>一杯心晴</h1>
        <p class="sub">管理后台 · 倾听每一份情绪</p>
      </div>
      <el-input v-model="form.username" placeholder="管理员账号" size="large" />
      <el-input v-model="form.password" type="password" placeholder="密码" size="large" show-password style="margin-top:18rpx" />
      <el-button type="primary" size="large" class="login-btn" @click="onLogin">登 录</el-button>
    </div>
  </div>
</template>

<script setup>
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

const router = useRouter()
const form = reactive({ username: '', password: '' })

function onLogin() {
  if (!form.username || !form.password) {
    ElMessage.warning('请输入账号和密码')
    return
  }
  // 真实环境：POST /api/v1/admin/login -> 存 token
  ElMessage.success('登录成功（演示）')
  router.push('/dashboard')
}
</script>

<style scoped>
.login-wrap {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #E6F6F2 0%, #FFEDE5 100%);
}
.login-card {
  width: 380px; background: #fff; border-radius: 24px; padding: 48px 36px;
  box-shadow: 0 20px 60px rgba(79,184,168,0.18);
}
.brand { text-align: center; margin-bottom: 32px; }
.logo { font-size: 56px; }
.brand h1 { margin: 8px 0 4px; color: #3A9E8F; font-size: 28px; }
.sub { color: #8A8FA3; font-size: 14px; margin: 0; }
.login-btn { width: 100%; margin-top: 28px; height: 48px; border-radius: 999px;
  background: linear-gradient(135deg, #4FB8A8, #3A9E8F); border: none; font-weight: 600; }
</style>
