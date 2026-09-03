<template>
  <div class="page">
    <div class="topbar">
      <h2>服务者管理</h2>
      <div class="tools">
        <el-input v-model="keyword" placeholder="搜索昵称/姓名/城市/手机" style="width:240px" @keyup.enter="onSearch" />
        <el-button type="primary" @click="onSearch" style="margin-left:8px">搜索</el-button>
        <el-button @click="resetSearch">重置</el-button>
      </div>
    </div>

    <el-tabs v-model="tab" @tab-change="onTabChange">
      <el-tab-pane label="全部服务者" name="all" />
      <el-tab-pane :label="`待审核(${pendList.length})`" name="pending" />
    </el-tabs>

    <el-table :data="tab === 'pending' ? pendList : allList" border style="width:100%">
      <el-table-column prop="nickname" label="昵称" width="120" />
      <el-table-column prop="real_name" label="真实姓名" width="100" />
      <el-table-column label="性别" width="60">
        <template #default="{ row }">{{ row.gender === 1 ? '男' : '女' }}</template>
      </el-table-column>
      <el-table-column prop="age" label="年龄" width="60" />
      <el-table-column prop="city" label="城市" width="100" />
      <el-table-column prop="education" label="学历" width="100" />
      <el-table-column prop="major" label="专业" width="120" />
      <el-table-column prop="years_of_exp" label="从业年限" width="90" />
      <el-table-column prop="consult_hours" label="咨询时长" width="90">
        <template #default="{ row }">{{ row.consult_hours }}h</template>
      </el-table-column>
      <el-table-column label="价格档位" width="150">
        <template #default="{ row }">
          <el-tag v-for="(price, mins) in priceTiers(row.price_tiers)" :key="mins" size="small" style="margin-right:4px">
            {{ mins }}分 {{ price }}元
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="认证等级" width="90">
        <template #default="{ row }">{{ ['实习','认证','资深'][row.level - 1] || '-' }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="rating" label="评分" width="70" />
      <el-table-column prop="total_sessions" label="服务次数" width="90" />
      <el-table-column label="操作" min-width="240">
        <template #default="{ row }">
          <el-button size="small" @click="edit(row)">编辑</el-button>
          <template v-if="row.status === 0">
            <el-button size="small" type="success" @click="approve(row, true)">通过</el-button>
            <el-button size="small" type="danger" @click="approve(row, false)">拒绝</el-button>
          </template>
          <template v-else>
            <el-button size="small" :type="row.is_online ? 'warning' : 'success'" @click="toggleOnline(row)">
              {{ row.is_online ? '下线' : '上线' }}
            </el-button>
            <el-button size="small" :type="row.status === 3 ? 'success' : 'danger'" @click="toggleStatus(row)">
              {{ row.status === 3 ? '启用' : '禁用' }}
            </el-button>
          </template>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination v-if="tab === 'all'" class="pager" background layout="total, prev, pager, next"
      :total="total" :page-size="pageSize" :current-page="page" @current-change="onPageChange" />

    <!-- 编辑弹窗 -->
    <el-dialog v-model="editVisible" title="编辑服务者" width="700px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="昵称"><el-input v-model="editForm.nickname" disabled /></el-form-item>
        <el-form-item label="真实姓名"><el-input v-model="editForm.realName" /></el-form-item>
        <el-form-item label="性别">
          <el-radio-group v-model="editForm.gender"><el-radio :label="1">男</el-radio><el-radio :label="0">女</el-radio></el-radio-group>
        </el-form-item>
        <el-form-item label="年龄"><el-input-number v-model="editForm.age" :min="18" :max="80" /></el-form-item>
        <el-form-item label="城市"><el-input v-model="editForm.city" /></el-form-item>
        <el-form-item label="学历"><el-input v-model="editForm.education" /></el-form-item>
        <el-form-item label="专业"><el-input v-model="editForm.major" /></el-form-item>
        <el-form-item label="从业年限"><el-input-number v-model="editForm.yearsOfExp" :min="0" :max="50" /></el-form-item>
        <el-form-item label="咨询时长"><el-input-number v-model="editForm.consultHours" :min="0" :max="100000" /></el-form-item>
        <el-form-item label="个人简介"><el-input type="textarea" v-model="editForm.intro" :rows="3" /></el-form-item>
        <el-form-item label="擅长领域"><el-input v-model="editForm.expertise" placeholder="逗号分隔" /></el-form-item>
        <el-form-item label="单价（元/分）"><el-input-number v-model="editForm.pricePerMinute" :precision="2" :min="0" :step="0.1" /></el-form-item>
        <el-form-item label="价格档位（JSON）"><el-input type="textarea" v-model="editForm.priceTiers" :rows="3" placeholder='{"15":15,"30":28.5,"60":54}' /></el-form-item>
        <el-form-item label="认证等级">
          <el-radio-group v-model="editForm.level"><el-radio :label="1">实习</el-radio><el-radio :label="2">认证</el-radio><el-radio :label="3">资深</el-radio></el-radio-group>
        </el-form-item>
        <el-form-item label="每日限额"><el-input-number v-model="editForm.dailyLimit" :min="0" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 审核拒绝弹窗 -->
    <el-dialog v-model="rejectVisible" title="拒绝原因" width="500px">
      <el-input v-model="rejectReason" type="textarea" :rows="4" placeholder="请输入拒绝原因" />
      <template #footer>
        <el-button @click="rejectVisible = false">取消</el-button>
        <el-button type="danger" @click="confirmReject">确认拒绝</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getProviders, getApplications, approveProvider, updateProvider, setProviderStatus } from '../api'

const allList = ref([])
const pendList = ref([])
const tab = ref('all')
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const total = ref(0)
const editVisible = ref(false)
const rejectVisible = ref(false)
const rejectReason = ref('')
const editForm = ref({})
const currentRow = ref(null)

async function loadAll() {
  try {
    const res = await getProviders(page.value, pageSize.value, keyword.value)
    allList.value = res.list || []
    total.value = res.total || 0
  } catch (e) {
    ElMessage.error('加载失败: ' + (e.msg || e.response?.data?.msg || e.response?.data?.error || e.message))
  }
}
async function loadPend() {
  try {
    const res = await getApplications(1, 999, keyword.value)
    pendList.value = res.list || []
  } catch (e) {
    ElMessage.error('加载待审核失败: ' + (e.msg || e.response?.data?.msg || e.message))
  }
}
function load() { loadAll(); loadPend() }
function onSearch() { page.value = 1; loadAll() }
function resetSearch() { keyword.value = ''; page.value = 1; load() }
function onPageChange(p) { page.value = p; loadAll() }
function onTabChange() { if (tab.value === 'pending') loadPend() }

function statusText(s) { return ['待审核', '通过', '拒绝', '禁用'][s] || '未知' }
function statusType(s) { return ['warning', 'success', 'danger', 'info'][s] || 'info' }
function priceTiers(str) {
  try { return JSON.parse(str || '{}') } catch { return {} }
}

function edit(row) {
  editForm.value = {
    id: row.id, nickname: row.nickname, realName: row.real_name, gender: row.gender,
    age: row.age, city: row.city, education: row.education, major: row.major,
    yearsOfExp: row.years_of_exp, consultHours: row.consult_hours, intro: row.intro,
    expertise: row.expertise, pricePerMinute: row.price_per_minute,
    priceTiers: row.price_tiers || JSON.stringify({ '15': 15, '30': 28.5, '60': 54 }),
    level: row.level, dailyLimit: row.daily_limit
  }
  currentRow.value = row
  editVisible.value = true
}

async function saveEdit() {
  try {
    try { JSON.parse(editForm.value.priceTiers) } catch {
      ElMessage.error('价格档位必须是有效的 JSON'); return
    }
    const payload = {
      real_name: editForm.value.realName, gender: editForm.value.gender, age: editForm.value.age,
      city: editForm.value.city, education: editForm.value.education, major: editForm.value.major,
      years_of_exp: editForm.value.yearsOfExp, consult_hours: editForm.value.consultHours,
      intro: editForm.value.intro, expertise: editForm.value.expertise,
      price_per_minute: editForm.value.pricePerMinute, price_tiers: editForm.value.priceTiers,
      level: editForm.value.level, daily_limit: editForm.value.dailyLimit
    }
    await updateProvider(editForm.value.id, payload)
    Object.assign(currentRow.value, editForm.value)
    editVisible.value = false
    ElMessage.success('已保存')
    load()
  } catch (e) {
    ElMessage.error('保存失败: ' + (e.msg || e.response?.data?.msg || e.response?.data?.error || e.message))
  }
}

function approve(row, pass) {
  if (pass) {
    ElMessageBox.confirm('确认通过该服务者？', '提示', { type: 'warning' })
      .then(async () => {
        try {
          await approveProvider(row.id, true, '')
          row.status = 1
          ElMessage.success('已通过'); load()
        } catch (e) { ElMessage.error('操作失败: ' + (e.msg || e.response?.data?.error || e.message)) }
      })
  } else {
    currentRow.value = row; rejectReason.value = ''; rejectVisible.value = true
  }
}

async function confirmReject() {
  if (!rejectReason.value.trim()) { ElMessage.warning('请输入拒绝原因'); return }
  try {
    await approveProvider(currentRow.value.id, false, rejectReason.value)
    currentRow.value.status = 2
    currentRow.value.rejectReason = rejectReason.value
    rejectVisible.value = false
    ElMessage.success('已拒绝'); load()
  } catch (e) { ElMessage.error('操作失败: ' + (e.msg || e.response?.data?.error || e.message)) }
}

async function toggleOnline(row) {
  const newStatus = row.is_online ? 0 : 1
  try {
    await setProviderStatus(row.id, row.status, newStatus, row.price_per_minute)
    row.is_online = newStatus
    if (newStatus === 0) row.is_busy = 0
    ElMessage.success(newStatus ? '已上线' : '已下线')
  } catch (e) { ElMessage.error('操作失败: ' + (e.msg || e.response?.data?.error || e.message)) }
}

async function toggleStatus(row) {
  const newStatus = row.status === 3 ? 1 : 3
  const action = newStatus === 1 ? '启用' : '禁用'
  ElMessageBox.confirm(`确认${action}该服务者？`, '提示', { type: 'warning' })
    .then(async () => {
      try {
        await setProviderStatus(row.id, newStatus, row.is_online, row.price_per_minute)
        row.status = newStatus
        ElMessage.success(`已${action}`); load()
      } catch (e) { ElMessage.error('操作失败: ' + (e.msg || e.response?.data?.error || e.message)) }
    })
}

onMounted(() => load())
</script>

<style scoped>
.page { padding: 28px 36px; }
.topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.topbar h2 { margin: 0; color: #2D3142; }
.pager { margin-top: 16px; justify-content: flex-end; }
</style>
