// pages/profile/profile —— 「我的」：资料 + H号 + 余额 + 入驻状态/平台入口 + 菜单
// 说明：倾听者侧功能（在线开关/收益/提现/接叫记录）已整体并入「倾听者平台」页 pages/listener，
//       本页只保留入口与通用菜单。
const store = require('../../utils/store.js')
const { callRecords } = require('../../utils/mock.js')
const api = require('../../utils/api.js')

Page({
  data: {
    user: {}, balance: '0.00', apply: null,
    isProvider: false, callCount: 0
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
      this.setData({
        user, balance: getApp().toCoins(store.getBalance()), apply,
        isProvider: !!(apply && apply.status === 1),
        callCount: callRecords.length
      })
      return
    }
    // 真实后端
    const [bal, st] = await Promise.all([api.getBalance(), api.getProviderStatus()])
    const balance = bal.code === 0 && bal.data ? bal.data.balance : user.balance
    if (bal.code === 0 && bal.data) store.setBalance(balance)
    // 未申请(-1)→null 显示「申请入驻」；0待审/1通过/2被拒保留状态
    let apply = null
    if (st.code === 0 && st.data && typeof st.data.status === 'number') {
      const s = st.data.status
      if (s === 0 || s === 1 || s === 2) apply = { role: st.data.role, status: s }
    }
    this.setData({
      user, balance: getApp().toCoins(balance), apply,
      isProvider: !!(apply && apply.status === 1),
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
  goListener() { wx.navigateTo({ url: '/pages/listener/listener' }) },
  goCalls() { wx.switchTab({ url: '/pages/calls/calls' }) },
  goRecharge() { wx.navigateTo({ url: '/pages/recharge/recharge' }) },
  goSettings() { wx.navigateTo({ url: '/pages/settings/settings' }) },
  goDevcheck() { wx.navigateTo({ url: '/pages/devcheck/devcheck' }) },
  goAbout() { wx.navigateTo({ url: '/pages/about/about' }) },
  goFeedback() { wx.navigateTo({ url: '/pages/feedback/feedback' }) }
})
