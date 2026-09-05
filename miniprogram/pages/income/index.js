// pages/income/index —— 倾听者「收益明细」
// 通话收入流水（earnings.details）+ 汇总统计；提现进度见「提现记录」页。
const api = require('../../utils/api.js')
const { fmtTime, durText } = require('../../utils/fmt.js')

Page({
  data: {
    loading: true,
    summary: { withdrawable: 0, today: 0, total: 0, completed: 0 },
    income: [],      // 通话收入流水（分页追加）
    page: 1,
    hasMore: false,
    loadingMore: false
  },

  onShow() { this.refresh() },

  mapDetail(x) {
    return {
      name: x.user_name || '来电用户',
      time: fmtTime(x.created_at),
      dur: durText(x.duration),
      income: Number(x.income) || 0
    }
  },

  async refresh() {
    this.setData({ loading: true, page: 1, hasMore: false, loadingMore: false })
    try {
      await this.fetchPage(1, false)
    } catch (err) {
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
    const e = await api.getProviderEarnings(page, 20)
    const ed = (e && e.code === 0 && e.data) ? e.data : {}
    const incoming = (ed.details || []).map(x => this.mapDetail(x))
    this.setData({
      summary: {
        withdrawable: Number(ed.withdrawable) || 0,
        today: Number(ed.today_income) || 0,
        total: Number(ed.total_earnings) || 0,
        completed: Number(ed.completed_income) || 0
      },
      income: append ? this.data.income.concat(incoming) : incoming,
      hasMore: !!ed.details_has_more
    })
  }
})
