// pages/listener/listener —— 倾听者平台
//
// 倾听者侧的核心页面：查看入驻状态、开关接单、查看收益/申请提现，
// 以及进入 收益明细 / 服务订单 / 提现记录 / 资料与价格设置。
//
// 说明：来电已改为「电话拨号」（用户下单后直接拨打系统电话），
// 与小程序前后台无关，故 v2.0 TUICallKit 时代的保活/订阅消息已全部移除。

const api = require('../../utils/api.js')

Page({
  data: {
    loading: true,
    // 入驻状态：-1 未申请 / 0 待审核 / 1 已通过 / 2 已拒绝
    applyStatus: -1,
    isOnline: false,
    earnings: { today_income: 0, withdrawable: 0, total_earnings: 0, today_calls: 0 },
    // 服务中订单（已拨号未结算）：置顶提醒倾听者把握服务时长
    serving: null
  },

  async onShow() {
    await this.refresh()
  },

  async refresh() {
    this.setData({ loading: true })
    try {
      const r = await api.getProviderStatus()
      const d = (r && r.data) || {}
      const st = typeof d.status === 'number' ? d.status : -1
      this.setData({ applyStatus: st, isOnline: d.is_online === 1 })
      if (st === 1) {
        const er = await api.getProviderEarnings()
        if (er && er.code === 0 && er.data) {
          // 合并默认值，防止后端缺字段时显示空白
          const e = Object.assign({ today_income: 0, withdrawable: 0, total_earnings: 0, today_calls: 0 }, er.data || {})
          this.setData({ earnings: e })
        }
        this.loadServing()
      }
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  onHide() {
    if (this._servTimer) { clearInterval(this._servTimer); this._servTimer = null }
  },
  onUnload() {
    if (this._servTimer) { clearInterval(this._servTimer); this._servTimer = null }
  },

  // 服务中副文案：套餐 + 已用分钟（或开始时刻）
  servingSub(usedMin, startAt, packMin) {
    const p2 = (n) => String(n).padStart(2, '0')
    const d = new Date(startAt * 1000)
    const hm = `${d.getMonth() + 1}月${d.getDate()}日 ${p2(d.getHours())}:${p2(d.getMinutes())}`
    return `套餐 ${packMin || 15} 分钟` + (usedMin > 0 ? ` · 已进行约 ${usedMin} 分钟` : ` · 开始于 ${hm}`)
  },

  // 服务中订单检测：有「已拨号未结算」的服务时置顶提醒（套餐时长/已用分钟），可去代结束
  async loadServing() {
    if (getApp().globalData.config.useMock) {
      this.setData({ serving: null })
      return
    }
    if (this._servTimer) { clearInterval(this._servTimer); this._servTimer = null }
    try {
      const r = await api.getProviderCalls(1, 100)
      const list = (r && r.code === 0 && r.data) || []
      const live = list.find(c => c.status === 0 && Number(c.start_time) > 0)
      if (!live) { this.setData({ serving: null }); return }
      const startAt = Number(live.start_time)
      const rawMin = Math.floor((Date.now() / 1000 - startAt) / 60)
      // 距开始超 240 分钟视为挂单过久：不再推算"已用"，改显示开始时刻
      const usedMin = rawMin > 240 ? 0 : Math.max(0, rawMin)
      this.setData({
        serving: {
          userName: live.user_name || '来电用户',
          minutes: live.minutes || 0,
          usedMin, startAt,
          subText: this.servingSub(usedMin, startAt, live.minutes || 0)
        }
      })
      // 停留在页面时每分钟刷新（仅"已进行"状态需要，本地推算不重复请求）
      this._servTimer = setInterval(() => {
        const sv = this.data.serving
        if (sv && sv.startAt) {
          const rm = Math.floor((Date.now() / 1000 - sv.startAt) / 60)
          const um = rm > 240 ? 0 : Math.max(0, rm)
          this.setData({ 'serving.usedMin': um, 'serving.subText': this.servingSub(um, sv.startAt, sv.minutes || 0) })
        }
      }, 60000)
    } catch (e) {
      this.setData({ serving: null })
    }
  },

  // 上/下线：决定是否接收来电。只有审核通过才能上线接单。
  async toggleOnline(e) {
    const on = e.detail.value
    if (this.data.applyStatus !== 1) {
      wx.showToast({ title: '需先通过入驻审核', icon: 'none' })
      this.setData({ isOnline: false })
      return
    }
    wx.showLoading({ title: on ? '上线中…' : '下线中…', mask: true })
    const r = on ? await api.setProviderOnline() : await api.setProviderOffline()
    wx.hideLoading()
    if (r && r.code === 0) {
      this.setData({ isOnline: on })
      wx.showToast({ title: on ? '已上线，可接听来电' : '已下线', icon: 'none' })
    } else {
      this.setData({ isOnline: !on })
      wx.showToast({ title: (r && r.msg) || '操作失败', icon: 'none' })
    }
  },

  goApply() {
    wx.navigateTo({ url: '/pages/apply/apply' })
  },

  // —— 资料与价格设置 ——
  goProviderEdit() {
    wx.navigateTo({ url: '/pages/provider-edit/index' })
  },

  // —— 收益明细 / 服务订单 / 提现记录 ——
  goIncome() {
    wx.navigateTo({ url: '/pages/income/index' })
  },
  goProviderCalls() {
    wx.navigateTo({ url: '/pages/provider-calls/index' })
  },
  goWithdrawRecords() {
    wx.navigateTo({ url: '/pages/withdraw-records/index' })
  },

  // —— 申请提现（余额实时计算，微信商家转账到零钱）——
  async goWithdraw() {
    const wd = Number(this.data.earnings.withdrawable) || 0
    if (wd <= 0) { wx.showToast({ title: '暂无可提现余额', icon: 'none' }); return }
    const res = await new Promise((resolve) => {
      wx.showModal({
        title: '申请提现（单笔最高 ¥200）',
        editable: true,
        placeholderText: `请输入提现金额（元，可提现 ¥${wd}）`,
        success: resolve
      })
    })
    if (!res.confirm) return
    const amount = Number(res.content)
    if (!amount || amount <= 0) { wx.showToast({ title: '金额无效', icon: 'none' }); return }
    if (amount > 200) { wx.showToast({ title: '单笔提现不能超过 200 元', icon: 'none' }); return }
    if (amount > wd) { wx.showToast({ title: '超出可提现余额', icon: 'none' }); return }
    wx.showLoading({ title: '提交中…', mask: true })
    const r = await api.withdraw(amount)
    wx.hideLoading()
    if (r && r.code === 0) {
      wx.showToast({ title: '已提交，可在「提现记录」查看进度', icon: 'none' })
      this.refresh()
    } else {
      wx.showToast({ title: (r && r.msg) || '提现失败', icon: 'none' })
    }
  }
})
