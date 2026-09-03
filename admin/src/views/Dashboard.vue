<template>
  <div class="page">
    <div class="topbar">
      <h2>数据看板</h2>
      <span class="date">{{ today }}</span>
    </div>

    <div class="cards">
      <div class="metric" v-for="m in metrics" :key="m.label">
        <div class="m-label">{{ m.label }}</div>
        <div class="m-value">{{ m.value }}</div>
        <div class="m-unit">{{ m.unit }}</div>
      </div>
    </div>

    <div class="card chart-card">
      <div class="chart-title">近 7 日趋势（通话量 / 收入）</div>
      <svg viewBox="0 0 700 260" class="chart">
        <line v-for="i in 4" :key="i" :x1="40" :x2="680" :y1="20 + i * 50" :y2="20 + i * 50" stroke="#F0ECE6" />
        <polyline :points="callPoints" fill="none" stroke="#4FB8A8" stroke-width="3" />
        <polyline :points="incomePoints" fill="none" stroke="#FF9E80" stroke-width="3" />
        <circle v-for="(p, i) in callDots" :key="'c'+i" :cx="p.x" :cy="p.y" r="4" fill="#4FB8A8" />
        <circle v-for="(p, i) in incomeDots" :key="'i'+i" :cx="p.x" :cy="p.y" r="4" fill="#FF9E80" />
        <text v-for="(d, i) in trend" :key="'t'+i" :x="30 + i * 95" y="245" font-size="12" fill="#8A8FA3" text-anchor="middle">{{ d.date }}</text>
      </svg>
      <div class="legend">
        <span><i class="dot dot-call" /> 通话量</span>
        <span><i class="dot dot-income" /> 收入(元)</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getDashboard } from '../api'

const today = new Date().toLocaleDateString('zh-CN')
const stats = ref({ today_calls: 0, today_income: 0, online_providers: 0, new_users: 0, trend: [] })

const metrics = computed(() => [
  { label: '今日通话次数', value: stats.value.today_calls ?? 0, unit: '次' },
  { label: '今日收入', value: '¥' + (stats.value.today_income ?? 0).toFixed(2), unit: '' },
  { label: '在线服务者', value: stats.value.online_providers ?? 0, unit: '人' },
  { label: '新增用户', value: stats.value.new_users ?? 0, unit: '人' }
])

const trend = computed(() => {
  const t = stats.value.trend || []
  return t.length ? t : [{ date: '-', calls: 0, income: 0 }]
})

const W = 700, H = 260, padX = 40, padY = 20
const maxV = computed(() => {
  const arr = trend.value
  return Math.max(1, ...arr.map(d => d.calls || 0), ...arr.map(d => (d.income || 0) * 10)) * 1.2
})
const xAt = (i) => padX + i * ((W - padX - 20) / Math.max(1, trend.value.length - 1))
const yAt = (v) => padY + (1 - v / maxV.value) * (H - padY - 40)

const callPoints = computed(() => trend.value.map((d, i) => `${xAt(i)},${yAt(d.calls || 0)}`).join(' '))
const incomePoints = computed(() => trend.value.map((d, i) => `${xAt(i)},${yAt((d.income || 0) * 10)}`).join(' '))
const callDots = computed(() => trend.value.map((d, i) => ({ x: xAt(i), y: yAt(d.calls || 0) })))
const incomeDots = computed(() => trend.value.map((d, i) => ({ x: xAt(i), y: yAt((d.income || 0) * 10) })))

onMounted(async () => {
  try {
    const res = await getDashboard()
    if (res) stats.value = res
  } catch (e) {
    // 静默失败，保留 0 值展示
  }
})
</script>

<style scoped>
.page { padding: 28px 36px; }
.topbar { display: flex; align-items: baseline; gap: 16px; margin-bottom: 24px; }
.topbar h2 { margin: 0; color: #2D3142; }
.date { color: #8A8FA3; font-size: 14px; }
.cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
.metric { background: #fff; border-radius: 20px; padding: 24px; box-shadow: 0 4px 16px rgba(45,49,66,0.06); }
.m-label { color: #8A8FA3; font-size: 14px; }
.m-value { font-size: 36px; font-weight: 800; color: #3A9E8F; margin-top: 8px; }
.m-unit { color: #8A8FA3; font-size: 13px; }
.card { background: #fff; border-radius: 20px; padding: 24px; margin-top: 24px; box-shadow: 0 4px 16px rgba(45,49,66,0.06); }
.chart-title { font-weight: 700; margin-bottom: 12px; }
.chart { width: 100%; height: auto; }
.legend { display: flex; gap: 24px; margin-top: 8px; color: #8A8FA3; font-size: 13px; }
.dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; }
.dot-call { background: #4FB8A8; }
.dot-income { background: #FF9E80; }
</style>
