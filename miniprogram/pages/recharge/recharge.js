const store = require('../../utils/store.js')
const api = require('../../utils/api.js')

Page({
  data: {
    balanceCoins: '0',
    coinName: 'H币',
    tiers: [10, 30, 50, 100, 200],
    selected: 30, custom: '', customMode: false, payAmount: 30, payCoins: 300,
    records: [
      { id: 1, amount: 30, coins: 300, time: '08-25 19:30' },
      { id: 2, amount: 50, coins: 500, time: '08-20 12:08' }
    ]
  },

  async onShow() {
    this.setData({ coinName: getApp().globalData.config.coinName || 'H币' })
    if (getApp().globalData.config.useMock) {
      this.setData({ balanceCoins: getApp().toCoins(store.getBalance()) })
    } else {
      const r = await api.getBalance()
      if (r.code === 0 && r.data) {
        store.setBalance(r.data.balance)
        this.setData({ balanceCoins: getApp().toCoins(r.data.balance) })
      }
    }
  },

  coinsOf(yuan) {
    return getApp().toCoins(yuan)
  },

  selectTier(e) {
    const v = Number(e.currentTarget.dataset.v)
    this.setData({ selected: v, customMode: false, custom: '', payAmount: v, payCoins: this.coinsOf(v) })
  },

  onCustom(e) {
    const v = e.detail.value
    const n = v ? Number(v) : 0
    this.setData({ custom: v, customMode: true, selected: 0, payAmount: n, payCoins: this.coinsOf(n) })
  },

  async pay() {
    const amount = this.data.payAmount
    if (!amount || amount < 10) {
      wx.showToast({ title: '充值金额需≥10元', icon: 'none' });
      return
    }
    const coins = this.coinsOf(amount)
    wx.showLoading({ title: '调起微信支付…' })
    if (getApp().globalData.config.useMock) {
      setTimeout(() => {
        wx.hideLoading()
        const newBalance = store.getBalance() + amount
        store.setBalance(newBalance)
        const rec = { id: Date.now(), amount, coins: Number(coins), time: this.now() }
        this.setData({ balanceCoins: getApp().toCoins(newBalance), records: [rec, ...this.data.records] })
        wx.showToast({ title: `充值成功 +${coins} ${this.data.coinName}`, icon: 'success' })
        setTimeout(() => wx.navigateBack(), 900)
      }, 1200)
      return
    }
    // 真实环境：/api/v1/recharge/create → wx.requestPayment → /api/v1/pay/callback 入账
    const r = await api.createRecharge(amount)
    wx.hideLoading()
    if (r.code === 0) {
      const b = await api.getBalance()
      if (b.code === 0 && b.data) {
        store.setBalance(b.data.balance)
        this.setData({ balanceCoins: getApp().toCoins(b.data.balance) })
      }
      wx.showToast({ title: `充值成功 +${(r.data && r.data.coins) || coins} ${this.data.coinName}`, icon: 'success' })
      setTimeout(() => wx.navigateBack(), 900)
    } else {
      wx.showToast({ title: (r.msg || '充值失败'), icon: 'none' })
    }
  },

  now() {
    const d = new Date()
    const p = (n) => String(n).padStart(2, '0')
    return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  }
})
