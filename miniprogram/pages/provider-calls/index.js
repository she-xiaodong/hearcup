// pages/provider-calls/index —— 倾听者「接叫记录」（来电列表）
const api = require('../../../utils/api.js')
const { fmtTime, durText, dateKey, todayKey } = require('../../../utils/fmt.js')

Page({
  data: {
    loading: true,
    list: [],
    totalCalls: 0,
    todayCalls: 0,
    totalIncome: 0
  },

  onShow() { this.refresh() },

  async refresh() {
    this.setData({ loading: true })
    try {
      const r = await api.getProviderCalls()
      const raw = (r && r.code === 0 && r.data) ? r.data : []
      const tk = todayKey()
      let todayN = 0
      let totalIncome = 0
      const list = raw.map(c => {
        if (dateKey(c.created_at) === tk) todayN++
        totalIncome += Number(c.income) || 0
        return {
          id: c.id,
          name: c.user_name || '来电用户',
          time: fmtTime(c.created_at),
          dur: durText(c.duration),
          minutes: c.minutes || 0,
          income: Number(c.income) || 0,
          rating: Number(c.user_rating) || 0,
          comment: c.comment || '',
          status: c.status
        }
      })
      this.setData({
        list,
        totalCalls: list.length,
        todayCalls: todayN,
        totalIncome: Math.round(totalIncome * 100) / 100
      })
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  }
})
