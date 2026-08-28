const store = require('../../utils/store.js')
const api = require('../../utils/api.js')

Page({
  data: {
    balance: '0.00',
    tiers: [10, 30, 50, 100, 200],
    selected: 30, custom: '', customMode: false, payAmount: 30,
    records: [
      { id: 1, amount: 30, time: '08-25 19:30' },
      { id: 2, amount: 50, time: '08-20 12:08' }
    ]
  },

  async onShow() {
    if (getApp().globalData.config.useMock) {
      this.setData({ balance: store.getBalance().toFixed(2) })
    } else {
      const r = await api.getBalance()
      if (r.code === 0 && r.data) {
        store.setBalance(r.data.balance)
        this.setData({ balance: r.data.balance.toFixed(2) })
      }
    }
  },

  selectTier(e) {
    const v = Number(e.currentTarget.dataset.v)
    this.setData({ selected: v, customMode: false, custom: '', payAmount: v })
  },

  onCustom(e) {
    const v = e.detail.value
    this.setData({ custom: v, customMode: true, selected: 0, payAmount: v ? Number(v) : 0 })
  },

  async pay() {
    const amount = this.data.payAmount
    if (!amount || amount < 10) {
      wx.showToast({ title: '充值金额需≥10元', icon: 'none' });
      return
    }
    wx.showLoading({ title: '调起微信支付…' })
    if (getApp().globalData.config.useMock) {
      setTimeout(() => {
        wx.hideLoading()
        const newBalance = store.getBalance() + amount
        store.setBalance(newBalance)
        const rec = { id: Date.now(), amount, time: this.now() }
        this.setData({ balance: newBalance.toFixed(2), records: [rec, ...this.data.records] })
        wx.showToast({ title: `充值成功 ¥${amount}`, icon: 'success' })
        setTimeout(() => wx.navigateBack(), 900)
      }, 1200)
      return
    }
    // 真实环境：/api/v1/recharge/create → wx.requestPayment → /api/v1/pay/notify 入账
    const r = await api.createRecharge(amount)
    wx.hideLoading()
    if (r.code === 0) {
      const b = await api.getBalance()
      if (b.code === 0 && b.data) {
        store.setBalance(b.data.balance)
        this.setData({ balance: b.data.balance.toFixed(2) })
      }
      wx.showToast({ title: `充值成功 ¥${amount}`, icon: 'success' })
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
