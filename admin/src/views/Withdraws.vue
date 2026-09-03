<template>
  <div class="page">
    <div class="topbar">
      <h2>提现审核</h2>
      <div class="tools">
        <el-input v-model="keyword" placeholder="搜索服务者/ID" style="width:220px" @keyup.enter="onSearch" />
        <el-button type="primary" @click="onSearch" style="margin-left:8px">搜索</el-button>
        <el-button @click="reset">重置</el-button>
      </div>
    </div>
    <el-table :data="list" border>
      <el-table-column prop="id" label="ID" width="90" />
      <el-table-column prop="provider_name" label="服务者" width="120" />
      <el-table-column label="金额(元)" width="110">
        <template #default="{ row }">{{ row.amount }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="wdType(row.status)">{{ wdText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="微信打款状态" width="130">
        <template #default="{ row }">
          <span v-if="row.transfer_state">{{ trText(row.transfer_state) }}</span>
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
      <el-table-column prop="transfer_no" label="转账单号" width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.transfer_no">{{ row.transfer_no }}</span>
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">{{ fmtTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" min-width="200">
        <template #default="{ row }">
          <template v-if="row.status === 0">
            <el-button size="small" type="success" @click="doAudit(row, 1)">通过</el-button>
            <el-button size="small" type="danger" @click="openReject(row)">拒绝</el-button>
          </template>
          <el-button v-else-if="row.status === 1" size="small" type="primary" @click="doAudit(row, 2)">打款</el-button>
          <span v-else>-</span>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination class="pager" background layout="total, prev, pager, next"
      :total="total" :page-size="pageSize" :current-page="page" @current-change="onPageChange" />

    <el-dialog v-model="rejectVisible" title="拒绝提现" width="500px">
      <el-input v-model="remark" type="textarea" :rows="4" placeholder="备注（可选）" />
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
import { getWithdraws, updateWithdraw } from '../api'

const list = ref([])
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const total = ref(0)
const rejectVisible = ref(false)
const remark = ref('')
const currentRow = ref(null)

// 状态：0待审核 1已通过 2已打款 3已拒绝
function wdText(s) { return ['待审核', '已通过', '已打款', '已拒绝'][s] || s }
function wdType(s) { return ['warning', 'success', 'primary', 'danger'][s] || 'info' }
// 微信转账状态文案
function trText(s) {
  return { ACCEPTED: '受理成功', PROCESSING: '处理中', FINISHED: '已到账', FAIL: '失败', CANCELING: '撤销中', CANCELLED: '已撤销' }[s] || s
}

async function load() {
  try {
    const res = await getWithdraws(page.value, pageSize.value, keyword.value)
    list.value = res.list || []
    total.value = res.total || 0
  } catch (e) { ElMessage.error('加载失败: ' + (e.response?.data?.msg || e.message)) }
}
function onSearch() { page.value = 1; load() }
function reset() { keyword.value = ''; page.value = 1; load() }
function onPageChange(p) { page.value = p; load() }
function fmtTime(t) { if (!t) return '-'; return new Date(t * 1000).toLocaleString() }

function doAudit(row, status) {
  const txt = status === 1 ? '通过' : '打款'
  ElMessageBox.confirm(`确认${txt}该提现申请？`, '提示', { type: 'warning' })
    .then(async () => {
      try {
        const res = await updateWithdraw(row.id, status, '')
        row.status = status
        if (status === 2 && res) {
          row.transfer_no = res.transfer_no || ''
          row.transfer_state = res.transfer_state || ''
          const st = trText(res.transfer_state || '')
          ElMessage.success(`已提交微信打款（${st}）`)
        } else {
          ElMessage.success(`已${txt}`)
        }
      } catch (e) { ElMessage.error('操作失败: ' + (e.response?.data?.msg || e.message)) }
    })
}
function openReject(row) { currentRow.value = row; remark.value = ''; rejectVisible.value = true }
async function confirmReject() {
  try {
    await updateWithdraw(currentRow.value.id, 3, remark.value)
    currentRow.value.status = 3
    rejectVisible.value = false
    ElMessage.success('已拒绝')
  } catch (e) { ElMessage.error('操作失败: ' + (e.response?.data?.msg || e.message)) }
}

onMounted(load)
</script>

<style scoped>
.page { padding: 28px 36px; }
.topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.topbar h2 { margin: 0; color: #2D3142; }
.pager { margin-top: 16px; justify-content: flex-end; }
.muted { color: #c0c4cc; }
</style>
