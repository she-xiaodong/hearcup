// pages/listener/listener —— 倾听者平台
//
// 倾听者侧的核心页面：查看入驻状态、开关接单、查看收益/申请提现、
// 收益明细、接听记录与提现记录。
//
// 说明：来电已改为「电话拨号」（用户下单后直接拨打系统电话），
// 与小程序前后台无关，故 v2.0 TUICallKit 时代的保活/订阅消息已全部移除。

const api = require('../../utils/api.js')
const store = require('../../utils/store.js')

Page({
  data: {
    loading: true,
    // 入驻状态：-1 未申请 / 0 待审核 / 1 已通过 / 2 已拒绝
    applyStatus: -1,
    isOnline: false,
    earnings: { today_income: 0, withdrawable: 0, total_earnings: 0, today_calls: 0 },
    transfers: []       // 分佣转账记录（含待领取）
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
        // 提现打款记录（倾听者发起转账后需手动领取）
        const tr = await api.getProviderTransfers()
        if (tr && tr.code === 0) this.setData({ transfers: this.mapTransfers(tr.data || []) })
      } else {
        this.setData({ transfers: [] })
      }
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
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

  // —— 收益明细 / 接听记录 ——
  goIncome() {
    wx.navigateTo({ url: '/pages/income/index' })
  },
  goProviderCalls() {
    wx.navigateTo({ url: '/pages/provider-calls/index' })
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
      wx.showToast({ title: (r.data && r.data.msg) || '提现申请已提交', icon: 'none' })
      this.refresh()
    } else {
      wx.showToast({ title: (r && r.msg) || '提现失败', icon: 'none' })
    }
  },

  // —— 提现记录（转账打款） ——
  // 把后端转账记录映射为展示结构（含状态文案、时间、领取凭证）
  mapTransfers(list) {
    const self = this
    return (list || []).map(t => {
      const d = new Date((t.created_at || 0) * 1000)
      const p2 = n => String(n).padStart(2, '0')
      const timeText = (t.created_at ? `${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}` : '')
      return {
        id: t.id,
        amount: t.amount || 0,
        state: t.state || '',
        stateText: self.transferStateText(t.state),
        canClaim: !!t.can_claim,
        package_info: t.package_info || '',
        mch_id: t.mch_id || '',
        app_id: t.app_id || '',
        timeText
      }
    })
  },

  transferStateText(state) {
    const m = {
      ACCEPTED: '待领取', PROCESSING: '处理中', WAIT_USER_CONFIRM: '待领取',
      TRANSFERING: '转账中', FINISHED: '已到账', SUCCESS: '已到账',
      FAIL: '打款失败', CANCELING: '撤销中', CANCELLED: '已撤销'
    }
    return m[state] || (state ? state : '受理中')
  },

  // 点击「去领取」：后端重新查询微信最新凭证 → 调起微信领取页
  async onClaim(e) {
    const id = e.currentTarget.dataset.id
    const item = (this.data.transfers || []).find(x => x.id === id)
    if (!item || !item.canClaim) return
    wx.showLoading({ title: '唤起领取…', mask: true })
    const r = await api.claimTransfer(id)
    wx.hideLoading()
    if (r.code !== 0) { wx.showToast({ title: r.msg || '领取失败', icon: 'none' }); return }
    const pkg = r.data && r.data.package_info
    if (!pkg) {
      // 没有可领取凭证：可能已到账或微信暂未生成，刷新列表
      wx.showToast({ title: (r.data && r.data.msg) || '暂无可领取凭证，稍后再试', icon: 'none' })
      this.refresh()
      return
    }
    // 调起微信「领取分佣」页（商家转账到零钱：用户须手动点击领取才到账）
    wx.requestMerchantTransfer({
      mchId: (r.data && r.data.mch_id) || item.mch_id || '',
      appId: (r.data && r.data.app_id) || item.app_id || '',
      package: pkg,
      success: () => {
        wx.showToast({ title: '请在微信中点击领取', icon: 'none' })
        // 领取为异步结果（微信回调确认到账），稍后拉取列表刷新状态
        setTimeout(() => this.refresh(), 2500)
      },
      fail: () => {
        wx.showToast({ title: '唤起领取失败，请重试', icon: 'none' })
      }
    })
  }
})
