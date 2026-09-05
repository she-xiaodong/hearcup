// pages/provider-calls/index —— 倾听者「服务订单」（来电服务列表）
const api = require('../../utils/api.js')
const { fmtTime, durText, dateKey, todayKey } = require('../../utils/fmt.js')

Page({
  data: {
    loading: true,
    list: [],
    totalCalls: 0,
    todayCalls: 0,
    totalIncome: 0,
    page: 1,
    hasMore: false,
    loadingMore: false
  },

  onShow() { this.refresh() },

  // 单条映射（含“服务中”标记与有界参考分钟）
  mapItem(c) {
    const nowS = Math.floor(Date.now() / 1000)
    const startS = Number(c.start_time) || 0
    const rawMin = startS > 0 ? Math.floor((nowS - startS) / 60) : 0
    const liveMin = rawMin > 240 ? 0 : Math.max(0, rawMin)
    const started = startS > 0
    return {
      id: c.id,
      roomId: c.room_id || c.id,
      name: c.user_name || '来电用户',
      time: fmtTime(c.created_at),
      dur: durText(c.duration),
      minutes: c.minutes || 0,
      income: Number(c.income) || 0,
      rating: Number(c.user_rating) || 0,
      comment: c.comment || '',
      status: c.status,
      serving: c.status === 0 && started,
      liveMin
    }
  },

  // 首屏/下拉刷新：第 1 页
  async refresh() {
    this.setData({ loading: true, page: 1, hasMore: false, loadingMore: false })
    try {
      await this.fetchPage(1, false)
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 上拉加载下一页（追加）
  async loadMore() {
    if (!this.data.hasMore || this.data.loadingMore) return
    const next = this.data.page + 1
    this.setData({ loadingMore: true })
    try {
      await this.fetchPage(next, true)
      this.setData({ page: next })
    } finally {
      this.setData({ loadingMore: false })
    }
  },

  onPullDownRefresh() {
    this.refresh().then(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    this.loadMore()
  },

  async fetchPage(page, append) {
    const r = await api.getProviderCalls(page, 20)
    if (r.code !== 0) return
    const d = r.data || {}
    const nowS = Math.floor(Date.now() / 1000)
    const raw = d.list || []
    const tk = todayKey()
    const mapped = raw.map(c => this.mapItem(c))
    // 进行中（服务中）订单始终置顶，便于第一时间代结束
    const merged = append ? this.data.list.concat(mapped) : mapped
    const sorted = merged.slice().sort((a, b) => (b.serving ? 1 : 0) - (a.serving ? 1 : 0))
    const st = d.stats || {}
    this.setData({
      list: sorted,
      totalCalls: Number(st.total_calls) || sorted.length,
      todayCalls: Number(st.today_calls) || 0,
      totalIncome: Number(st.total_income) || 0,
      hasMore: !!d.has_more
    })
  },

  // 主叫未主动结束：被叫「代为结束」上报结算（后端允许订单双方结束）
  // 默认按套餐分钟结算（不推算"已用"，避免挂单/长时单把超上限分钟带进默认值）；实际更长可如实填写，超出部分自动补扣
  endService(e) {
    const id = Number(e.currentTarget.dataset.id)
    const item = this.data.list.find(x => x.id === id)
    if (!item) return
    const defMin = item.minutes || 15
    const hint = item.liveMin > 0 ? `该通话已进行约 ${item.liveMin} 分钟。` : ''
    wx.showModal({
      title: '结束本次服务',
      content: `${hint}本次套餐 ${defMin} 分钟，默认按套餐结算。若实际更长请如实填写分钟数（多退少补），留空则按 ${defMin} 分钟。`,
      confirmText: '结束结算',
      cancelText: '取消',
      editable: true,
      placeholderText: String(defMin),
      success: async (r) => {
        if (!r.confirm) return
        const typed = parseInt(r.content, 10)
        const minutes = (typed && typed > 0) ? typed : defMin
        wx.showLoading({ title: '结算中', mask: true })
        const res = await api.reportCallResultWithMinutes('end', item.roomId, item.id, minutes)
        wx.hideLoading()
        if (res && res.code === 0) {
          wx.showToast({ title: '已结束并结算', icon: 'success' })
          this.refresh()
        } else {
          wx.showToast({ title: (res && res.msg) || '结算失败', icon: 'none' })
        }
      }
    })
  }
})
