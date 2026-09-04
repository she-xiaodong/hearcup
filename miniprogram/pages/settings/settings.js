// pages/settings/settings —— 设置：退出登录等
Page({
  data: {},

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后需重新登录才能使用，确定退出吗？',
      confirmText: '退出',
      confirmColor: '#3A9E8F',
      success: (r) => {
        if (!r.confirm) return
        try { wx.removeStorageSync('hearcup_token') } catch (e) {}
        const app = getApp()
        app.globalData.token = ''
        app.globalData.userInfo = { openid: '', nickName: '', avatar: '', phone: '', h_no: '', balance: 0 }
        wx.showToast({ title: '已退出登录', icon: 'none' })
        setTimeout(() => wx.switchTab({ url: '/pages/index/index' }), 700)
      }
    })
  }
})
