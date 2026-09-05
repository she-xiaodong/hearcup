// pages/withdraw-records/index —— 倾听者「提现记录」
// 每笔提现申请单：状态(审核中/已通过/已打款/已拒绝)；点击条目展开详情；
// 已打款且微信需手动领取时提供「去领取」（商家转账到零钱）。
const api = require('../../utils/api.js')
const { fmtTime } = require('../../utils/fmt.js')

const WD_TEXT = { 0: '审核中', 1: '已通过，等待打款', 2: '已打款', 3: '已拒绝' }
const TF_TEXT = {
  ACCEPTED: '微信转账待领取', WAIT_USER_CONFIRM: '微信转账待领取', PROCESSING: '打款处理中',
  TRANSFERING: '打款转账中', FINISHED: '已到账', SUCCESS: '已到账',
  FAIL: '打款失败', CANCELLED: '已撤销'
}

Page({
  data: {
    loading: true,
    list: [],
    expandedId: 0,
    claimingId: 0,
    page: 1,
    hasMore: false,
    loadingMore: false
  },

  onShow() { this.refresh() },

  mapItem(w, now) {
    const wdText = WD_TEXT[w.status] || '处理中'
    let stateLine = ''
    let badge = ''
    if (w.status === 0) badge = '审核中'
    else if (w.status === 1) badge = '待打款'
    else if (w.status === 2) {
      badge = w.can_claim ? '待领取' : (TF_TEXT[w.transfer_state] || '已打款')
      if (w.transfer_state) stateLine = '转账：' + (TF_TEXT[w.transfer_state] || w.transfer_state)
      if (w.transfer_fail) stateLine = '转账失败：' + w.transfer_fail
    } else if (w.status === 3) {
      badge = '已拒绝'
      if (w.remark) stateLine = '原因：' + w.remark
    }
    return {
      id: w.id,
      amount: w.amount,
      fee: w.fee || 0,
      wdText,
      badge,
      stateLine,
      canClaim: !!w.can_claim,
      transferId: w.transfer_id || 0,
      transferState: w.transfer_state || '',
      timeText: fmtTime(w.created_at),
      approvedText: w.approved_at ? fmtTime(w.approved_at) : '',
      pseudo: w.created_at > Math.floor(now / 1000) + 100000
    }
  },

  async refresh() {
    this.setData({ loading: true, page: 1, hasMore: false, loadingMore: false })
    try {
      await this.fetchPage(1, false)
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 上拉加载下一页
  async loadMore() {
    if (!this.data.hasMore || this.data.loadingMore) return
    const next = this.data.page + 1
    this.setData({ loadingMore: true })
    try {
      await this.fetchPage(next, true)
      this.setData({ page: next })
    } finally {
      this.setData({ loadingMore: false })
    }
  },

  onPullDownRefresh() {
    this.refresh().then(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    this.loadMore()
  },

  async fetchPage(page, append) {
    const r = await api.getProviderWithdrawals(page, 20)
    const raw = (r && r.code === 0 && r.data && r.data.list) || []
    const now = Date.now()
    const incoming = raw.map(w => this.mapItem(w, now))
    this.setData({
      list: append ? this.data.list.concat(incoming) : incoming,
      hasMore: !!(r && r.code === 0 && r.data && r.data.has_more)
    })
  },

  toggle(e) {
    const id = Number(e.currentTarget.dataset.id)
    this.setData({ expandedId: this.data.expandedId === id ? 0 : id })
  },

  // 「去领取」：后端查最新凭证 → 唤起微信领取页（商家转账到零钱须手动领取）
  async onClaim(e) {
    const transferId = Number(e.currentTarget.dataset.transfer)
    const id = Number(e.currentTarget.dataset.id)
    if (!transferId || this.data.claimingId) return
    this.setData({ claimingId: id })
    try {
      const r = await api.claimTransfer(transferId)
      if (r.code !== 0) {
        wx.showToast({ title: r.msg || '暂无可领取凭证', icon: 'none' })
        this.refresh()
        return
      }
      const pkg = r.data && r.data.package_info
      if (!pkg) {
        wx.showToast({ title: (r.data && r.data.msg) || '暂无可领取凭证，稍后再试', icon: 'none' })
        this.refresh()
        return
      }
      wx.requestMerchantTransfer({
        mchId: (r.data && r.data.mch_id) || '',
        appId: (r.data && r.data.app_id) || '',
        package: pkg,
        success: () => {
          wx.showToast({ title: '请在微信中点击领取', icon: 'none' })
          setTimeout(() => this.refresh(), 2500)
        },
        fail: () => { wx.showToast({ title: '唤起领取失败，请重试', icon: 'none' }) }
      })
    } catch (err) {
      wx.showToast({ title: '领取失败', icon: 'none' })
    } finally {
      this.setData({ claimingId: 0 })
    }
  },

  goApply() {
    wx.navigateBack()
  }
})
