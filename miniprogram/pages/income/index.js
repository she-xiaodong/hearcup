// pages/income/index —— 倾听者「收益明细」
// 通话收入流水（earnings.details）+ 汇总统计；提现进度见「提现记录」页。
const api = require('../../utils/api.js')
const { fmtTime, durText } = require('../../utils/fmt.js')

Page({
  data: {
    loading: true,
    summary: { withdrawable: 0, today: 0, total: 0, completed: 0 },
    income: []      // 通话收入流水
  },

  onShow() { this.refresh() },

  async refresh() {
    this.setData({ loading: true })
    try {
      const e = await api.getProviderEarnings()
      const ed = (e && e.code === 0 && e.data) ? e.data : {}
      // 通话收入流水：按时间倒序
      const income = ((ed.details || []).slice())
        .sort((a, b) => (Number(b.created_at) || 0) - (Number(a.created_at) || 0))
        .map(x => ({
          name: x.user_name || '来电用户',
          time: fmtTime(x.created_at),
          dur: durText(x.duration),
          income: Number(x.income) || 0
        }))
      this.setData({
        summary: {
          withdrawable: Number(ed.withdrawable) || 0,
          today: Number(ed.today_income) || 0,
          total: Number(ed.total_earnings) || 0,
          completed: Number(ed.completed_income) || 0
        },
        income
      })
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  }
})
