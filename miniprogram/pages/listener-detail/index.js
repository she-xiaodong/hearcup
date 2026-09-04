// pages/listener-detail —— 倾听师详情页（选时长 → 下单 → 支付 → 拨号）
//
// 流程顺序不能变：下单只建单不扣费；支付完成（微信支付或余额）后 confirm 才会返回手机号。
// 这样保证「没付钱就看不到号码、也打不了电话」。

const api = require('../../utils/api.js')

Page({
  data: {
    id: 0,
    listener: null,
    listenerLevelText: '',
    expertiseList: [],
    priceTiers: [],
    tierOptions: [],     // 下拉选项文案（picker）
    tierIndex: 0,
    selectedLabel: '',
    selectedMinutes: 15,
    selectedPrice: 0,
    selectedCoins: 0,
    // H币口径：1元 = 10 H币，页面统一展示 H币
    coinName: 'H币',
    coinRate: 10,
    balanceCoins: '0',
    enough: true,
    loading: true,
    paying: false,
  },

  onLoad(options) {
    const id = Number(options.id)
    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }
    this.setData({ id })
    this.loadDetail(id)
  },

  // 从充值页返回时刷新余额（避免充值后仍显示旧余额、按钮还是「去充值」）
  onShow() {
    if (this.data.listener && !this.data.loading) this.loadBalance()
  },

  async loadDetail(id) {
    this.setData({ loading: true })
    try {
      const r = await api.getListenerDetail(id)
      if (r.code !== 0 || !r.data || !r.data.provider) {
        throw new Error((r && r.msg) || '加载失败')
      }
      const p = r.data.provider
      const expertiseList = String(p.expertise || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
      const LEVEL_TEXT = { 1: '实习', 2: '认证', 3: '资深' }
      const listenerLevelText = LEVEL_TEXT[p.level] || ''

      // H币口径：后端同时下发 price_tiers（元）与 price_tiers_coins（H币）
      const coinName = r.data.coin_name || 'H币'
      const coinRate = Number(r.data.coin_rate) || 10
      const toCoins = (yuan) => {
        const v = Math.round(Number(yuan || 0) * coinRate * 10) / 10
        return Math.round(v) === v ? Math.round(v) : v
      }

      // 优先用后端算好的 H币档位，没有再本地换算
      const rawCoins = r.data.price_tiers_coins || {}
      const raw = r.data.price_tiers || {}
      const tiers = Object.keys(raw)
        .map(k => ({
          minutes: Number(k),
          price: Number(raw[k]),
          coins: rawCoins[k] !== undefined ? Number(rawCoins[k]) : toCoins(raw[k]),
          label: k + '分钟'
        }))
        .filter(t => t.minutes > 0 && t.price > 0)
        .sort((a, b) => a.minutes - b.minutes)

      // 没有配置档位时兜底：按单价 × 时长生成默认档位
      const fallback = []
      if (!tiers.length) {
        const unit = Number(p.price_per_minute) || 1
        ;[15, 30, 45, 60, 75, 90, 105, 120].forEach(m => {
          const yuan = Math.round(unit * m * 100) / 100
          fallback.push({ minutes: m, price: yuan, coins: toCoins(yuan), label: m + '分钟' })
        })
      }
      const list = tiers.length ? tiers : fallback

      // picker 下拉选项文案（如「15分钟 · 150 H币」）
      const tierOptions = list.map(t => `${t.minutes}分钟 · ${t.coins} ${coinName}`)

      this.setData({
        listener: p,
        listenerLevelText,
        expertiseList,
        priceTiers: list,
        tierOptions,
        tierIndex: 0,
        selectedLabel: list[0].label,
        selectedMinutes: list[0].minutes,
        selectedPrice: list[0].price,
        selectedCoins: list[0].coins,
        coinName, coinRate,
        loading: false
      })
      wx.setNavigationBarTitle({ title: p.real_name || p.nickname || p.nickName || '倾听师' })

      // 拉一次余额（H币），下单前就能判断够不够
      this.loadBalance(toCoins)
    } catch (err) {
      this.setData({ loading: false })
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    }
  },

  // 拉取余额（H币口径）
  async loadBalance(toCoins) {
    try {
      const b = await api.getBalance()
      if (b.code === 0 && b.data) {
        const fmt = toCoins || ((y) => {
          const rate = this.data.coinRate || 10
          const v = Math.round(Number(y || 0) * rate * 10) / 10
          return Math.round(v) === v ? Math.round(v) : v
        })
        const balanceCoins = fmt(b.data.balance)
        const enough = Number(b.data.balance) >= Number(this.data.selectedPrice)
        this.setData({ balanceCoins: String(balanceCoins), enough })
      }
    } catch (e) { /* 余额拉取失败不阻断下单 */ }
  },

  selectTier(e) {
    const minutes = Number(e.currentTarget.dataset.minutes)
    const price = Number(e.currentTarget.dataset.price)
    const coins = e.currentTarget.dataset.coins !== undefined
      ? Number(e.currentTarget.dataset.coins)
      : this.toCoins(price)
    const balanceYuan = Number(this.data.balanceCoins) / (this.data.coinRate || 10)
    this.setData({
      selectedMinutes: minutes,
      selectedPrice: price,
      selectedCoins: coins,
      enough: balanceYuan >= price
    })
  },

  // picker 下拉选择时长档位
  onTierChange(e) {
    const idx = Number(e.detail.value)
    const t = (this.data.priceTiers || [])[idx]
    if (!t) return
    const balanceYuan = Number(this.data.balanceCoins) / (this.data.coinRate || 10)
    this.setData({
      tierIndex: idx,
      selectedLabel: t.label,
      selectedMinutes: t.minutes,
      selectedPrice: t.price,
      selectedCoins: t.coins,
      enough: balanceYuan >= t.price
    })
  },

  goRecharge() {
    wx.navigateTo({ url: '/pages/recharge/recharge' })
  },

  // 元 → H币
  toCoins(yuan) {
    const rate = this.data.coinRate || 10
    const v = Math.round(Number(yuan || 0) * rate * 10) / 10
    return Math.round(v) === v ? Math.round(v) : v
  },

  // 下单 → 支付 → 确认 → 拨号
  async handleOrder() {
    if (this.data.paying) return
    const p = this.data.listener
    if (!p) return

    // 余额不足：直接引导充值，不建单（后端也会拦截，这里前置一下少一次请求）
    if (!this.data.enough) {
      const go = await new Promise((resolve) => {
        wx.showModal({
          title: '余额不足',
          content: `本次需 ${this.data.selectedCoins} ${this.data.coinName}，当前余额 ${this.data.balanceCoins} ${this.data.coinName}，是否去充值？`,
          confirmText: '去充值', cancelText: '取消',
          success: (r) => resolve(!!r.confirm)
        })
      })
      if (go) wx.navigateTo({ url: '/pages/recharge/recharge' })
      return
    }

    this.setData({ paying: true })
    wx.showLoading({ title: '创建订单', mask: true })
    try {
      const ord = await api.createCallOrder(p.id, this.data.selectedMinutes)
      if (ord.code !== 0 || !ord.data) throw new Error((ord && ord.msg) || '创建订单失败')
      const callId = ord.data.call_id

      // 支付：默认扣账户余额（H币），余额不足再引导充值 —— H币是平台唯一计价单位
      const pay = await api.payCallOrder(callId, 'balance')
      if (pay.code !== 0 || !pay.data) throw new Error((pay && pay.msg) || '支付发起失败')
      wx.hideLoading()

      if (pay.data.need_recharge) {
        const coinName = pay.data.coin_name || this.data.coinName || 'H币'
        const need = pay.data.amount_coins || this.data.selectedCoins
        const have = pay.data.balance_coins || this.data.balanceCoins
        const go = await new Promise((resolve) => {
          wx.showModal({
            title: '余额不足',
            content: `本次需 ${need} ${coinName}，当前余额 ${have} ${coinName}，是否去充值？`,
            confirmText: '去充值', cancelText: '取消',
            success: (r) => resolve(!!r.confirm)
          })
        })
        if (go) { wx.navigateTo({ url: '/pages/recharge/recharge' }) }
        this.setData({ paying: false })
        return
      }

      if (pay.data.need_pay) {
        const pm = pay.data.pay_params || {}
        await new Promise((resolve, reject) => {
          wx.requestPayment({
            timeStamp: String(pm.timeStamp || ''),
            nonceStr: pm.nonceStr || '',
            package: pm.package || '',
            signType: pm.signType || 'RSA',
            paySign: pm.paySign || '',
            success: resolve,
            fail: (e) => reject(new Error((e && e.errMsg) || '支付取消'))
          })
        })
      }

      await this.confirmOrder(callId)
    } catch (err) {
      wx.hideLoading()
      const msg = err.message || '下单失败'
      if (msg.indexOf('cancel') === -1) wx.showToast({ title: msg, icon: 'none' })
      else wx.showToast({ title: '支付已取消', icon: 'none' })
    } finally {
      this.setData({ paying: false })
    }
  },

  // 支付完成 → 确认订单 → 拿到手机号后跳转拨号页
  async confirmOrder(callId) {
    wx.showLoading({ title: '确认订单', mask: true })
    try {
      const res = await api.confirmCallOrder(callId)
      if (res.code !== 0 || !res.data) throw new Error((res && res.msg) || '订单确认失败')
      const d = res.data
      wx.hideLoading()
      wx.navigateTo({
        url: `/pages/calling-phone/index?call_id=${callId}` +
          `&room_id=${d.room_id || ''}` +
          `&callee_phone=${encodeURIComponent(d.callee_phone || '')}` +
          `&callee_phone_masked=${encodeURIComponent(d.callee_phone_masked || '')}` +
          `&callee_nickname=${encodeURIComponent(d.callee_nickname || '')}` +
          `&minutes=${d.minutes || this.data.selectedMinutes}` +
          `&amount=${d.amount || this.data.selectedPrice}` +
          `&unit_price=${d.unit_price || 0}`
      })
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message || '订单确认失败', icon: 'none' })
    }
  },

  onShareAppMessage() {
    const p = this.data.listener || {}
    return {
      title: `倾听师 ${p.real_name || p.nickname || ''}`,
      path: `/pages/listener-detail/index?id=${this.data.id}`
    }
  }
})
