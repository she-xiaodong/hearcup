// pages/apply/apply —— 服务者入驻流程（双角色：先选角色再填表）
const store = require('../../utils/store.js')
const { tags } = require('../../utils/mock.js')
const api = require('../../utils/api.js')

Page({
  data: {
    step: 0, role: 0,
    allTags: tags,
    form: {
      nickName: '', phone: '', idCard: '', expertise: [], certImages: [],
      certNo: '', certImage: '', years: '', background: '', intro: ''
    }
  },

  pickRole(e) { this.setData({ role: Number(e.currentTarget.dataset.role) }) },
  toForm() { if (this.data.role) this.setData({ step: 1 }) },
  backRole() { this.setData({ step: 0 }) },

  onInput(e) {
    const k = e.currentTarget.dataset.k
    this.setData({ [`form.${k}`]: e.detail.value })
  },

  toggleTag(e) {
    const t = e.currentTarget.dataset.t
    const exp = this.data.form.expertise.slice()
    const i = exp.indexOf(t)
    if (i > -1) exp.splice(i, 1); else exp.push(t)
    this.setData({ 'form.expertise': exp })
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

  chooseCertPhoto() {
    const that = this
    wx.chooseMedia({
      count: 1, mediaType: ['image'],
      success(res) { that.setData({ 'form.certImage': res.tempFiles[0].tempFilePath }) }
    })
  },

  validate() {
    const f = this.data.form
    if (!f.nickName.trim()) return '请填写昵称'
    if (!/^1\d{10}$/.test(f.phone)) return '请填写正确的手机号'
    if (!f.idCard.trim()) return '请填写身份证号'
    if (f.certImages.length === 0) return '请至少上传一张资质证书'
    if (this.data.role === 2) {
      if (!f.certNo.trim()) return '咨询师需填写证书编号'
      if (!f.certImage) return '咨询师需上传证书照片'
      if (!f.years || Number(f.years) <= 0) return '咨询师需填写从业年限'
      if (!f.background.trim()) return '咨询师需填写专业背景'
    }
    return ''
  },

  async submit() {
    const err = this.validate()
    if (err) { wx.showToast({ title: err, icon: 'none' }); return }

    if (getApp().globalData.config.useMock) {
      const apply = { role: this.data.role, status: 0, submittedAt: Date.now(), form: this.data.form }
      store.setApply(apply)
      this.setData({ step: 2 })
      return
    }
    const r = await api.applyProvider(this.data.form)
    if (r.code === 0) {
      // 同步本地一份，便于离线态展示
      store.setApply({ role: this.data.role, status: 0, submittedAt: Date.now(), form: this.data.form })
      this.setData({ step: 2 })
    } else {
      wx.showToast({ title: (r.msg || '提交失败'), icon: 'none' })
    }
  },

  backHome() { wx.switchTab({ url: '/pages/profile/profile' }) }
})
