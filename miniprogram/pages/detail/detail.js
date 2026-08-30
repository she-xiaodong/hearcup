const store = require('../../utils/store.js')
const api = require('../../utils/api.js')
const { startCall } = require('../../utils/startcall.js')

const demoReviews = [
  { id: 1, rating: 5, comment: '很温柔，说完心里轻了很多。' },
  { id: 2, rating: 5, comment: '没有说教，就是静静听，刚刚好。' },
  { id: 3, rating: 4, comment: '聊得挺舒服，下次还来。' }
]

Page({
  data: { p: null, reviews: demoReviews, videoPrice: 0, voiceCoins: '', videoCoins: '' },

  videoPriceOf(p) {
    const rate = Number((getApp().globalData.config || {}).videoRate) || 1.5
    return Math.round(p.price_per_minute * rate * 10) / 10
  },

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
      this.setData({ p, videoPrice: this.videoPriceOf(p), voiceCoins: this.coins(p.price_per_minute), videoCoins: this.coins(this.videoPriceOf(p)) })
      return
    }
    const r = await api.getProvider(id)
    if (r.code === 0 && r.data && r.data.provider) {
      wx.setNavigationBarTitle({ title: r.data.provider.nickName })
      const p = r.data.provider
      this.setData({ p, reviews: r.data.ratings || demoReviews, videoPrice: this.videoPriceOf(p), voiceCoins: this.coins(p.price_per_minute), videoCoins: this.coins(this.videoPriceOf(p)) })
    } else {
      wx.showToast({ title: '未找到服务者', icon: 'none' })
    }
  },

  // 发起呼叫：业务建单 → 冻结余额 → 交棒 TUICallKit（细节见 utils/startcall.js）
  async onCall(e) {
    const callType = Number(e.currentTarget.dataset.type)
    await startCall(this.data.p.id, callType)
  }
})
