// pages/provider-edit/index —— 倾听者「资料与价格设置」
// 修改：头像/昵称（即时保存，同步用户资料）＋ 简介/城市/年龄/学历/专业/从业年限/咨询时长/背景/擅长领域
// ＋ 各时长档位价格(元，展示层×10=H币)
const api = require('../../../utils/api.js')
const store = require('../../../utils/store.js')

// 与 api.js TAGS / 后端 seed 保持一致
const TAG_NAMES = ['恋爱', '婚姻', '家庭', '职场', '校园', '亲子', '情绪压力', '自我成长', '人际关系']
const MINUTES = [15, 30, 45, 60, 75, 90, 105, 120]

Page({
  data: {
    loading: true,
    saving: false,
    user: {},
    tags: TAG_NAMES.map(n => ({ name: n, on: false })),
    expertiseNames: [],
    form: {
      intro: '', city: '', age: '', education: '', major: '',
      years_of_exp: '', consult_hours: '', background: ''
    },
    tiers: [],      // [{ minutes, yuan, coins }]
    ok: false
  },

  onLoad() {
    this.setData({ tiers: MINUTES.map(m => ({ minutes: m, yuan: '', coins: '' })) })
    this.load()
  },

  applyExpertise(names) {
    const set = {}
    names.forEach(n => { set[n] = true })
    this.setData({
      expertiseNames: names,
      tags: TAG_NAMES.map(n => ({ name: n, on: !!set[n] }))
    })
  },

  async load() {
    try {
      const r = await api.getProviderStatus()
      const p = (r && r.code === 0 && r.data) || {}
      if (typeof p.status === 'number' && p.status !== 1) {
        wx.showToast({ title: '需先通过入驻审核', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 1200)
        return
      }
      // 现有档位回显（元）
      const tierMap = {}
      try {
        const raw = (typeof p.price_tiers === 'string' && p.price_tiers) ? JSON.parse(p.price_tiers) : (p.price_tiers || {})
        Object.keys(raw || {}).forEach(k => { tierMap[k] = Number(raw[k]) })
      } catch (e) {}
      let hasAny = false
      const tiers = MINUTES.map(m => {
        const v = tierMap[m]
        if (v) hasAny = true
        const yuan = v ? String(v) : ''
        return { minutes: m, yuan, coins: v ? String(Math.round(v * 10)) : '' }
      })
      // 无档位配置时按单价×分钟预填，省得手填
      if (!hasAny && Number(p.price_per_minute) > 0) {
        tiers.forEach(t => {
          const y = Math.round(Number(p.price_per_minute) * t.minutes * 100) / 100
          t.yuan = String(y)
          t.coins = String(Math.round(y * 10))
        })
      }
      const expertise = String(p.expertise || '')
        .split(',')
        .map(x => x.trim())
        .filter(Boolean)
      // 头像/昵称来自当前登录用户（服务者展示即用户头像昵称）
      const u = store.getUser() || {}
      this.setData({
        user: { avatar: u.avatar || '', nickName: u.nickName || u.nickname || '' },
        'form.intro': p.intro || '',
        'form.city': p.city || '',
        'form.age': p.age ? String(p.age) : '',
        'form.education': p.education || '',
        'form.major': p.major || '',
        'form.years_of_exp': p.years_of_exp ? String(p.years_of_exp) : '',
        'form.consult_hours': p.consult_hours ? String(p.consult_hours) : '',
        'form.background': p.background || '',
        tiers,
        ok: true
      })
      this.applyExpertise(expertise)
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  onInput(e) {
    const f = e.currentTarget.dataset.f
    this.setData({ ['form.' + f]: e.detail.value })
  },

  // ===== 头像 / 昵称（即时保存，同「我的」页逻辑）=====
  readAsBase64(filePath) {
    return new Promise((resolve) => {
      wx.getFileSystemManager().readFile({
        filePath, encoding: 'base64',
        success: (res) => resolve('data:image/jpeg;base64,' + res.data),
        fail: () => resolve('')
      })
    })
  },
  async onChooseAvatar(e) {
    const url = e.detail.avatarUrl
    if (!url) return
    const dataUri = await this.readAsBase64(url)
    if (!dataUri) return
    this.setData({ 'user.avatar': dataUri })
    wx.showLoading({ title: '保存中…', mask: true })
    const r = await api.updateProfile('', dataUri)
    wx.hideLoading()
    if (r && r.code === 0) {
      if (r.data) getApp().globalData.userInfo = Object.assign({}, getApp().globalData.userInfo, r.data)
      wx.showToast({ title: '头像已更新', icon: 'none' })
    } else {
      this.setData({ 'user.avatar': store.getUser().avatar || '' })
      wx.showToast({ title: (r && r.msg) || '头像保存失败', icon: 'none' })
    }
  },
  async onNicknameBlur(e) {
    if (this._nickSaving) return
    const name = (e.detail.value || '').trim()
    if (!name || name === this.data.user.nickName) return
    this._nickSaving = true
    try {
      this.setData({ 'user.nickName': name })
      getApp().globalData.userInfo.nickName = name
      const r = await api.updateProfile(name, '')
      if (r && r.code === 0 && r.data) {
        getApp().globalData.userInfo = Object.assign({}, getApp().globalData.userInfo, r.data)
        wx.showToast({ title: '昵称已保存', icon: 'none' })
      } else {
        wx.showToast({ title: (r && r.msg) || '昵称保存失败', icon: 'none' })
      }
    } finally {
      this._nickSaving = false
    }
  },

  onTierInput(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    const yuan = e.detail.value
    const y = parseFloat(yuan)
    const coins = (!isNaN(y) && y > 0) ? String(Math.round(y * 10)) : ''
    this.setData({
      [`tiers[${idx}].yuan`]: yuan,
      [`tiers[${idx}].coins`]: coins
    })
  },
  toggleTag(e) {
    const name = e.currentTarget.dataset.tag
    const cur = this.data.expertiseNames.slice()
    const i = cur.indexOf(name)
    if (i >= 0) cur.splice(i, 1)
    else cur.push(name)
    this.applyExpertise(cur)
  },

  async onSave() {
    if (this.data.saving) return
    const f = this.data.form
    // 至少保留一档价格
    const price_tiers = {}
    this.data.tiers.forEach(t => {
      const v = parseFloat(t.yuan)
      if (!isNaN(v) && v > 0) price_tiers[t.minutes] = v
    })
    if (Object.keys(price_tiers).length === 0) {
      wx.showToast({ title: '至少填一个档位价格', icon: 'none' })
      return
    }
    const age = parseInt(f.age, 10)
    if (f.age && (!age || age < 18)) {
      wx.showToast({ title: '年龄需≥18岁', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    const payload = {
      intro: f.intro.trim(),
      city: f.city.trim(),
      education: f.education.trim(),
      major: f.major.trim(),
      background: f.background.trim(),
      expertise: this.data.expertiseNames.join(','),
      price_tiers
    }
    if (age) payload.age = age
    if (f.years_of_exp !== '') payload.years_of_exp = parseInt(f.years_of_exp, 10) || 0
    if (f.consult_hours !== '') payload.consult_hours = parseInt(f.consult_hours, 10) || 0
    try {
      const r = await api.updateProviderProfile(payload)
      if (r.code !== 0) throw new Error(r.msg || '保存失败')
      wx.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 800)
    } catch (err) {
      wx.showToast({ title: err.message || '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  }
})
