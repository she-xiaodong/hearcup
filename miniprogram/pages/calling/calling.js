const store = require('../../utils/store.js')
const api = require('../../utils/api.js')

Page({
  data: {
    p: null, callType: 1, status: 'calling', statusText: '正在呼叫…',
    seconds: 0, timerText: '00:00', muted: false, videoOn: false,
    roomId: '', feeText: '', unitPrice: 0
  },

  async onLoad(q) {
    const pid = Number(q.pid)
    const type = Number(q.type) || 1
    let p
    if (getApp().globalData.config.useMock) {
      p = store.getProviders().find(x => x.id === pid)
    } else {
      const r = await api.getProvider(pid)
      p = r.code === 0 && r.data ? r.data.provider : null
    }
    if (!p) { wx.showToast({ title: '未找到服务者', icon: 'none' }); return }
    // 语音=基础价；视频=基础价×加价倍率（与后端计费一致）
    const rate = Number((getApp().globalData.config || {}).videoRate) || 1.5
    const unitPrice = type === 2 ? Math.round(p.price_per_minute * rate * 100) / 100 : p.price_per_minute
    this.setData({ p, callType: type, videoOn: type === 2, unitPrice })

    // 真实环境：调用 /api/v1/call/invite 换取 room_id/user_sig（此处为 MVP，未接入真实 TRTC SDK）
    if (!getApp().globalData.config.useMock) {
      const inv = await api.invite(pid, type)
      if (inv.code === 0 && inv.data) {
        this.setData({ roomId: inv.data.room_id })
        if (typeof inv.data.unit_price === 'number' && inv.data.unit_price > 0) {
          this.setData({ unitPrice: inv.data.unit_price })
        }
      } else {
        wx.showToast({ title: (inv.msg || '呼叫失败'), icon: 'none' })
        setTimeout(() => wx.navigateBack(), 1200)
        return
      }
    }
    this.startFlow()
  },

  startFlow() {
    this.t1 = setTimeout(() => {
      this.setData({ status: 'ringing', statusText: '等待对方接听…' })
      this.t2 = setTimeout(() => {
        this.setData({ status: 'connected', statusText: '已接通' })
        this.startTimer()
      }, 3000)
    }, 2200)
  },

  startTimer() {
    this.timer = setInterval(() => {
      const s = this.data.seconds + 1
      this.setData({ seconds: s, timerText: this.fmt(s) })
    }, 1000)
  },

  fmt(s) {
    const m = String(Math.floor(s / 60)).padStart(2, '0')
    const ss = String(s % 60).padStart(2, '0')
    return `${m}:${ss}`
  },

  toggleMute() { this.setData({ muted: !this.data.muted }) },

  // 视频切换仅对「视频呼叫」生效（摄像头开关）；语音通话按语音计费，不支持中途升级
  toggleVideo() {
    if (this.data.callType !== 2) {
      wx.showToast({ title: '本次为语音通话，视频请在呼叫时选择', icon: 'none' })
      return
    }
    this.setData({ videoOn: !this.data.videoOn })
  },

  async hangup() {
    clearTimeout(this.t1); clearTimeout(this.t2); clearInterval(this.timer)
    if (getApp().globalData.config.useMock) {
      const minutes = Math.max(1, Math.ceil(this.data.seconds / 60))
      const fee = (minutes * this.data.unitPrice).toFixed(2)
      wx.showToast({ title: `通话结束 · 扣费¥${fee}`, icon: 'none', duration: 1800 })
      setTimeout(() => wx.navigateBack(), 900)
      return
    }
    // 真实环境：调用 /api/v1/call/end，后端按分钟向上取整、扣费、结算
    const r = await api.endCall(this.data.roomId)
    if (r.code === 0 && r.data) {
      const amount = (r.data.amount || 0).toFixed(2)
      wx.showToast({ title: `通话结束 · 扣费¥${amount}`, icon: 'none', duration: 1800 })
      if (typeof r.data.balance === 'number') store.setBalance(r.data.balance)
    } else {
      wx.showToast({ title: '通话已结束', icon: 'none' })
    }
    setTimeout(() => wx.navigateBack(), 900)
  },

  onUnload() {
    clearTimeout(this.t1); clearTimeout(this.t2); clearInterval(this.timer)
  }
})
