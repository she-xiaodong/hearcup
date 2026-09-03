// pages/calling-phone —— 拨号页（只有已支付订单才能进到这里）
//
// 关键点：本页不产生任何费用计算，费用在下单时已按套餐预付；
// 通话结束上报实际时长，后端按「套餐价 + 超出部分 × 单价」结算。

const api = require('../../utils/api.js')

Page({
  data: {
    status: 'ready', // ready(待拨号) / connected(通话中) / ended(已结束)
    statusText: '等待呼叫',
    callee_phone_masked: '',
    callee_phone: '',
    callee_nickname: '',
    callee_avatar: '',
    call_id: 0,
    room_id: '',
    minutes: 0,
    amount: 0,
    unit_price: 0,
    // H币口径展示（内部按元结算，1元 = coinRate H币）
    coinName: 'H币',
    coinRate: 10,
    amountCoins: 0,
    unitPriceCoins: 0,
    costCoins: 0,
    timerText: '00:00',
    startTime: 0,
    duration: 0, // 实际通话分钟
    cost: 0,
  },

  // 元 → H币（rate 可显式传入，避免初始化时读到尚未写入的 data）
  toCoins(yuan, rate) {
    const r = Number(rate) || Number(this.data.coinRate) || 10
    const v = Math.round(Number(yuan || 0) * r * 10) / 10
    return Math.round(v) === v ? Math.round(v) : v
  },

  onLoad(options) {
    const {
      callee_phone_masked, callee_phone, callee_nickname, callee_avatar,
      call_id, room_id, unit_price, minutes, amount
    } = options

    // H币配置与详情页保持一致
    const cfg = (getApp() && getApp().globalData && getApp().globalData.config) || {}
    const coinName = cfg.coinName || 'H币'
    const coinRate = Number(cfg.coinRate) || 10

    const amountVal = parseFloat(amount) || 0
    const unitVal = parseFloat(unit_price) || 0

    this.setData({
      callee_phone_masked: decodeURIComponent(callee_phone_masked || ''),
      callee_phone: decodeURIComponent(callee_phone || ''),
      callee_nickname: decodeURIComponent(callee_nickname || ''),
      callee_avatar: decodeURIComponent(callee_avatar || ''),
      call_id: parseInt(call_id) || 0,
      room_id: room_id || '',
      unit_price: unitVal,
      minutes: parseInt(minutes) || 0,
      amount: amountVal,
      coinName, coinRate,
      amountCoins: this.toCoins(amountVal, coinRate),
      unitPriceCoins: this.toCoins(unitVal, coinRate),
      status: 'ready',
      statusText: '等待呼叫',
    })
  },

  onUnload() {
    if (this.data._timer) clearInterval(this.data._timer)
  },

  // 调起系统电话
  makeCall() {
    const phone = String(this.data.callee_phone || '')
    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '号码无效，请联系客服', icon: 'none' })
      return
    }
    wx.makePhoneCall({
      phoneNumber: phone,
      success: () => {
        this.setData({ status: 'connected', statusText: '正在通话', startTime: Date.now() })
        this.startTimer()
      },
      fail: () => {
        wx.showToast({ title: '已取消拨号', icon: 'none' })
      }
    })
  },

  // 免提：小程序无法直接控制系统电话的音频通道，引导用户在系统界面切换
  switchCall() {
    wx.showToast({ title: '请在系统通话界面切换免提', icon: 'none' })
  },

  startTimer() {
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.data.startTime) / 1000)
      const m = Math.floor(elapsed / 60)
      const s = elapsed % 60
      this.setData({
        timerText: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
        duration: m
      })
    }, 1000)
    this.setData({ _timer: timer })
  },

  stopTimer() {
    if (this.data._timer) {
      clearInterval(this.data._timer)
      this.setData({ _timer: null })
    }
  },

  // 结束通话：上报实际时长，后端结算
  async endCall() {
    this.stopTimer()
    const minutes = this.data.duration
    // 费用展示：套餐预付价 + 超出部分 × 单价
    const pack = Number(this.data.minutes) || 0
    const unit = Number(this.data.unit_price) || 0
    const extra = minutes > pack ? (minutes - pack) * unit : 0
    const cost = (Number(this.data.amount || 0) + extra).toFixed(2)

    const coinName = this.data.coinName || 'H币'
    const costCoins = this.toCoins(cost)

    const ok = await new Promise((resolve) => {
      wx.showModal({
        title: '结束通话',
        content: `本次通话 ${minutes} 分钟，费用 ${costCoins} ${coinName}，确认结束？`,
        confirmText: '结束',
        cancelText: '继续',
        success: (r) => resolve(!!r.confirm)
      })
    })
    if (!ok) { this.startTimer(); return }

    wx.showLoading({ title: '结算中', mask: true })
    try {
      const r = await api.reportCallResultWithMinutes('end', this.data.room_id, this.data.call_id, minutes)
      wx.hideLoading()
      if (r.code === 0 && r.data) {
        const finalYuan = Number(r.data.amount || cost).toFixed(2)
        this.setData({
          status: 'ended',
          statusText: '通话已结束',
          cost: finalYuan,
          costCoins: this.toCoins(finalYuan)
        })
      } else {
        wx.showToast({ title: (r && r.msg) || '结算失败', icon: 'none' })
        this.setData({ status: 'ended', statusText: '通话已结束', cost, costCoins })
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '结算失败，请联系客服', icon: 'none' })
      this.setData({ status: 'ended', statusText: '通话已结束', cost, costCoins })
    }
  },

  back() {
    wx.navigateBack()
  }
})
