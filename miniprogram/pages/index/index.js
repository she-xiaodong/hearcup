const store = require('../../utils/store.js')
const api = require('../../utils/api.js')

function useMock() { return getApp().globalData.config.useMock }

Page({
  data: {
    statusBarHeight: 20,
    userInfo: {},
    balance: '0.00',
    onlineCount: 0,
    roles: [{ id: 0, name: '全部' }, { id: 1, name: '倾听师' }, { id: 2, name: '咨询师' }],
    activeRole: 0,
    list: []
  },

  onLoad() {
    const sys = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    this.setData({ statusBarHeight: sys.statusBarHeight || 20 })
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    this.loadData()
  },

  async loadData() {
    const user = store.getUser()
    if (useMock()) {
      const providers = store.getProviders()
      const online = providers.filter(p => p.is_online)
      this.setData({
        userInfo: user, balance: user.balance.toFixed(2),
        onlineCount: online.length, list: this.filter(online, this.data.activeRole)
      })
      return
    }
    // 真实后端
    const [prov, bal] = await Promise.all([
      api.getOnlineProviders(this.data.activeRole || 0),
      api.getBalance()
    ])
    const list = (prov.data && prov.data.list) || []
    if (bal.code === 0 && bal.data) store.setBalance(bal.data.balance)
    this.setData({
      userInfo: user,
      balance: (bal.data ? bal.data.balance : user.balance).toFixed(2),
      onlineCount: list.length, list
    })
  },

  filter(providers, role) {
    return role === 0 ? providers : providers.filter(p => p.role === role)
  },

  switchRole(e) {
    const id = Number(e.currentTarget.dataset.id)
    this.setData({ activeRole: id })
    if (useMock()) {
      this.setData({ list: this.filter(store.getProviders().filter(p => p.is_online), id) })
    } else {
      this.loadData()
    }
  },

  goRecharge() { wx.navigateTo({ url: '/pages/recharge/recharge' }) },

  onCall(e) {
    const { provider, callType } = e.detail
    const cfg = store.getConfig()
    const balance = store.getBalance()
    if (balance < cfg.minBalance) {
      wx.showModal({
        title: '余额不足',
        content: `发起呼叫需至少 ¥${cfg.minBalance}，是否去充值？`,
        confirmText: '去充值',
        success: (r) => { if (r.confirm) this.goRecharge() }
      })
      return
    }
    wx.navigateTo({ url: `/pages/calling/calling?pid=${provider.id}&type=${callType}` })
  }
})
