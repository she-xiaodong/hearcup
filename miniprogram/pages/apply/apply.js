// pages/apply/apply —— 倾听者入驻流程（统一角色，直接填表）
const store = require('../../utils/store.js')
const { tags } = require('../../utils/mock.js')
const api = require('../../utils/api.js')

Page({
  data: {
    step: 0,
    allTags: tags.map(t => ({ name: t, selected: false })),
    form: {
      nickName: '', phone: '', idCard: '', expertise: [], certImages: [], intro: '',
      bankAccountName: '', bankCardNo: '', bankName: '', bankBranch: ''
    }
  },

  onInput(e) {
    const k = e.currentTarget.dataset.k
    this.setData({ [`form.${k}`]: e.detail.value })
  },

  toggleTag(e) {
    const name = e.currentTarget.dataset.t
    const allTags = this.data.allTags.map(item =>
      item.name === name ? { name: item.name, selected: !item.selected } : item
    )
    const expertise = allTags.filter(item => item.selected).map(item => item.name)
    this.setData({ allTags, 'form.expertise': expertise })
  },

  chooseCert() {
    const that = this
    wx.chooseMedia({
      count: 5 - this.data.form.certImages.length, mediaType: ['image'],
      success(res) {
        const paths = res.tempFiles.map(f => f.tempFilePath)
        that.setData({ 'form.certImages': that.data.form.certImages.concat(paths) })
      }
    })
  },

  validate() {
    const f = this.data.form
    if (!f.nickName.trim()) return '请填写昵称'
    if (!/^1\d{10}$/.test(f.phone)) return '请填写正确的手机号'
    if (!f.idCard.trim()) return '请填写身份证号'
    if (f.expertise.length === 0) return '请至少选择一个擅长领域'
    if (f.certImages.length === 0) return '请至少上传一张资质证书'
    if (!f.bankAccountName.trim()) return '请填写持卡人姓名'
    if (!f.bankCardNo.trim()) return '请填写银行卡号'
    if (!f.bankName.trim()) return '请填写开户银行'
    return ''
  },

  async submit() {
    const err = this.validate()
    if (err) { wx.showToast({ title: err, icon: 'none' }); return }

    if (getApp().globalData.config.useMock) {
      store.setApply({ role: 1, status: 0, submittedAt: Date.now(), form: this.data.form })
      this.setData({ step: 1 })
      return
    }
    const r = await api.applyProvider(this.data.form)
    if (r.code === 0) {
      store.setApply({ role: 1, status: 0, submittedAt: Date.now(), form: this.data.form })
      this.setData({ step: 1 })
    } else {
      wx.showToast({ title: (r.msg || '提交失败'), icon: 'none' })
    }
  },

  backHome() { wx.switchTab({ url: '/pages/profile/profile' }) }
})
