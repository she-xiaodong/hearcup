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
    this.checkPending()
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

  // —— 找回未结束结算的通话 ——
  // 冷启动/回到首页时检测：有已支付未结束的订单就提示回到拨号页继续（已拨号→结算，未拨号→拨打或退款）
  async checkPending() {
    const app = getApp()
    const cfg = (app && app.globalData && app.globalData.config) || {}
    if (!cfg.useMock && typeof app.waitLogin === 'function') {
      app.waitLogin(async () => {
        try {
          const r = await api.getPendingCall()
          const list = (r && r.code === 0 && r.data && r.data.list) || []
          if (!list.length) { app.globalData._pendShown = false; return }
          if (app.globalData._pendShown) return
          app.globalData._pendShown = true
          this.promptResume(list[0])
        } catch (e) {}
      })
      return
    }
    // 演示模式：读本地"进行中订单"模拟找回
    let act = null
    try { act = wx.getStorageSync('hc_mock_active') } catch (e) {}
    if (!act || !act.call_id) { app.globalData._pendShown = false; return }
    if (app.globalData._pendShown) return
    app.globalData._pendShown = true
    this.promptResume(act)
  },

  promptResume(o) {
    const dialed = Number(o.start_time) > 0
    const name = o.callee_nickname || '倾听者'
    const packMin = o.minutes || 0
    wx.showModal({
      title: dialed ? '继续上次通话' : '你有未处理的订单',
      content: dialed
        ? `与「${name}」的通话还没结束结算${packMin ? `（套餐 ${packMin} 分钟）` : ''}，现在去结算吗？`
        : `已下单「${name}」${packMin ? `${packMin} 分钟` : ''}但还未拨号，要继续拨打或退款吗？`,
      confirmText: dialed ? '去结束结算' : '去处理',
      cancelText: '稍后',
      success: (r) => {
        if (!r.confirm) return
        const q = '?resume=1' +
          `&call_id=${o.id || o.call_id || 0}` +
          `&room_id=${encodeURIComponent(o.room_id || '')}` +
          `&callee_phone=${encodeURIComponent(o.callee_phone || '')}` +
          `&callee_phone_masked=${encodeURIComponent(o.callee_phone_masked || '')}` +
          `&callee_nickname=${encodeURIComponent(name)}` +
          `&minutes=${packMin}` +
          `&amount=${o.amount || 0}` +
          `&unit_price=${o.unit_price || 0}` +
          `&started=${o.start_time || 0}`
        wx.navigateTo({ url: '/pages/calling-phone/index' + q })
      }
    })
  },

  // 新流程：先进入倾听师详情页选时长→支付→再拨号。
  // 因此这里不再做余额校验（金额由所选时长决定，余额是否够在下单时判断）。
  onCall(e) {
    const provider = (e.detail && e.detail.provider) || {}
    if (!provider.id) return
    wx.navigateTo({ url: `/pages/listener-detail/index?id=${provider.id}` })
  }
})
