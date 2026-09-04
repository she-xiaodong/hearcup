<template>
  <div class="login-wrap">
    <div class="login-card">
      <div class="brand">
        <div class="logo">🫖</div>
        <h1>Hearcup 后台</h1>
        <p class="sub">一杯心晴 · 管理控制台</p>
      </div>
      <el-input v-model="form.username" placeholder="管理员账号" size="large" />
      <el-input v-model="form.password" type="password" placeholder="密码" size="large" show-password style="margin-top:18px" @keyup.enter="onLogin" />
      <el-button type="primary" size="large" class="login-btn" :loading="loading" @click="onLogin">登 录</el-button>
      <div class="forgot" @click="forgotVisible = true">忘记密码？用绑定手机号找回</div>
    </div>

    <!-- 手机号找回密码 -->
    <el-dialog v-model="forgotVisible" title="找回密码" width="420px" append-to-body>
      <div class="forgot-tip">需管理员账号曾在「管理员管理」中绑定手机号；校验通过后将直接重置密码。</div>
      <el-form label-width="70px">
        <el-form-item label="账号">
          <el-input v-model="forgot.username" placeholder="管理员账号" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="forgot.phone" placeholder="该账号绑定的手机号" maxlength="11" />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="forgot.password" type="password" show-password placeholder="至少 6 位" />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input v-model="forgot.password2" type="password" show-password placeholder="再次输入新密码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="forgotVisible = false">取消</el-button>
        <el-button type="warning" :loading="forgotLoading" @click="onForgot">找回密码</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { adminLogin, forgotAdminPassword } from '../api'

const router = useRouter()
const form = reactive({ username: '', password: '' })
const loading = ref(false)

const forgotVisible = ref(false)
const forgotLoading = ref(false)
const forgot = reactive({ username: '', phone: '', password: '', password2: '' })

async function onLogin() {
  if (!form.username || !form.password) {
    ElMessage.warning('请输入账号和密码')
    return
  }
  loading.value = true
  try {
    const data = await adminLogin(form.username, form.password)
    localStorage.setItem('admin_token', data.token)
    // 记录角色与账号：超管可见「管理员管理」菜单、页面限制删除自己
    const admin = data.admin || {}
    localStorage.setItem('admin_role', admin.role || '')
    localStorage.setItem('admin_name', admin.username || '')
    ElMessage.success('登录成功')
    router.push('/dashboard')
  } catch (e) {
    ElMessage.error(e.msg || e.message || '登录失败')
  } finally {
    loading.value = false
  }
}

async function onForgot() {
  const f = forgot
  if (!f.username.trim() || !f.phone.trim() || !f.password) {
    ElMessage.warning('请填写账号、手机号和新密码')
    return
  }
  if (!/^1\d{10}$/.test(f.phone.trim())) { ElMessage.warning('手机号格式不正确'); return }
  if (f.password.length < 6) { ElMessage.warning('密码至少 6 位'); return }
  if (f.password !== f.password2) { ElMessage.warning('两次输入的密码不一致'); return }
  forgotLoading.value = true
  try {
    const res = await forgotAdminPassword({
      username: f.username.trim(), phone: f.phone.trim(), password: f.password
    })
    forgotLoading.value = false
    forgotVisible.value = false
    forgot.username = ''; forgot.phone = ''; forgot.password = ''; forgot.password2 = ''
    ElMessage.success(res.msg || '密码已重置，请用新密码登录')
  } catch (e) {
    forgotLoading.value = false
    ElMessage.error(e.msg || e.message || '找回失败')
  }
}
</script>

<style scoped>
.login-wrap {
  min-height: 100vh; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #E6F6F2 0%, #FFEDE5 100%);
}
.login-card {
  width: 380px; background: #fff; border-radius: 24px; padding: 48px 36px;
  box-shadow: 0 20px 60px rgba(58,158,143,0.18);
}
.brand { text-align: center; margin-bottom: 32px; }
.logo { font-size: 56px; }
.brand h1 { margin: 8px 0 4px; color: #3A9E8F; font-size: 28px; }
.sub { color: #8A8FA3; font-size: 14px; margin: 0; }
.login-btn { width: 100%; margin-top: 28px; height: 48px; border-radius: 999px;
  background: linear-gradient(135deg, #3A9E8F, #2E8578); border: none; font-weight: 600; }
.forgot { margin-top: 14px; text-align: center; font-size: 13px; color: #3A9E8F; cursor: pointer; }
.forgot:hover { text-decoration: underline; }
.forgot-tip { font-size: 12px; color: #B8860B; background: #FFF7E6; border-radius: 8px; padding: 10px 12px; margin-bottom: 14px; line-height: 1.6; }
</style>
