// pages/provider-calls/index —— 倾听者「服务订单」（来电服务列表）
const api = require('../../utils/api.js')
const { fmtTime, durText, dateKey, todayKey } = require('../../utils/fmt.js')

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
      const nowS = Math.floor(Date.now() / 1000)
      const list = raw.map(c => {
        if (dateKey(c.created_at) === tk) todayN++
        totalIncome += Number(c.income) || 0
        // 服务中(status=0)：已拨号开始但尚未结算，估算已聊分钟供被叫代结束
        const startS = Number(c.start_time) || 0
        const liveMin = startS > 0 ? Math.max(1, Math.floor((nowS - startS) / 60)) : 0
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
          serving: c.status === 0,
          liveMin
        }
      })
      // 进行中（服务中）订单置顶，便于倾听者第一时间处理代结束
      const sorted = list.slice().sort((a, b) => (b.serving ? 1 : 0) - (a.serving ? 1 : 0))
      this.setData({
        list: sorted,
        totalCalls: list.length,
        todayCalls: todayN,
        totalIncome: Math.round(totalIncome * 100) / 100
      })
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 主叫未主动结束：被叫「代为结束」上报结算（后端允许订单双方结束）
  endService(e) {
    const id = Number(e.currentTarget.dataset.id)
    const item = this.data.list.find(x => x.id === id)
    if (!item) return
    const defMin = item.liveMin || item.minutes || 15
    wx.showModal({
      title: '结束本次服务',
      content: `已服务约 ${defMin} 分钟，将按实际时长结算（多退少补）。留空则按 ${defMin} 分钟。`,
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
