<template>
  <div class="page">
    <div class="topbar">
      <h2>用户管理</h2>
      <div class="tools">
        <el-input v-model="keyword" placeholder="搜索H号/昵称/手机/openid" style="width:260px" @keyup.enter="onSearch" />
        <el-button type="primary" @click="onSearch" style="margin-left:8px">搜索</el-button>
        <el-button @click="reset">重置</el-button>
      </div>
    </div>
    <el-table :data="list" border>
      <el-table-column prop="h_no" label="H号" width="100" />
      <el-table-column prop="nickname" label="昵称" width="120" />
      <el-table-column prop="phone" label="手机" width="130" />
      <el-table-column label="余额(元)" width="110">
        <template #default="{ row }">{{ row.balance }}</template>
      </el-table-column>
      <el-table-column label="冻结" width="90">
        <template #default="{ row }">{{ row.frozen }}</template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'info'">{{ row.status === 1 ? '正常' : '禁用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="call_count" label="通话次数" width="90" />
      <el-table-column label="消费(元)" width="100">
        <template #default="{ row }">{{ row.total_spent }}</template>
      </el-table-column>
      <el-table-column label="充值(元)" width="100">
        <template #default="{ row }">{{ row.total_recharged }}</template>
      </el-table-column>
      <el-table-column label="注册时间" width="170">
        <template #default="{ row }">{{ fmtTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="openBalance(row)">调余额</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination class="pager" background layout="total, prev, pager, next"
      :total="total" :page-size="pageSize" :current-page="page" @current-change="onPageChange" />

    <!-- 调整余额 -->
    <el-dialog v-model="adjVisible" title="调整用户余额" width="440px">
      <div style="font-size:13px;color:#8A8FA3;margin-bottom:12px;">
        目标：{{ adjUser?.nickname }}（H号 {{ adjUser?.h_no }}） · 当前余额 ¥{{ adjUser?.balance }}
      </div>
      <el-form label-width="72px">
        <el-form-item label="金额(元)">
          <el-input-number v-model="adjAmount" :step="10" :min="-100000" :max="1000000" controls-position="right" style="width:100%" />
          <div style="font-size:12px;color:#8A8FA3;margin-top:4px;">正数=充值加款，负数=扣减；1 元 = 10 H币</div>
        </el-form-item>
        <el-form-item label="原因">
          <el-input v-model="adjReason" placeholder="如：真实环境测试充值" maxlength="60" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjVisible = false">取消</el-button>
        <el-button type="primary" :loading="adjLoading" @click="confirmBalance">确认调整</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getUsers, adjustUserBalance } from '../api'

const list = ref([])
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const total = ref(0)

// 调余额
const adjVisible = ref(false)
const adjLoading = ref(false)
const adjUser = ref(null)
const adjAmount = ref(100)
const adjReason = ref('')

async function load() {
  try {
    const res = await getUsers(page.value, pageSize.value, keyword.value)
    list.value = res.list || []
    total.value = res.total || 0
  } catch (e) { ElMessage.error('加载失败: ' + (e.response?.data?.msg || e.message)) }
}
function onSearch() { page.value = 1; load() }
function reset() { keyword.value = ''; page.value = 1; load() }
function onPageChange(p) { page.value = p; load() }
function fmtTime(t) { if (!t) return '-'; return new Date(t * 1000).toLocaleString() }

function openBalance(row) {
  adjUser.value = row
  adjAmount.value = 100
  adjReason.value = ''
  adjVisible.value = true
}

async function confirmBalance() {
  if (!adjReason.value.trim()) { ElMessage.warning('请填写调整原因'); return }
  if (!adjAmount.value) { ElMessage.warning('金额不能为 0'); return }
  adjLoading.value = true
  try {
    const res = await adjustUserBalance({
      user_id: adjUser.value.id,
      amount: adjAmount.value,
      reason: adjReason.value.trim()
    })
    adjLoading.value = false
    adjVisible.value = false
    ElMessage.success(`已调整：${adjUser.value.nickname} 余额 → ¥${res.balance}（${res.balance_coins} ${res.coin_name}）`)
    load()
  } catch (e) {
    adjLoading.value = false
    ElMessage.error(e.msg || e.message || '调整失败')
  }
}

onMounted(load)
</script>

<style scoped>
.page { padding: 28px 36px; }
.topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.topbar h2 { margin: 0; color: #2D3142; }
.pager { margin-top: 16px; justify-content: flex-end; }
</style>
