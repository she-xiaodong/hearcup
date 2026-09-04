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
    rateText: ''
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    this.load()
  },

  async load() {
    if (getApp().globalData.config.useMock) {
      const records = callRecords.map(r => ({
        ...r,
        color: '#3A9E8F',
        roomId: r.room_id || r.id
      }))
      this.applySummary(records)
      return
    }
    const r = await api.getCallRecords()
    if (r.code === 0 && Array.isArray(r.data)) {
      const records = r.data.map(x => ({
        ...x,
        color: '#3A9E8F',
        roomId: x.room_id || x.id
      }))
      this.applySummary(records)
    }
  },

  applySummary(records) {
    const total = records.reduce((s, r) => s + (r.amount || 0), 0)
    const rated = records.filter(r => r.rating).length
    // 金额统一以H币展示（内部按元记账，1元=10H币）
    records.forEach(r => { r.coins = getApp().toCoins(r.amount || 0) })
    this.setData({
      records, totalCount: records.length,
      totalAmount: getApp().toCoins(total), ratedCount: rated
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
