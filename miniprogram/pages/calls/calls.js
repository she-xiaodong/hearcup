// pages/calls/calls —— 通话记录（用户端与服务者端共用此页）
const { callRecords } = require('../../utils/mock.js')
const api = require('../../utils/api.js')

Page({
  data: { records: [], totalCount: 0, totalAmount: '0.00', ratedCount: 0 },

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
        color: r.callType === 2 ? '#B5A8E0' : '#4FB8A8',
        roleIcon: r.callType === 2
      }))
      this.applySummary(records)
      return
    }
    const r = await api.getCallRecords()
    if (r.code === 0 && Array.isArray(r.data)) {
      const records = r.data.map(x => ({
        ...x,
        color: x.callType === 2 ? '#B5A8E0' : '#4FB8A8',
        roleIcon: x.callType === 2
      }))
      this.applySummary(records)
    }
  },

  applySummary(records) {
    const total = records.reduce((s, r) => s + (r.amount || 0), 0)
    const rated = records.filter(r => r.rating).length
    this.setData({
      records, totalCount: records.length,
      totalAmount: total.toFixed(2), ratedCount: rated
    })
  }
})
