// pages/devcheck —— 开发者自检页（真机联调用）
const api = require('../../utils/api.js')

Page({
  data: {
    useMock: true,
    baseUrl: '',
    steps: [],
    env: null,
    me: null,
    payResult: '',
      },

  onLoad() {
    const cfg = getApp().globalData.config
    this.setData({ useMock: cfg.useMock, baseUrl: cfg.baseUrl })
  },

  onUrlInput(e) { this.setData({ baseUrl: e.detail.value }) },

  onToggleMock(e) { this.setData({ useMock: e.detail.value }) },

  saveCfg() {
    getApp().saveConfig({ useMock: this.data.useMock, baseUrl: this.data.baseUrl })
    wx.showToast({ title: '已保存', icon: 'success' })
  },

  // 追加一条自检结果
  push(name, ok, detail) {
    const steps = this.data.steps.concat([{ name, ok, detail: detail || '' }])
    this.setData({ steps })
  },

  async runAll() {
    this.setData({ steps: [], env: null, me: null, payResult: '' })
    const base = this.data.baseUrl.replace(/\/$/, '')

    // 1) 后端健康
    try {
      const r = await this.wxReq({ url: base + '/healthz' })
      this.push('后端可达', true, base + ' → ' + JSON.stringify(r))
    } catch (e) {
      this.push('后端可达', false, String(e.errMsg || e))
      return
    }

    // 2) 环境配置
    try {
      const r = await this.wxReq({ url: base + '/api/v1/debug/env' })
      this.setData({ env: r.data })
      const e = r.data
      this.push('MySQL 持久化', e.mysql.enabled, e.mysql.enabled ? '已连接' : '回退 JSON 文件')
      this.push('微信登录', e.wechat_login.enabled, e.wechat_login.enabled ? e.wechat_login.appid : '未配置')
      this.push('微信支付', e.wechat_pay.enabled, e.wechat_pay.enabled ? '商户号 ' + e.wechat_pay.mchid : '未配置')
    } catch (err) {
      this.push('环境自检', false, String(err.errMsg || err))
    }

    // 3) 微信登录（真实 code2Session）
    try {
      const code = await this.wxLogin()
      const r = await api.login(code)
      if (r.code === 0 && r.data) {
        const u = r.data.user || {}
        const isRealWx = u.openid && u.openid.indexOf('openid_') !== 0
        this.setData({
          me: {
            openid: u.openid,
            unionid: u.unionid || '',
            balance: u.balance,
            isRealWx: !!isRealWx
          }
        })
        this.push('微信登录', true, isRealWx ? '真实 openid：' + u.openid : '演示 openid：' + u.openid)
      } else {
        this.push('微信登录', false, r.msg || '登录失败')
      }
    } catch (e) {
      this.push('微信登录', false, String(e.msg || e.errMsg || e))
    }

    // 4) 在线服务者
    try {
      const r = await api.getOnlineProviders(0)
      const n = (r.data && r.data.list) ? r.data.list.length : 0
      this.push('服务者列表', r.code === 0, r.code === 0 ? n + ' 位在线' : (r.msg || '失败'))
      this.providers = (r.data && r.data.list) || []
    } catch (e) {
      this.push('服务者列表', false, String(e.msg || e))
    }

    // 5) 余额
    try {
      const r = await api.getBalance()
      this.push('账户余额', r.code === 0, r.code === 0 ? '¥' + r.data.balance : (r.msg || '失败'))
    } catch (e) {
      this.push('账户余额', false, String(e.msg || e))
    }
  },

  // 真实支付：拉起微信收银台
  async testPay() {
    this.setData({ payResult: '正在下单…' })
    try {
      const r = await api.createRecharge(10)
      if (r.code !== 0) {
        this.setData({ payResult: '下单失败：' + (r.msg || JSON.stringify(r)) })
        return
      }
      // 后端：真实微信 openid + 已配置支付 → need_pay=true + pay_params
      // mock 用户（openid_ 前缀）→ 直接入账，无 need_pay
      if (!r.data.need_pay) {
        this.setData({ payResult: '已直接入账（演示模式，未走真实支付）：' + JSON.stringify(r.data) })
        return
      }
      const p = r.data.pay_params
      if (!p) {
        this.setData({ payResult: '需要支付但未返回支付参数：' + JSON.stringify(r.data) })
        return
      }
      this.setData({ payResult: '已下单，拉起收银台…' })
      wx.requestPayment({
        timeStamp: p.timeStamp,
        nonceStr: p.nonceStr,
        package: p.package,
        signType: p.signType,
        paySign: p.paySign,
        success: () => this.setData({ payResult: '支付成功（余额入账需等微信回调，回调地址需为公网 HTTPS）' }),
        fail: (e) => this.setData({ payResult: '支付取消或失败：' + (e.errMsg || '') })
      })
    } catch (e) {
      this.setData({ payResult: '异常：' + String(e.msg || e.errMsg || e) })
    }
  },


  wxLogin() {
    return new Promise((resolve, reject) => {
      wx.login({ success: (r) => r.code ? resolve(r.code) : reject(new Error('wx.login 未返回 code')), fail: reject })
    })
  },

  wxReq(opt) {
    return new Promise((resolve, reject) => {
      wx.request(Object.assign({ method: 'GET', success: resolve, fail: reject }, opt))
    }).then((r) => {
      if (r.statusCode >= 200 && r.statusCode < 300) return r.data
      throw new Error('HTTP ' + r.statusCode)
    })
  }
})
