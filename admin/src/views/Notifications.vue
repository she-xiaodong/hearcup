<template>
  <div class="page">
    <div class="topbar">
      <h2>提示管理</h2>
      <div class="tools">
        <el-input v-model="keyword" placeholder="搜索标题/内容" style="width:220px" @keyup.enter="onSearch" />
        <el-button type="primary" @click="onSearch" style="margin-left:8px">搜索</el-button>
        <el-button @click="reset">重置</el-button>
        <el-button type="success" @click="openCreate" style="margin-left:8px">新建通知</el-button>
      </div>
    </div>
    <el-table :data="list" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="title" label="标题" width="220" />
      <el-table-column label="接收对象" width="110">
        <template #default="{ row }">{{ { all: '全部用户', provider: '仅服务者', user: '仅普通用户' }[row.target] || row.target }}</template>
      </el-table-column>
      <el-table-column prop="content" label="内容" min-width="240" show-overflow-tooltip />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'info'">{{ row.status === 1 ? '已发布' : '草稿' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">{{ fmtTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="150">
        <template #default="{ row }">
          <el-button size="small" @click="openEdit(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination class="pager" background layout="total, prev, pager, next"
      :total="total" :page-size="pageSize" :current-page="page" @current-change="onPageChange" />

    <el-dialog v-model="dialogVisible" :title="editing ? '编辑通知' : '新建通知'" width="600px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="标题"><el-input v-model="form.title" placeholder="通知标题" /></el-form-item>
        <el-form-item label="接收对象">
          <el-radio-group v-model="form.target">
            <el-radio label="all">全部用户</el-radio>
            <el-radio label="provider">仅服务者</el-radio>
            <el-radio label="user">仅普通用户</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :label="0">草稿</el-radio>
            <el-radio :label="1">已发布</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="内容">
          <el-input type="textarea" v-model="form.content" :rows="5" placeholder="通知正文" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getNotifications, createNotification, updateNotification, deleteNotification } from '../api'

const list = ref([])
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const total = ref(0)
const dialogVisible = ref(false)
const editing = ref(false)
const form = ref({ id: 0, title: '', content: '', target: 'all', status: 0 })

async function load() {
  try {
    const res = await getNotifications(page.value, pageSize.value, keyword.value)
    list.value = res.data.list || []
    total.value = res.data.total || 0
  } catch (e) { ElMessage.error('加载失败: ' + (e.response?.data?.msg || e.message)) }
}
function onSearch() { page.value = 1; load() }
function reset() { keyword.value = ''; page.value = 1; load() }
function onPageChange(p) { page.value = p; load() }
function fmtTime(t) { if (!t) return '-'; return new Date(t * 1000).toLocaleString() }

function openCreate() {
  editing.value = false
  form.value = { id: 0, title: '', content: '', target: 'all', status: 0 }
  dialogVisible.value = true
}
function openEdit(row) {
  editing.value = true
  form.value = { id: row.id, title: row.title, content: row.content, target: row.target, status: row.status }
  dialogVisible.value = true
}
async function save() {
  if (!form.value.title.trim()) { ElMessage.warning('标题不能为空'); return }
  try {
    if (editing.value) {
      await updateNotification(form.value.id, { title: form.value.title, content: form.value.content, target: form.value.target, status: form.value.status })
    } else {
      await createNotification({ title: form.value.title, content: form.value.content, target: form.value.target, status: form.value.status })
    }
    dialogVisible.value = false
    ElMessage.success('已保存')
    load()
  } catch (e) { ElMessage.error('保存失败: ' + (e.response?.data?.msg || e.message)) }
}
function remove(row) {
  ElMessageBox.confirm('确认删除该通知？', '提示', { type: 'warning' })
    .then(async () => {
      try {
        await deleteNotification(row.id)
        ElMessage.success('已删除'); load()
      } catch (e) { ElMessage.error('删除失败: ' + (e.response?.data?.msg || e.message)) }
    })
}

onMounted(load)
</script>

<style scoped>
.page { padding: 28px 36px; }
.topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.topbar h2 { margin: 0; color: #2D3142; }
.pager { margin-top: 16px; justify-content: flex-end; }
</style>
