<template>
  <div class="page">
    <div class="topbar">
      <h2>打款记录 <span class="sub">（商家转账到零钱 · 倾听者分佣）</span></h2>
      <div class="tools">
        <el-input v-model="keyword" placeholder="搜索服务者/商户单号/状态" style="width:240px" @keyup.enter="onSearch" />
        <el-button type="primary" @click="onSearch" style="margin-left:8px">搜索</el-button>
        <el-button @click="reset">重置</el-button>
      </div>
    </div>
    <el-alert v-if="showHint" type="info" :closable="false" class="hint">
      打款通过「提现审核 → 打款」触发，调用微信「商家转账到零钱」。结果异步，受理后可点「查询最新状态」刷新微信侧状态。
    </el-alert>
    <el-table :data="list" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="provider_name" label="服务者" width="110" />
      <el-table-column prop="withdraw_id" label="提现单" width="90" />
      <el-table-column label="金额(元)" width="100">
        <template #default="{ row }">{{ row.amount }}</template>
      </el-table-column>
      <el-table-column label="微信状态" width="130">
        <template #default="{ row }">
          <el-tag :type="stateType(row.state)">{{ stateText(row.state) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="out_bill_no" label="商户单号" width="200" show-overflow-tooltip />
      <el-table-column prop="wx_bill_no" label="微信转账单号" width="200" show-overflow-tooltip />
      <el-table-column prop="fail_reason" label="失败原因" min-width="160" show-overflow-tooltip />
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">{{ fmtTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="doQuery(row)" :loading="row._loading">查询最新状态</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination class="pager" background layout="total, prev, pager, next"
      :total="total" :page-size="pageSize" :current-page="page" @current-change="onPageChange" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getTransfers, queryTransfer } from '../api'

const list = ref([])
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const total = ref(0)
const showHint = ref(true)

// 微信侧状态：ACCEPTED 受理成功 / PROCESSING 处理中 / FINISHED 成功 / FAIL 失败 / CANCELING / CANCELLED
function stateText(s) {
  return { ACCEPTED: '受理成功', PROCESSING: '处理中', FINISHED: '已到账', FAIL: '失败', CANCELING: '撤销中', CANCELLED: '已撤销' }[s] || (s || '受理中')
}
function stateType(s) {
  return { ACCEPTED: 'warning', PROCESSING: 'warning', FINISHED: 'success', FAIL: 'danger', CANCELING: 'info', CANCELLED: 'info' }[s] || 'info'
}

async function load() {
  try {
    const res = await getTransfers(page.value, pageSize.value, keyword.value)
    list.value = res.list || []
    total.value = res.total || 0
  } catch (e) { ElMessage.error('加载失败: ' + (e.response?.data?.msg || e.message)) }
}
function onSearch() { page.value = 1; load() }
function reset() { keyword.value = ''; page.value = 1; load() }
function onPageChange(p) { page.value = p; load() }
function fmtTime(t) { if (!t) return '-'; return new Date(t * 1000).toLocaleString() }

async function doQuery(row) {
  row._loading = true
  try {
    const res = await queryTransfer(row.id)
    ElMessage.success('已更新：' + (res.state || ''))
    await load()
  } catch (e) { ElMessage.error('查询失败: ' + (e.response?.data?.msg || e.message)) }
  finally { row._loading = false }
}

onMounted(load)
</script>

<style scoped>
.page { padding: 28px 36px; }
.topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.topbar h2 { margin: 0; color: #2D3142; }
.topbar .sub { font-size: 13px; color: #9aa0ab; font-weight: normal; }
.hint { margin-bottom: 14px; }
.pager { margin-top: 16px; justify-content: flex-end; }
</style>
