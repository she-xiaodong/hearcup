// app.js —— HearCup 小程序入口
const { providers, tags } = require('./utils/mock.js')
const api = require('./utils/api.js')
const store = require('./utils/store.js')
const callkit = require('./utils/callkit.js')

App({
  globalData: {
    userInfo: {
      openid: 'user_123', nickName: '小耳朵', avatar: '', phone: '', h_no: '', balance: 0
    },
    providers: providers,
    tags: tags,
    token: '',
    // 腾讯云 IM 凭据：登录时由后端下发，供 TUICallKit 初始化通话能力
    im: null,
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
      freeCall: false,   // 免费通话模式：true 时跳过余额校验（支付被限制时由后端下发）
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
    this._loginDone = false
    this._loginCbs = []
    // 通话计费回调只需注册一次（把 TUICallKit 状态变化翻译成后端计费事件）
    this.bindCallStatus()
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
            // 拿到 IM 凭据后初始化通话组件：倾听者此后才能收到来电
            if (r.data.im) {
              this.globalData.im = r.data.im
              this.initCallKit(r.data.im, u)
            }
          }
          this._notifyLogin()
        }).catch(() => this._notifyLogin())
      },
      fail: () => this._notifyLogin()
    })
  },

  // 初始化 TUICallKit（失败不阻断主流程，仅丧失通话能力）
  initCallKit(im, user) {
    callkit.init(im, { nickname: (user && user.nickname) || '', avatar: (user && user.avatar) || '' })
      .catch(e => console.error('[app] callkit init fail', e))
  },

  // 通话状态 → 业务计费上报。
  // 只在主叫侧生效：主叫持有 room_id 且是付费方，被叫侧不参与计费（见 callkit 封装内说明）。
  bindCallStatus() {
    callkit.onStatus((s) => {
      if (!s || !s.roomIDBiz) return
      if (s.status === 'connected') {
        api.reportCallResult('accept', s.roomIDBiz, s.callID)
      } else if (s.status === 'ended') {
        // 正常结束：后端按分钟结算并解冻余额
        api.endCall(s.roomIDBiz).then((r) => {
          if (r && r.code === 0 && r.data && typeof r.data.balance === 'number') {
            store.setBalance(r.data.balance)
          }
        }).catch(() => {})
        callkit.clearSession()
      } else if (s.status === 'unconnected') {
        // 未接通：主叫主动取消走 cancel（静默解冻）；
        // 被叫拒接或超时未接走 miss（解冻并给倾听者补发未接通知）
        const kind = (s.role === 'caller' && s.userHangup) ? 'cancel' : 'miss'
        api.reportCallResult(kind, s.roomIDBiz, s.callID).catch(() => {})
        callkit.clearSession()
      }
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
