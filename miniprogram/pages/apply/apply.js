// pages/apply/apply —— 倾听者入驻流程（统一角色，直接填表）
const store = require('../../utils/store.js')
const { tags } = require('../../utils/mock.js')
const api = require('../../utils/api.js')

Page({
  data: {
    step: 0,
    allTags: tags.map(t => ({ name: t, selected: false })),
    genderOptions: [
      { label: '女', value: 0 },
      { label: '男', value: 1 },
    ],
    genderIndex: 0,
    educationOptions: [
      { label: '高中', value: 'high' },
      { label: '大专', value: 'college' },
      { label: '本科', value: 'bachelor' },
      { label: '硕士', value: 'master' },
      { label: '博士', value: 'phd' },
    ],
    educationIndex: 2,
    form: {
      realName: '', gender: 0, age: '', city: '', education: 'bachelor', major: '',
      phone: '', idCard: '', yearsOfExp: '', consultHours: '',
      expertise: [], educationImages: [], counselorImages: [], certificateNo: '', intro: ''
    }
  },

  onLoad() {
    // 进入页面先查入驻状态：未申请=填表(0)、待审核=审核中(1)、通过=审核通过(2)、拒绝=未通过(3)
    this.checkStatus()
  },

  async checkStatus() {
    if (getApp().globalData.config.useMock) {
      const apply = store.getApply()
      if (apply && apply.status === 1) this.setData({ step: 2 })
      else if (apply && apply.status === 2) this.setData({ step: 3 })
      else if (apply) this.setData({ step: 1 })
      return
    }
    const r = await api.getProviderStatus()
    if (r.code === 0 && r.data && typeof r.data.status === 'number' && r.data.status >= 0) {
      const st = r.data.status
      if (st === 1) this.setData({ step: 2 })
      else if (st === 2) this.setData({ step: 3 })
      else this.setData({ step: 1 }) // 0 待审核
    }
  },

  onInput(e) {
    const k = e.currentTarget.dataset.k
    this.setData({ [`form.${k}`]: e.detail.value })
  },

  onGenderChange(e) {
    this.setData({ genderIndex: e.detail.value, 'form.gender': this.data.genderOptions[e.detail.value].value })
  },

  onEducationChange(e) {
    this.setData({ educationIndex: e.detail.value, 'form.education': this.data.educationOptions[e.detail.value].value })
  },

  toggleTag(e) {
    const name = e.currentTarget.dataset.t
    const allTags = this.data.allTags.map(item =>
      item.name === name ? { name: item.name, selected: !item.selected } : item
    )
    const expertise = allTags.filter(item => item.selected).map(item => item.name)
    this.setData({ allTags, 'form.expertise': expertise })
  },

  chooseEducation() {
    const that = this
    wx.chooseMedia({
      count: 3 - this.data.form.educationImages.length, mediaType: ['image'],
      success(res) {
        const paths = res.tempFiles.map(f => f.tempFilePath)
        that.setData({ 'form.educationImages': that.data.form.educationImages.concat(paths) })
      }
    })
  },

  chooseCounselor() {
    const that = this
    wx.chooseMedia({
      count: 5 - this.data.form.counselorImages.length, mediaType: ['image'],
      success(res) {
        const paths = res.tempFiles.map(f => f.tempFilePath)
        that.setData({ 'form.counselorImages': that.data.form.counselorImages.concat(paths) })
      }
    })
  },

  validate() {
    const f = this.data.form
    if (!f.realName.trim()) return '请填写真实姓名'
    if (!f.age) return '请填写年龄'
    if (!f.city.trim()) return '请填写城市'
    if (!f.major.trim()) return '请填写专业背景'
    if (!/^1\d{10}$/.test(f.phone)) return '请填写正确的手机号'
    if (!f.idCard.trim()) return '请填写身份证号'
    if (!f.yearsOfExp) return '请填写从业年限'
    if (!f.consultHours) return '请填写咨询时长'
    if (f.expertise.length === 0) return '请至少选择一个擅长领域'
    if (f.educationImages.length === 0) return '请至少上传一张学历证书'
    if (f.counselorImages.length === 0) return '请至少上传一张咨询师证书'
    if (!f.certificateNo.trim()) return '请填写证书编号'
    if (!f.intro.trim()) return '请填写个人简介'
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
