<template>
  <div class="page">
    <div class="topbar">
      <h2>通话订单</h2>
      <div class="tools">
        <el-input v-model="keyword" placeholder="搜索用户/服务者/订单ID" style="width:240px" @keyup.enter="onSearch" />
        <el-button type="primary" @click="onSearch" style="margin-left:8px">搜索</el-button>
        <el-button @click="reset">重置</el-button>
      </div>
    </div>
    <el-table :data="list" border>
      <el-table-column prop="id" label="ID" width="90" />
      <el-table-column prop="user_name" label="用户" width="110" />
      <el-table-column prop="provider_name" label="服务者" width="110" />
      <el-table-column label="类型" width="70">
        <template #default="{ row }">{{ row.call_type === 2 ? '视频' : '语音' }}</template>
      </el-table-column>
      <el-table-column label="时长" width="100">
        <template #default="{ row }">{{ fmtDur(row.duration) }}</template>
      </el-table-column>
      <el-table-column label="金额(元)" width="100">
        <template #default="{ row }">{{ row.amount }}</template>
      </el-table-column>
      <el-table-column prop="provider_income" label="服务者收入" width="110" />
      <el-table-column prop="platform_fee" label="平台费" width="90" />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'info'">{{ ['进行中', '已结束', '异常'][row.status] || row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">{{ fmtTime(row.created_at) }}</template>
      </el-table-column>
    </el-table>
    <el-pagination class="pager" background layout="total, prev, pager, next"
      :total="total" :page-size="pageSize" :current-page="page" @current-change="onPageChange" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getCalls } from '../api'

const list = ref([])
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const total = ref(0)

async function load() {
  try {
    const res = await getCalls(page.value, pageSize.value, keyword.value)
    list.value = res.list || []
    total.value = res.total || 0
  } catch (e) { ElMessage.error('加载失败: ' + (e.response?.data?.msg || e.message)) }
}
function onSearch() { page.value = 1; load() }
function reset() { keyword.value = ''; page.value = 1; load() }
function onPageChange(p) { page.value = p; load() }
function fmtDur(s) { s = s || 0; const m = Math.floor(s / 60); return m + '分' + (s % 60) + '秒' }
function fmtTime(t) { if (!t) return '-'; return new Date(t * 1000).toLocaleString() }

onMounted(load)
</script>

<style scoped>
.page { padding: 28px 36px; }
.topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.topbar h2 { margin: 0; color: #2D3142; }
.pager { margin-top: 16px; justify-content: flex-end; }
</style>
