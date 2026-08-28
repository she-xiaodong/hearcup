<template>
  <div class="page">
    <div class="topbar">
      <h2>服务者管理</h2>
      <el-button type="primary" round @click="load">刷新</el-button>
    </div>

    <el-tabs v-model="tab">
      <el-tab-pane label="全部服务者" name="all" />
      <el-tab-pane :label="`待审核(${pending.length})`" name="pending" />
    </el-tabs>

    <el-table :data="tab === 'pending' ? pending : list" border style="width:100%">
      <el-table-column prop="nickName" label="昵称" width="120" />
      <el-table-column label="角色" width="100">
        <template #default="{ row }">{{ row.role === 2 ? '咨询师' : '倾听师' }}</template>
      </el-table-column>
      <el-table-column label="认证等级" width="110">
        <template #default="{ row }">{{ ['实习','认证','资深'][row.level - 1] }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="rating" label="评分" width="80" />
      <el-table-column prop="totalSessions" label="服务次数" width="100" />
      <el-table-column label="操作" min-width="200">
        <template #default="{ row }">
          <template v-if="row.status === 0">
            <el-button size="small" type="success" @click="approve(row, true)">通过</el-button>
            <el-button size="small" type="danger" @click="approve(row, false)">拒绝</el-button>
          </template>
          <el-button v-else size="small" @click="toggleOnline(row)">
            {{ row.isOnline ? '下线' : '上线' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'

const list = ref([
  { id: 1001, nickName: '林清和', role: 2, level: 3, status: 1, isOnline: true, rating: 4.9, totalSessions: 1260 },
  { id: 1002, nickName: '小满', role: 1, level: 2, status: 1, isOnline: true, rating: 4.8, totalSessions: 540 },
  { id: 1005, nickName: '糖豆', role: 1, level: 1, status: 0, isOnline: false, rating: 4.6, totalSessions: 86 },
  { id: 1006, nickName: '老周', role: 1, level: 2, status: 3, isOnline: false, rating: 4.8, totalSessions: 720 }
])
const tab = ref('all')
const pending = computed(() => list.value.filter(p => p.status === 0))

function statusText(s) { return ['待审核', '通过', '拒绝', '禁用'][s] || '未知' }
function statusType(s) { return ['warning', 'success', 'danger', 'info'][s] || 'info' }

function approve(row, pass) {
  row.status = pass ? 1 : 2
  ElMessage.success(pass ? '已通过' : '已拒绝')
}
function toggleOnline(row) {
  row.isOnline = !row.isOnline
  ElMessage.info(row.isOnline ? '已上线' : '已下线')
}
function load() { ElMessage.success('已刷新（演示）') }
</script>

<style scoped>
.page { padding: 28px 36px; }
.topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.topbar h2 { margin: 0; color: #2D3142; }
</style>
