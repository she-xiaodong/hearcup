const store = require('../../utils/store.js')
const api = require('../../utils/api.js')

const demoReviews = [
  { id: 1, rating: 5, comment: '很温柔，说完心里轻了很多。' },
  { id: 2, rating: 5, comment: '没有说教，就是静静听，刚刚好。' },
  { id: 3, rating: 4, comment: '聊得挺舒服，下次还来。' }
]

Page({
  data: { p: null, reviews: demoReviews },

  async onLoad(q) {
    const id = Number(q.id)
    if (getApp().globalData.config.useMock) {
      const p = store.getProviders().find(x => x.id === id)
      if (!p) { wx.showToast({ title: '未找到服务者', icon: 'none' }); return }
      wx.setNavigationBarTitle({ title: p.nickName })
      this.setData({ p })
      return
    }
    const r = await api.getProvider(id)
    if (r.code === 0 && r.data && r.data.provider) {
      wx.setNavigationBarTitle({ title: r.data.provider.nickName })
      this.setData({ p: r.data.provider, reviews: r.data.ratings || demoReviews })
    } else {
      wx.showToast({ title: '未找到服务者', icon: 'none' })
    }
  },

  onCall(e) {
    const callType = Number(e.currentTarget.dataset.type)
    const cfg = store.getConfig()
    if (store.getBalance() < cfg.minBalance) {
      wx.showModal({
        title: '余额不足',
        content: `发起呼叫需至少 ¥${cfg.minBalance}，是否去充值？`,
        confirmText: '去充值',
        success: (r) => { if (r.confirm) wx.navigateTo({ url: '/pages/recharge/recharge' }) }
      })
      return
    }
    wx.navigateTo({ url: `/pages/calling/calling?pid=${this.data.p.id}&type=${callType}` })
  }
})
