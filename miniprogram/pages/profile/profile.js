// pages/profile/profile —— 「我的」：入驻入口 + 服务者视图 + 通话入口
const store = require('../../utils/store.js')
const { callRecords } = require('../../utils/mock.js')
const api = require('../../utils/api.js')

Page({
  data: {
    user: {}, balance: '0.00', apply: null,
    isProvider: false, me: null, callCount: 0
  },

  async onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    const user = store.getUser()
    if (getApp().globalData.config.useMock) {
      const apply = store.getApply()
      const isProvider = !!(apply && apply.status === 1)
      this.setData({
        user, balance: store.getBalance().toFixed(2), apply,
        isProvider, me: isProvider ? store.getProviderMe() : null, callCount: callRecords.length
      })
      return
    }
    // 真实后端
    const [bal, st] = await Promise.all([api.getBalance(), api.getProviderStatus()])
    const balance = bal.code === 0 && bal.data ? bal.data.balance : user.balance
    if (bal.code === 0 && bal.data) store.setBalance(balance)
    const apply = (st.code === 0 && st.data) ? {
      role: st.data.role, status: st.data.status,
      real_name: st.data.real_name, is_online: st.data.is_online === 1
    } : null
    const isProvider = !!(apply && apply.status === 1)
    let me = null
    if (isProvider) {
      const e = await api.getEarnings()
      if (e.code === 0 && e.data) {
        me = {
          isOnline: (st.data.is_online === 1),
          todayCalls: e.data.today_income != null ? e.data.today_sessions : 0,
          dailyLimit: 10,
          todayIncome: e.data.today_income || 0,
          totalIncome: e.data.total_earnings || 0,
          withdrawable: e.data.withdrawable || 0
        }
      }
    }
    this.setData({
      user, balance: Number(balance).toFixed(2), apply, isProvider, me,
      callCount: callRecords.length
    })
  },

  goApply() { wx.navigateTo({ url: '/pages/apply/apply' }) },
  goCalls() { wx.switchTab({ url: '/pages/calls/calls' }) },
  goRecharge() { wx.navigateTo({ url: '/pages/recharge/recharge' }) },
  goDevcheck() { wx.navigateTo({ url: '/pages/devcheck/devcheck' }) },

  async toggleOnline(e) {
    const v = e.detail.value
    if (getApp().globalData.config.useMock) {
      store.setProviderOnline(v)
      this.setData({ 'me.isOnline': v })
      return
    }
    const r = v ? await api.setOnline() : await api.setOffline()
    if (r.code === 0) this.setData({ 'me.isOnline': v })
    else wx.showToast({ title: (r.msg || '操作失败'), icon: 'none' })
  },

  goEarnings() { wx.showToast({ title: '收益明细', icon: 'none' }) },
  goWithdraw() { wx.showToast({ title: '提现申请', icon: 'none' }) },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      success: (r) => { if (r.confirm) wx.showToast({ title: '已退出', icon: 'none' }) }
    })
  }
})
