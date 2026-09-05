// pages/calls/calls —— 通话记录（用户端与服务者端共用此页）
const { callRecords } = require('../../utils/mock.js')
const api = require('../../utils/api.js')

Page({
  data: {
    records: [],
    totalCount: 0,
    totalAmount: '0.00',
    ratedCount: 0,
    // 评价弹层
    showRate: false,
    rateTarget: null,
    rateStars: 0,
    rateText: '',
    page: 1,
    hasMore: false,
    loadingMore: false
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    this.load()
  },

  // 首屏/刷新：回到第 1 页
  async load() {
    if (getApp().globalData.config.useMock) {
      const records = callRecords.map(r => ({
        ...r,
        color: '#3A9E8F',
        roomId: r.room_id || r.id
      }))
      this.applyMock(records)
      return
    }
    this.setData({ page: 1, hasMore: false, loadingMore: false })
    await this.fetchPage(1, false)
  },

  // 上拉加载下一页（追加）
  async loadMore() {
    if (getApp().globalData.config.useMock) return
    if (!this.data.hasMore || this.data.loadingMore) return
    const next = this.data.page + 1
    this.setData({ loadingMore: true })
    await this.fetchPage(next, true)
    this.setData({ page: next, loadingMore: false })
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    this.loadMore()
  },

  async fetchPage(page, append) {
    const r = await api.getCallRecords(page, 20)
    if (r.code !== 0) return
    const d = r.data || {}
    const incoming = (d.list || []).map(x => ({
      ...x, color: '#3A9E8F', roomId: x.room_id || x.id,
      coins: getApp().toCoins(x.amount || 0)
    }))
    this.setData({
      records: append ? this.data.records.concat(incoming) : incoming,
      totalCount: Number(d.total) || incoming.length,
      totalAmount: getApp().toCoins(Number(d.total_amount) || 0),
      ratedCount: Number(d.rated_count) || 0,
      hasMore: !!d.has_more
    })
  },

  // 演示数据：一次性展示全部并本地统计
  applyMock(records) {
    const total = records.reduce((sum, r) => sum + (r.amount || 0), 0)
    const rated = records.filter(r => r.rating).length
    records.forEach(r => { r.coins = getApp().toCoins(r.amount || 0) })
    this.setData({
      records, totalCount: records.length,
      totalAmount: getApp().toCoins(total), ratedCount: rated, hasMore: false
    })
  },

  // 打开评价弹层
  openRate(e) {
    const id = e.currentTarget.dataset.id
    const rec = this.data.records.find(r => String(r.id) === String(id))
    if (!rec) return
    this.setData({
      showRate: true,
      rateTarget: rec,
      rateStars: 0,
      rateText: ''
    })
  },

  closeRate() {
    this.setData({ showRate: false, rateTarget: null, rateStars: 0, rateText: '' })
  },

  setStars(e) {
    this.setData({ rateStars: Number(e.currentTarget.dataset.star) })
  },

  onRateInput(e) {
    this.setData({ rateText: e.detail.value })
  },

  noop() {},

  // 提交评价
  async submitRate() {
    const t = this.data.rateTarget
    if (!t) return
    if (!this.data.rateStars) {
      wx.showToast({ title: '请先选择星级', icon: 'none' })
      return
    }
    wx.showLoading({ title: '提交中', mask: true })
    try {
      const r = await api.rate(t.roomId || t.id, this.data.rateStars, this.data.rateText)
      wx.hideLoading()
      if (r.code === 0) {
        wx.showToast({ title: '评价成功', icon: 'success' })
        this.closeRate()
        this.load()
      } else {
        wx.showToast({ title: (r && r.msg) || '评价失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '评价失败，请重试', icon: 'none' })
    }
  }
})
