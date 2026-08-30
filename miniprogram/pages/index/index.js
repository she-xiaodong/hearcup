const store = require('../../utils/store.js')
const api = require('../../utils/api.js')
const { startCall } = require('../../utils/startcall.js')

function useMock() { return getApp().globalData.config.useMock }

Page({
  data: {
    statusBarHeight: 20,
    userInfo: {},
    balance: '0.00',
    onlineCount: 0,
    roles: [{ id: 0, name: '全部倾听者' }],
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
        userInfo: user, balance: getApp().toCoins(user.balance),
        onlineCount: online.length, list: this.filter(online, this.data.activeRole)
      })
      return
    }
    // 真实后端：拉取全部倾听者（含离线），标注在线/离线状态
    const [prov, bal] = await Promise.all([
      api.getAllProviders(),
      api.getBalance()
    ])
    const list = (prov.data && prov.data.list) || []
    const onlineCount = list.filter(p => p.is_online).length
    if (bal.code === 0 && bal.data) store.setBalance(bal.data.balance)
    this.setData({
      userInfo: user,
      balance: getApp().toCoins(bal.data ? bal.data.balance : user.balance),
      onlineCount, list
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

  async onCall(e) {
    const { provider, callType } = e.detail
    // 离线不再拦截：呼叫会经腾讯云 IM 通道以通知形式触达对方，
    // 只是不能保证立刻接通，所以给用户一个预期提示。
    if (provider.is_online === false) {
      wx.showToast({ title: '对方可能不在线，将发送来电通知', icon: 'none', duration: 2000 })
    }
    const cfg = store.getConfig()
    const balance = store.getBalance()
    if (balance < cfg.minBalance) {
      wx.showModal({
        title: '余额不足',
        content: `发起呼叫需至少 ${getApp().toCoins(cfg.minBalance)} ${getApp().globalData.config.coinName || 'H币'}，是否去充值？`,
        confirmText: '去充值',
        success: (r) => { if (r.confirm) this.goRecharge() }
      })
      return
    }
    await startCall(provider.id, callType)
  }
})
