// app.js —— Hearcup（一杯心晴）小程序入口
const { providers, tags } = require('./utils/mock.js')
const api = require('./utils/api.js')
const store = require('./utils/store.js')

App({
  globalData: {
    userInfo: {
      openid: 'user_123', nickName: '小耳朵', avatar: '', phone: '138****8888', h_no: '10000001', balance: 28.00
    },
    providers: providers,
    tags: tags,
    token: '',
    config: {
      // ⚠️ 测试开关：true=本地演示数据（离线可用）；false=连接真实后端（见 baseUrl）
      // 可在「我的 → 开发者自检」页切换，并持久化到 storage
      useMock: false,
      // 真实后端地址（生产）：已部署到 shanlianba.com，HTTPS 已备案
      baseUrl: 'https://shanlianba.com',
      listenerPrice: 1.0,
      counselorPrice: 2.0,
      videoRate: 1.5,
      coinRate: 10,      // 虚拟币比例：1元 = 10 H币
      coinName: 'H币',
      minBalance: 3.0,
      platformRate: 0.2
    }
  },

  // 元 → H币（全局换算，返回去掉多余小数的字符串）
  toCoins(yuan) {
    const rate = this.globalData.config.coinRate || 10
    const v = Math.round(Number(yuan || 0) * rate * 100) / 100
    return String(Math.round(v) === v ? Math.round(v) : v)
  },

  onLaunch() {
    this.restoreConfig()
    // 真实环境：wx.login → 后端换取 openid/unionid，拉取用户资料与余额
    if (typeof wx === 'undefined' || !wx.login) return
    wx.login({
      success: (res) => {
        if (!res.code) return
        api.login(res.code).then((r) => {
          if (r.code === 0 && r.data && r.data.user) {
            const u = r.data.user
            this.globalData.userInfo = Object.assign({}, this.globalData.userInfo, u)
            this.globalData.token = r.data.token || ''
            if (typeof u.balance === 'number') store.setBalance(u.balance)
          }
        }).catch(() => {})
      }
    })
  },

  // 从 storage 恢复配置（自检页可改）
  restoreConfig() {
    if (typeof wx === 'undefined' || !wx.getStorageSync) return
    try {
      const saved = wx.getStorageSync('hearcup_config')
      if (saved && typeof saved === 'object') {
        this.globalData.config = Object.assign({}, this.globalData.config, saved)
      }
    } catch (e) {}
  },

  // 保存配置并立即生效
  saveConfig(patch) {
    this.globalData.config = Object.assign({}, this.globalData.config, patch)
    if (typeof wx !== 'undefined' && wx.setStorageSync) {
      try { wx.setStorageSync('hearcup_config', this.globalData.config) } catch (e) {}
    }
  }
})
