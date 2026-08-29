// pages/feedback/feedback —— 意见反馈
const api = require('../../utils/api.js')

Page({
  data: { content: '', contact: '', submitted: false },

  onContent(e) { this.setData({ content: e.detail.value }) },
  onContact(e) { this.setData({ contact: e.detail.value }) },

  async submit() {
    const content = (this.data.content || '').trim()
    if (!content) { wx.showToast({ title: '请填写反馈内容', icon: 'none' }); return }
    const r = await api.submitFeedback(content, (this.data.contact || '').trim())
    if (r.code === 0) {
      this.setData({ submitted: true })
    } else {
      wx.showToast({ title: r.msg || '提交失败', icon: 'none' })
    }
  },

  backHome() { wx.switchTab({ url: '/pages/profile/profile' }) }
})
