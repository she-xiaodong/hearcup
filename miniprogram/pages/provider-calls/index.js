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
        // 服务中(status=0)：已拨号开始但尚未结算。参考"已进行分钟"有界化：
        // 距开始超 240 分钟视为时间过长（多为挂单），不再推算已用，避免误导代结束默认值
        const startS = Number(c.start_time) || 0
        const rawMin = startS > 0 ? Math.floor((nowS - startS) / 60) : 0
        const liveMin = rawMin > 240 ? 0 : Math.max(0, rawMin)
        // 服务中必须已拨号（start>0）；仅支付未拨号的单不属服务中，交给退款兜底
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
