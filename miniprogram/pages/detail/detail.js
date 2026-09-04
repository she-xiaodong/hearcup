const store = require('../../utils/store.js')
const api = require('../../utils/api.js')

const demoReviews = [
  { id: 1, rating: 5, comment: '很温柔，说完心里轻了很多。' },
  { id: 2, rating: 5, comment: '没有说教，就是静静听，刚刚好。' },
  { id: 3, rating: 4, comment: '聊得挺舒服，下次还来。' }
]

Page({
  data: { p: null, reviews: demoReviews },

  // 价格统一以H币展示（内部仍按元计费，1元=10H币）
  coins(yuan) {
    return getApp().toCoins(yuan)
  },

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
      const p = r.data.provider
      this.setData({ p, reviews: r.data.ratings || demoReviews })
    } else {
      wx.showToast({ title: '未找到服务者', icon: 'none' })
    }
  },

  // 旧详情页不再直接呼叫：选时长与支付统一在倾听师详情页完成
  onCall() {
    if (!this.data.p) return
    wx.redirectTo({ url: `/pages/listener-detail/index?id=${this.data.p.id}` })
  }
})
