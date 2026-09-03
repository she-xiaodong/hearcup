const store = require('../../utils/store.js')
const api = require('../../utils/api.js')

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
    // 走 app.windowInfo()：基础库 3.15.x 上 getWindowInfo 偶发返回 null，
    // 直接读属性会抛 SystemError，这里统一由 app.js 兜底。
    const sys = getApp().windowInfo()
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

  // 新流程：先进入倾听师详情页选时长→支付→再拨号。
  // 因此这里不再做余额校验（金额由所选时长决定，余额是否够在下单时判断）。
  onCall(e) {
    const provider = (e.detail && e.detail.provider) || {}
    if (!provider.id) return
    wx.navigateTo({ url: `/pages/listener-detail/index?id=${provider.id}` })
  }
})
