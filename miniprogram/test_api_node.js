// 用 node 给小程序全局打桩，验证 utils/api.js 能真实打通后端
// 运行：node miniprogram/test_api_node.js  （需后端在 8099 运行）
const http = require('http')
const { URL } = require('url')

global.getApp = () => ({ globalData: { config: { useMock: false, baseUrl: 'http://localhost:8099' } } })
const mem = new Map()
global.wx = {
  request(opt) {
    const u = new URL(opt.url)
    const body = opt.data ? JSON.stringify(opt.data) : null
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opt.header || {})
    const req = http.request({
      hostname: u.hostname, port: u.port, path: u.pathname + u.search,
      method: opt.method, headers, agent: false
    }, (res) => {
      let b = ''; res.on('data', c => b += c); res.on('end', () => {
        let p; try { p = JSON.parse(b) } catch (e) { p = b }
        opt.success({ statusCode: res.statusCode, data: p })
      })
    })
    req.on('error', e => opt.fail && opt.fail({ errMsg: e.message }))
    if (body) req.write(body)
    req.end()
  },
  getStorageSync: k => mem.get(k) || '',
  setStorageSync: (k, v) => mem.set(k, v),
  getWindowInfo: () => ({ statusBarHeight: 20 }),
  showToast: () => {}, showModal: () => {}
}

const api = require('./utils/api.js')

;(async () => {
  const log = (n, c) => console.log((c ? '✅' : '❌') + ' ' + n)
  let okAll = true
  const step = (n, c) => { if (!c) okAll = false; log(n, c) }

  // 每次用唯一用户，避免 MySQL 持久化导致的状态累积（已有入驻申请 / 余额残留）
  const login = await api.login('openid_mp_' + Date.now())
  step('小程序 api.login', login.code === 0 && !!(login.data && login.data.token))

  // 先充值，保证后续发起呼叫时余额充足（mock 用户走演示入账，不触真实支付）
  const rech = await api.createRecharge(50)
  step('createRecharge', rech.code === 0)

  const bal = await api.getBalance()
  step('getBalance', bal.code === 0 && typeof bal.data.balance === 'number' && bal.data.balance >= 50)

  const prov = await api.getOnlineProviders(0)
  step('getOnlineProviders 返回映射后的列表', prov.code === 0 && Array.isArray(prov.data.list) && prov.data.list.length >= 1)
  console.log('   服务者:', prov.data.list.map(p => `${p.nickName}(${'倾听者'})¥${p.price_per_minute}`).join(' | '))

  const p0 = prov.data.list[0]
  const inv = await api.invite(p0.id, 1)
  step('call/invite 返回 room_id', inv.code === 0 && !!inv.data.room_id)

  const end = await api.endCall(inv.data.room_id)
  step('call/end 返回计费', end.code === 0 && 'amount' in end.data)

  const rec = await api.getCallRecords()
  step('getCallRecords 返回数组', rec.code === 0 && Array.isArray(rec.data))

  const app = await api.applyProvider({
    role: 1, nickName: '小程序测试员', phone: '13900000999', idCard: '110xxx',
    intro: '这是一段足够长的个人简介，用于验证小程序端入驻提交。',
    expertise: ['恋爱', '情绪压力'], certImages: ['cert1.jpg'],
    bankAccountName: '测试员', bankCardNo: '6222021234567890', bankName: '招商银行', bankBranch: '北京中关村支行'
  })
  step('applyProvider（倾听者）', app.code === 0)

  console.log('\n小程序 api 层对接后端：' + (okAll ? '全部通过 ✅' : '存在失败 ❌'))
})()
