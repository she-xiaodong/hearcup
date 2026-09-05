// app.js —— HearCup 小程序入口
const { providers, tags } = require('./utils/mock.js')
const api = require('./utils/api.js')
const store = require('./utils/store.js')

App({
  globalData: {
    // 默认值为空：真实身份一律由后端 wx.login 换回的 openid 决定，
    // 这里不放任何占位昵称，避免未登录时页面上出现「小耳朵」这类假数据。
    userInfo: {
      openid: '', nickName: '', avatar: '', phone: '', h_no: '', balance: 0
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
      coinRate: 10,      // 虚拟币比例：1元 = 10 H币
      coinName: 'H币',
      minBalance: 3.0,
      freeCall: false,   // 免费通话模式：true 时跳过余额校验（支付被限制时由后端下发）
      platformRate: 0.2
    }
  },

  // 安全获取窗口信息（带缓存）
  // 背景：基础库 3.15.x 的 wx.getWindowInfo() 在页面路由瞬间偶发返回 null，
  // SDK 内部会去读 null.screenHeight 直接抛 SystemError，进而导致
  // "routeDone with a webviewId X is not found"。这里统一兜底 + 只取一次。
  windowInfo() {
    if (this._winInfo) return this._winInfo
    let info = null
    try {
      if (typeof wx !== 'undefined' && wx.getWindowInfo) info = wx.getWindowInfo()
      else if (typeof wx !== 'undefined' && wx.getSystemInfoSync) info = wx.getSystemInfoSync()
    } catch (e) { info = null }
    if (!info || typeof info !== 'object') info = {}
    this._winInfo = {
      statusBarHeight: Number(info.statusBarHeight) || 20,
      screenHeight: Number(info.screenHeight) || 667,
      windowHeight: Number(info.windowHeight) || 667,
      screenWidth: Number(info.screenWidth) || 375,
      windowWidth: Number(info.windowWidth) || 375,
      safeArea: info.safeArea || null
    }
    return this._winInfo
  },

  // 元 → H币（全局换算，返回去掉多余小数的字符串）
  toCoins(yuan) {
    const rate = this.globalData.config.coinRate || 10
    const v = Math.round(Number(yuan || 0) * rate * 100) / 100
    return String(Math.round(v) === v ? Math.round(v) : v)
  },

  onLaunch() {
    this.restoreConfig()
    this._loginDone = false
    this._loginCbs = []
    // 真实环境：每次打开小程序都走 wx.login → 后端换取 openid，新用户自动生成唯一 H号
    if (typeof wx === 'undefined' || !wx.login) { this._loginDone = true; return }
    wx.login({
      success: (res) => {
        if (!res.code) { this._notifyLogin(); return }
        api.login(res.code).then((r) => {
          if (r.code === 0 && r.data && r.data.user) {
            const u = r.data.user
            this.globalData.userInfo = Object.assign({}, this.globalData.userInfo, u)
            this.globalData.token = r.data.token || ''
            if (typeof u.balance === 'number') store.setBalance(u.balance)
            // 免费通话模式标记：后端下发（支付被限制时先跑通通话），前端据此跳过余额校验
            if (typeof r.data.free_call === 'boolean') {
              this.globalData.config.freeCall = r.data.free_call
            }
          }
          this._notifyLogin()
        }).catch(() => this._notifyLogin())
      },
      fail: () => this._notifyLogin()
    })
  },

  // 登录流程结束（成功或失败）后通知等待中的页面刷新
  _notifyLogin() {
    this._loginDone = true
    const cbs = this._loginCbs
    this._loginCbs = []
    cbs.forEach(cb => { try { cb() } catch (e) {} })
  },

  // 页面在登录完成前可注册回调，登录完成后触发
  waitLogin(cb) {
    if (this._loginDone) { cb(); return }
    this._loginCbs.push(cb)
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
