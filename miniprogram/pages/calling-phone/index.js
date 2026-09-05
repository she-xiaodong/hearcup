// pages/calling-phone —— 拨号页（只有已支付订单才能进到这里）
//
// 关键点：本页不产生任何费用计算，费用在下单时已按套餐预付；
// 通话结束上报实际时长，后端按「套餐价 + 超出部分 × 单价」结算。

const api = require('../../utils/api.js')
const store = require('../../utils/store.js')
const mock = require('../../utils/mock.js')

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

  onReady() {
    // 自动拨号：真机先上报开始再调起电话；演示模式直接模拟通话
    this.autoDial()
  },

  async autoDial() {
    if (getApp().globalData.config.useMock) {
      this.setData({ status: 'connected', statusText: '正在通话', startTime: Date.now() })
      this.startTimer()
      return
    }
    await this.makeCall()
  },

  onUnload() {
    if (this.data._timer) clearInterval(this.data._timer)
  },

  // 调起系统电话：先上报“拨号开始”（后端记时），再拨号（幂等可重拨）
  async makeCall() {
    const phone = String(this.data.callee_phone || '')
    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '号码无效，请联系客服', icon: 'none' })
      return
    }
    if (!getApp().globalData.config.useMock) {
      const st = await api.startCall(this.data.room_id, this.data.call_id)
      if (st && st.code !== 0) {
        wx.showToast({ title: (st && st.msg) || '开始服务失败', icon: 'none' })
        return
      }
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

  // 未拨号退款：全额退回余额
  doRefund() {
    wx.showModal({
      title: '申请退款',
      content: `未使用本次服务，将全额退回 ${this.data.amountCoins} ${this.data.coinName}，确定吗？`,
      confirmText: '退款',
      success: async (r) => {
        if (!r.confirm) return
        wx.showLoading({ title: '处理中', mask: true })
        const res = await api.refundCall(this.data.room_id, this.data.call_id)
        wx.hideLoading()
        if (res && res.code === 0) {
          wx.showModal({ title: '退款成功', content: `已退回 ${this.data.amountCoins} ${this.data.coinName} 到余额`, showCancel: false, success: () => wx.navigateBack() })
        } else {
          wx.showToast({ title: (res && res.msg) || '退款失败', icon: 'none' })
        }
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
    let minutes = this.data.duration
    // 费用展示：套餐预付价 + 超出部分 × 单价
    const pack = Number(this.data.minutes) || 0
    const unit = Number(this.data.unit_price) || 0
    const extra = minutes > pack ? (minutes - pack) * unit : 0
    let cost = (Number(this.data.amount || 0) + extra).toFixed(2)

    const coinName = this.data.coinName || 'H币'
    let costCoins = this.toCoins(cost)

    const ok = await new Promise((resolve) => {
      wx.showModal({
        title: '结束通话',
        content: `已通话约 ${minutes} 分钟，将按实际时长结算，多退少补。
（如需微调可直接改为实际分钟数，留空则按 ${minutes} 分钟）`,
        confirmText: '结束结算',
        cancelText: '继续聊',
        editable: true,
        placeholderText: String(minutes),
        success: (r) => resolve(r)
      })
    })
    if (!ok.confirm) { this.startTimer(); return }
    const typed = parseInt(ok.content, 10)
    const finalMinutes = (typed && typed > 0) ? typed : minutes
    if (finalMinutes !== minutes) {
      // 用户微调过，重算展示费用
      const adjExtra = finalMinutes > pack ? (finalMinutes - pack) * unit : 0
      cost = (Number(this.data.amount || 0) + adjExtra).toFixed(2)
      costCoins = this.toCoins(cost)
      minutes = finalMinutes
    }

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
        // 多退少补提示
        const rr = Number(r.data.refund) || 0
        const ex = Number(r.data.extra) || 0
        if (rr > 0 || ex > 0) {
          const lines = []
          lines.push(`本次实际 ${r.data.minutes} 分钟，应付 ${this.toCoins(finalYuan)} ${coinName}`)
          if (rr > 0) lines.push(`未用完退回 ${this.toCoins(rr)} ${coinName}（已入余额）`)
          if (ex > 0) lines.push(`超出补扣 ${this.toCoins(ex)} ${coinName}（余额已扣）`)
          wx.showModal({ title: '结算完成', content: lines.join('\n'), showCancel: false })
        }
        // 演示数据模式：本地模拟记账（扣余额 + 生成通话记录），与真实后端行为对齐
        if (getApp().globalData.config.useMock) this.mockSettle(minutes, Number(finalYuan))
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

  // 演示数据：本地记账
  mockSettle(minutes, yuanCost) {
    const now = new Date()
    const p2 = (n) => String(n).padStart(2, '0')
    if (yuanCost > 0) {
      const nb = (store.getBalance() || 0) - yuanCost
      store.setBalance(nb > 0 ? nb : 0)
    }
    const rec = {
      id: Date.now(),
      providerName: this.data.callee_nickname || '演示倾听者',
      callType: 1,
      durationText: `${p2(minutes)}分${p2(0)}秒`,
      amount: yuanCost,
      time: `${p2(now.getMonth() + 1)}-${p2(now.getDate())} ${p2(now.getHours())}:${p2(now.getMinutes())}`,
      rating: 0
    }
    mock.callRecords.unshift(rec)
    wx.showToast({ title: `演示记账：已扣 ${this.toCoins(yuanCost)} ${this.data.coinName}`, icon: 'none' })
  },

  back() {
    wx.navigateBack()
  }
})
