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
      <el-table-column label="余额(H币)" width="110">
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
    </el-table>
    <el-pagination class="pager" background layout="total, prev, pager, next"
      :total="total" :page-size="pageSize" :current-page="page" @current-change="onPageChange" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getUsers } from '../api'

const list = ref([])
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const total = ref(0)

async function load() {
  try {
    const res = await getUsers(page.value, pageSize.value, keyword.value)
    list.value = res.data.list || []
    total.value = res.data.total || 0
  } catch (e) { ElMessage.error('加载失败: ' + (e.response?.data?.msg || e.message)) }
}
function onSearch() { page.value = 1; load() }
function reset() { keyword.value = ''; page.value = 1; load() }
function onPageChange(p) { page.value = p; load() }
function fmtTime(t) { if (!t) return '-'; return new Date(t * 1000).toLocaleString() }

onMounted(load)
</script>

<style scoped>
.page { padding: 28px 36px; }
.topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.topbar h2 { margin: 0; color: #2D3142; }
.pager { margin-top: 16px; justify-content: flex-end; }
</style>
