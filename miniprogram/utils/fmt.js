// utils/fmt.js —— 通话/收益/提现记录的展示格式化（倾听者平台复用）
const pad2 = n => String(n).padStart(2, '0')

// 时间戳(秒) → "MM-DD HH:mm"
function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(Number(ts) * 1000)
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

// 时间戳(秒) → "YYYY-MM-DD"（用于今日统计）
function dateKey(ts) {
  if (!ts) return ''
  const d = new Date(Number(ts) * 1000)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

// 秒 → "12分30秒"
function durText(sec) {
  const n = Number(sec) || 0
  const m = Math.floor(n / 60), s = n % 60
  return m > 0 ? `${m}分${pad2(s)}秒` : `${s}秒`
}

// 转账(提现打款)状态 → 中文
const TRANSFER_TEXT = {
  ACCEPTED: '待领取', PROCESSING: '处理中', WAIT_USER_CONFIRM: '待领取',
  TRANSFERING: '转账中', FINISHED: '已到账', SUCCESS: '已到账',
  FAIL: '打款失败', CANCELING: '撤销中', CANCELLED: '已撤销'
}
function transferStateText(state) {
  return TRANSFER_TEXT[state] || (state ? state : '受理中')
}

// 后端转账记录 → 展示结构
function mapTransferItem(t) {
  return {
    id: t.id,
    amount: t.amount || 0,
    stateText: transferStateText(t.state),
    canClaim: !!t.can_claim,
    timeText: fmtTime(t.created_at)
  }
}

module.exports = { fmtTime, dateKey, todayKey, durText, mapTransferItem }
