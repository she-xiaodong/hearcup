// pages/profile/profile —— 「我的」：资料 + H号 + 收益 + 入驻 + 关于/反馈
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
    // H号尚未生成（登录流程未完成）时，等待登录完成后再刷新一次
    const app = getApp()
    if (!store.getUser().h_no && !app._loginDone) {
      app.waitLogin(() => this.onShow())
      return
    }
    const user = store.getUser()
    if (getApp().globalData.config.useMock) {
      const apply = store.getApply()
      const isProvider = !!(apply && apply.status === 1)
      const raw = isProvider ? store.getProviderMe() : null
      this.setData({
        user, balance: getApp().toCoins(store.getBalance()), apply,
        isProvider, me: raw ? {
          isOnline: raw.isOnline,
          pendingIncome: raw.withdrawable || 0,
          completedIncome: 0,
          totalIncome: raw.totalIncome || 0,
          withdrawable: raw.withdrawable || 0
        } : null, callCount: callRecords.length
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
          pendingIncome: e.data.pending_income || 0,
          completedIncome: e.data.completed_income || 0,
          totalIncome: e.data.total_earnings || 0,
          withdrawable: e.data.withdrawable || 0
        }
      }
    }
    this.setData({
      user, balance: getApp().toCoins(balance), apply, isProvider, me,
      callCount: callRecords.length
    })
  },

  // —— 头像：chooseAvatar 获取微信头像，转 base64 上传 ——
  async onChooseAvatar(e) {
    const url = e.detail.avatarUrl
    if (!url) return
    const dataUri = await this.readAsBase64(url)
    if (!dataUri) return
    this.setData({ 'user.avatar': dataUri })
    getApp().globalData.userInfo.avatar = dataUri
    if (!getApp().globalData.config.useMock) {
      const r = await api.updateProfile('', dataUri)
      if (r.code === 0 && r.data) {
        getApp().globalData.userInfo = Object.assign({}, getApp().globalData.userInfo, r.data)
      } else {
        wx.showToast({ title: (r.msg || '头像保存失败'), icon: 'none' })
      }
    }
  },

  readAsBase64(filePath) {
    return new Promise((resolve) => {
      wx.getFileSystemManager().readFile({
        filePath, encoding: 'base64',
        success: (res) => resolve('data:image/jpeg;base64,' + res.data),
        fail: () => resolve('')
      })
    })
  },

  // —— 昵称：type=nickname 获取微信昵称 ——
  async onNicknameBlur(e) {
    const name = (e.detail.value || '').trim()
    if (!name || name === this.data.user.nickName) return
    this.setData({ 'user.nickName': name })
    getApp().globalData.userInfo.nickName = name
    if (!getApp().globalData.config.useMock) {
      const r = await api.updateProfile(name, '')
      if (r.code === 0 && r.data) {
        getApp().globalData.userInfo = Object.assign({}, getApp().globalData.userInfo, r.data)
      } else {
        wx.showToast({ title: (r.msg || '昵称保存失败'), icon: 'none' })
      }
    }
  },

  goApply() { wx.navigateTo({ url: '/pages/apply/apply' }) },
  goCalls() { wx.switchTab({ url: '/pages/calls/calls' }) },
  goRecharge() { wx.navigateTo({ url: '/pages/recharge/recharge' }) },
  goSettings() { wx.navigateTo({ url: '/pages/settings/settings' }) },
  goDevcheck() { wx.navigateTo({ url: '/pages/devcheck/devcheck' }) },
  goAbout() { wx.navigateTo({ url: '/pages/about/about' }) },
  goFeedback() { wx.navigateTo({ url: '/pages/feedback/feedback' }) },

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

  goWithdraw() {
    const me = this.data.me
    if (!me) return
    if (me.withdrawable <= 0) { wx.showToast({ title: '暂无可提现余额', icon: 'none' }); return }
    wx.showModal({
      title: '申请提现',
      editable: true,
      placeholderText: '请输入提现金额（元）',
      success: async (res) => {
        if (!res.confirm) return
        const amount = Number(res.content)
        if (!amount || amount <= 0) { wx.showToast({ title: '金额无效', icon: 'none' }); return }
        const r = await api.withdraw(amount)
        if (r.code === 0) {
          wx.showToast({ title: (r.data && r.data.msg) || '提现申请已提交', icon: 'none' })
          setTimeout(() => this.onShow(), 600)
        } else {
          wx.showToast({ title: r.msg || '提现失败', icon: 'none' })
        }
      }
    })
  }
})
