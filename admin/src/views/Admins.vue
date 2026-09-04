<template>
  <div class="page">
    <div class="topbar">
      <h2>管理员管理</h2>
      <div class="tools">
        <span class="tip muted">超级管理员仅可改密码、不可删除；普通管理员由你添加 / 删除 / 重置密码</span>
        <el-button type="primary" @click="openCreate" style="margin-left:12px">+ 新增管理员</el-button>
      </div>
    </div>

    <el-table :data="list" border>
      <el-table-column prop="username" label="账号" width="130" />
      <el-table-column prop="real_name" label="姓名" width="130">
        <template #default="{ row }">{{ row.real_name || '-' }}</template>
      </el-table-column>
      <el-table-column prop="phone" label="手机号" width="150">
        <template #default="{ row }">{{ row.phone || '-' }}</template>
      </el-table-column>
      <el-table-column label="角色" width="120">
        <template #default="{ row }">
          <el-tag :type="row.role === 'super' ? 'danger' : (row.role === 'finance' ? 'warning' : 'success')">
            {{ roleText(row.role) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'info'">{{ row.status === 1 ? '正常' : '禁用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="最近登录" width="170">
        <template #default="{ row }">{{ fmtTime(row.last_login_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.role !== 'super'" type="primary" link @click="openEdit(row)">编辑</el-button>
          <el-button type="warning" link @click="openPwd(row)">改密码</el-button>
          <el-button v-if="row.role !== 'super' && row.username !== meName" type="danger" link @click="onDelete(row)">删除</el-button>
          <span v-if="row.role === 'super'" class="muted" style="font-size:12px;">（超管不可删）</span>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增 -->
    <el-dialog v-model="createVisible" title="新增管理员" width="460px">
      <el-form label-width="80px">
        <el-form-item label="账号" required>
          <el-input v-model="create.username" placeholder="登录账号（唯一）" maxlength="24" />
        </el-form-item>
        <el-form-item label="密码" required>
          <el-input v-model="create.password" type="password" show-password placeholder="至少 6 位" maxlength="32" />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="create.real_name" maxlength="24" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="create.phone" placeholder="用于找回密码（建议绑定）" maxlength="20" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="create.role" style="width:100%">
            <el-option label="运营 operator" value="operator" />
            <el-option label="财务 finance" value="finance" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="onCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- 编辑普通管理员 -->
    <el-dialog v-model="editVisible" title="编辑管理员" width="460px">
      <div style="font-size:13px;color:#8A8FA3;margin-bottom:12px;">账号：{{ edit.username }}（{{ roleText(edit.role) }}）</div>
      <el-form label-width="80px">
        <el-form-item label="姓名">
          <el-input v-model="edit.real_name" maxlength="24" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="edit.phone" placeholder="用于找回密码" maxlength="20" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="edit.role" style="width:100%">
            <el-option label="运营 operator" value="operator" />
            <el-option label="财务 finance" value="finance" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="editStatusOn" active-text="正常" inactive-text="禁用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="onEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 修改 / 重置密码 -->
    <el-dialog v-model="pwdVisible" title="重置密码" width="420px">
      <div style="font-size:13px;color:#8A8FA3;margin-bottom:12px;">
        账号：{{ pwd.username }}<template v-if="pwd.role === 'super'">（超级管理员）</template>
      </div>
      <el-form label-width="80px">
        <el-form-item label="新密码" required>
          <el-input v-model="pwd.password" type="password" show-password placeholder="至少 6 位" maxlength="32" />
        </el-form-item>
        <el-form-item label="确认密码" required>
          <el-input v-model="pwd.password2" type="password" show-password placeholder="再次输入新密码" maxlength="32" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdVisible = false">取消</el-button>
        <el-button type="warning" :loading="loading" @click="onPwd">重置密码</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getAdmins, createAdmin, updateAdmin, deleteAdmin } from '../api'

const list = ref([])
const meName = ref(localStorage.getItem('admin_name') || '')

const createVisible = ref(false)
const editVisible = ref(false)
const pwdVisible = ref(false)
const loading = ref(false)

const emptyCreate = () => ({ username: '', password: '', real_name: '', phone: '', role: 'operator' })
const create = ref(emptyCreate())
const edit = ref({ id: 0, username: '', real_name: '', phone: '', role: 'operator' })
const editStatusOn = ref(true)
const pwd = ref({ id: 0, username: '', role: '', password: '', password2: '' })

function roleText(r) {
  return r === 'super' ? '超级管理员' : r === 'finance' ? '财务 finance' : '运营 operator'
}
function fmtTime(t) { if (!t) return '-'; return new Date(t * 1000).toLocaleString() }

async function load() {
  try {
    const res = await getAdmins()
    list.value = res.list || []
  } catch (e) { ElMessage.error(e.msg || e.message || '加载失败') }
}

function openCreate() {
  create.value = emptyCreate()
  createVisible.value = true
}
function openEdit(row) {
  edit.value = { id: row.id, username: row.username, real_name: row.real_name || '', phone: row.phone || '', role: row.role }
  editStatusOn.value = row.status === 1
  editVisible.value = true
}
function openPwd(row) {
  pwd.value = { id: row.id, username: row.username, role: row.role, password: '', password2: '' }
  pwdVisible.value = true
}

function validPhone(p) { return !p || /^1\d{10}$/.test(p) }

async function onCreate() {
  const c = create.value
  if (!c.username.trim() || !c.password) { ElMessage.warning('账号和密码必填'); return }
  if (c.password.length < 6) { ElMessage.warning('密码至少 6 位'); return }
  if (!validPhone(c.phone.trim())) { ElMessage.warning('手机号格式不正确'); return }
  loading.value = true
  try {
    await createAdmin({
      username: c.username.trim(), password: c.password,
      real_name: c.real_name.trim(), phone: c.phone.trim(), role: c.role
    })
    loading.value = false; createVisible.value = false
    ElMessage.success('已创建')
    load()
  } catch (e) { loading.value = false; ElMessage.error(e.msg || e.message || '创建失败') }
}

async function onEdit() {
  const e = edit.value
  if (!validPhone(e.phone.trim())) { ElMessage.warning('手机号格式不正确'); return }
  loading.value = true
  try {
    await updateAdmin(e.id, {
      real_name: e.real_name.trim(), phone: e.phone.trim(),
      role: e.role, status: editStatusOn.value ? 1 : 3
    })
    loading.value = false; editVisible.value = false
    ElMessage.success('已保存')
    load()
  } catch (err) { loading.value = false; ElMessage.error(err.msg || err.message || '保存失败') }
}

async function onPwd() {
  const p = pwd.value
  if (!p.password || p.password.length < 6) { ElMessage.warning('密码至少 6 位'); return }
  if (p.password !== p.password2) { ElMessage.warning('两次输入的密码不一致'); return }
  loading.value = true
  try {
    await updateAdmin(p.id, { password: p.password })
    loading.value = false; pwdVisible.value = false
    ElMessage.success('密码已重置')
  } catch (err) { loading.value = false; ElMessage.error(err.msg || err.message || '重置失败') }
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(`确定删除管理员「${row.username}」？删除后不可恢复。`, '删除确认', { type: 'warning' })
  } catch (e) { return }
  loading.value = true
  try {
    await deleteAdmin(row.id)
    loading.value = false
    ElMessage.success('已删除')
    load()
  } catch (err) { loading.value = false; ElMessage.error(err.msg || err.message || '删除失败') }
}

onMounted(load)
</script>

<style scoped>
.page { padding: 28px 36px; }
.topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.topbar h2 { margin: 0; color: #2D3142; }
.tools { display: flex; align-items: center; }
.tip { font-size: 12px; }
.muted { color: #8A8FA3; }
</style>
