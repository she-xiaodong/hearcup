// utils/api.js —— 小程序与后端的统一接口层
// useMock=true（默认）：走本地演示数据，离线可用
// useMock=false：请求真实后端（baseUrl 见 app.js globalData.config）
// 后端接口严格对齐《需求文档》第五部分；字段映射在此完成。
const mock = require('./mock.js')
const store = require('./store.js')

// 擅长领域标签库（与后端 seed 标签表、mock.js tags 一致）
const TAGS = ['恋爱', '婚姻', '家庭', '职场', '校园', '亲子', '情绪压力', '自我成长', '人际关系']
const ROLE_TEXT = { 1: '倾听者', 2: '倾听者' } // 统一「倾听者」
const LEVEL_TEXT = { 1: '实习', 2: '认证', 3: '资深' }

function cfg() { try { return (getApp() && getApp().globalData.config) || {} } catch (e) { return {} } }
function getToken() { try { return wx.getStorageSync('hearcup_token') || '' } catch (e) { return '' } }
function setToken(t) { try { wx.setStorageSync('hearcup_token', t) } catch (e) {} }
function useMock() { return cfg().useMock === true }
function base() { return cfg().baseUrl || '' }

// 后端 providers 表 → 小程序卡片/详情所需形状
function mapProvider(p) {
  if (!p) return p
  // expertise 现为逗号分隔的文字标签，直接拆分展示
  const expertise = (p.expertise || '').split(',').map(s => s.trim()).filter(Boolean)
  return {
    id: p.id,
    nickName: p.nickname || p.real_name || ('用户' + p.id),
    role: 1,
    avatarColor: '#008C8C',
    levelText: (LEVEL_TEXT[p.level] || '') + '倾听者',
    rating: p.rating || 0,
    total_sessions: p.total_sessions || 0,
    price_per_minute: p.price_per_minute || 1,
    is_online: p.is_online === 1,
    intro: p.intro || '',
    expertise: expertise.length ? expertise : (p.expertise || []),
    years_of_exp: p.years_of_exp || 0,
    background: p.background || '',
    certificate_no: p.certificate_no || ''
  }
}
function mapMock(p) { return p }
function mapRecord(r) {
  // 后端 call_records → 前端展示
  const dur = r.duration || 0
  const m = Math.floor(dur / 60), s = dur % 60
  const d = new Date((r.created_at || Date.now() / 1000) * 1000)
  const p2 = n => String(n).padStart(2, '0')
  return {
    id: r.id,
    providerName: r.provider_name || '',
    callType: r.call_type || 1,
    durationText: `${m}分${p2(s)}秒`,
    amount: r.amount || 0,
    time: `${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`,
    rating: r.user_rating || 0
  }
}

async function request(method, path, data, auth) {
  if (useMock()) return { code: 0, data: null, _mock: true }
  return new Promise((resolve) => {
    wx.request({
      url: base() + path,
      method: method,
      data: data || {},
      header: Object.assign({ 'Content-Type': 'application/json' },
        auth !== false ? { 'Authorization': 'Bearer ' + getToken() } : {}),
      success(res) {
        let body = res.data
        if (typeof body === 'string') { try { body = JSON.parse(body) } catch (e) { body = { code: 1, msg: 'bad json' } } }
        resolve(body || { code: 0, data: null })
      },
      fail(err) { resolve({ code: 1, msg: (err && err.errMsg) || 'network error' }) }
    })
  })
}

const api = {
  // ===== 认证 =====
  async login(code) {
    const r = await request('POST', '/api/v1/auth/login', { code })
    if (r._mock) { const u = store.getUser(); setToken('mock_token'); return { code: 0, data: { token: 'mock_token', user: u } } }
    if (r.code === 0) { setToken(r.data.token); return r }
    return r
  },
  async getBalance() {
    const r = await request('GET', '/api/v1/user/balance')
    if (r._mock) return { code: 0, data: { balance: store.getBalance() } }
    return r
  },

  // ===== 服务者（用户端）=====
  async getOnlineProviders(role) {
    const r = await request('GET', '/api/v1/providers/online' + (role ? ('?role=' + role) : ''))
    if (r._mock) {
      const list = mock.providers.filter(p => p.is_online && (!role || p.role === role)).map(mapMock)
      return { code: 0, data: { list } }
    }
    if (r.code === 0) return { code: 0, data: { list: (r.data.list || []).map(mapProvider) } }
    return r
  },
  async getProvider(id) {
    const r = await request('GET', '/api/v1/providers/' + id)
    if (r._mock) {
      const p = mock.providers.find(x => x.id === Number(id))
      return { code: 0, data: { provider: mapMock(p), ratings: [] } }
    }
    if (r.code === 0) return { code: 0, data: { provider: mapProvider(r.data.provider), ratings: r.data.ratings || [] } }
    return r
  },

  // ===== 呼叫（核心）=====
  async invite(pid, type) {
    const r = await request('POST', '/api/v1/call/invite', { provider_id: pid, call_type: type })
    if (r._mock) return { code: 0, data: { room_id: 'mock_room_' + Date.now(), user_sig: 'sig', provider_sig: 'sig', sdk_app_id: 0 } }
    return r
  },
  async endCall(roomId) {
    const r = await request('POST', '/api/v1/call/end', { room_id: roomId })
    if (r._mock) return { code: 0, data: { amount: 0 } }
    return r
  },
  async rate(roomId, rating, comment) {
    const r = await request('POST', '/api/v1/call/rating', { room_id: roomId, rating, comment })
    if (r._mock) return { code: 0, data: { ok: true } }
    return r
  },
  async getCallRecords(uid) {
    const r = await request('GET', '/api/v1/call/records' + (uid ? ('?user_id=' + uid) : ''))
    if (r._mock) return { code: 0, data: mock.callRecords.map(mapRecord) }
    if (r.code === 0) return { code: 0, data: (r.data || []).map(mapRecord) }
    return r
  },

  // ===== 充值 =====
  async createRecharge(amount) {
    const r = await request('POST', '/api/v1/recharge/create', { amount })
    if (r._mock) { store.setBalance(store.getBalance() + Number(amount)); return { code: 0, data: { amount } } }
    return r
  },
  async getRechargeRecords(uid) {
    const r = await request('GET', '/api/v1/recharge/records' + (uid ? ('?user_id=' + uid) : ''))
    if (r._mock) return { code: 0, data: [] }
    return r
  },

  // ===== 服务者（服务者端）=====
  async getProviderStatus() {
    const r = await request('GET', '/api/v1/provider/status')
    if (r._mock) {
      const a = store.getApply()
      if (!a) return { code: 0, data: { status: -1 } }
      return { code: 0, data: Object.assign({ role: a.role }, a) }
    }
    return r
  },
  async applyProvider(form) {
    const body = {
      real_name: form.nickName,
      phone: form.phone,
      id_card: form.idCard,
      intro: form.intro,
      expertise: (form.expertise || []).join(','),
      certificates: (form.certImages || []).join(','),
      certificate_no: form.certNo,
      certificate_image: form.certImage,
      years_of_exp: Number(form.years) || 0,
      background: form.background,
      bank_account_name: form.bankAccountName,
      bank_card_no: form.bankCardNo,
      bank_name: form.bankName,
      bank_branch: form.bankBranch
    }
    const r = await request('POST', '/api/v1/provider/apply', body)
    if (r._mock) {
      const apply = { role: 1, status: 0, submittedAt: Date.now(), form }
      store.setApply(apply)
      return { code: 0, data: { id: 0, status: 0 } }
    }
    return r
  },
  async setOnline() {
    const r = await request('PUT', '/api/v1/provider/online')
    if (r._mock) { store.setProviderOnline(true); return { code: 0, data: { is_online: 1 } } }
    return r
  },
  async setOffline() {
    const r = await request('PUT', '/api/v1/provider/offline')
    if (r._mock) { store.setProviderOnline(false); return { code: 0, data: { is_online: 0 } } }
    return r
  },
  async getEarnings() {
    const r = await request('GET', '/api/v1/provider/earnings')
    if (r._mock) return { code: 0, data: store.getProviderMe() }
    return r
  },
  async withdraw(amount) {
    const r = await request('POST', '/api/v1/provider/withdraw', { amount })
    if (r._mock) return { code: 0, data: { id: 0, status: 0 } }
    return r
  },

  // ===== 用户资料 / 反馈 =====
  async updateProfile(nickname, avatar) {
    const r = await request('POST', '/api/v1/user/profile', { nickname, avatar })
    if (r._mock) {
      const u = store.getUser()
      if (nickname) u.nickName = nickname
      if (avatar) u.avatar = avatar
      return { code: 0, data: u }
    }
    return r
  },
  async submitFeedback(content, contact) {
    const r = await request('POST', '/api/v1/feedback', { content, contact })
    if (r._mock) return { code: 0, data: { id: 0, msg: '已收到' } }
    return r
  }
}

module.exports = api
