// utils/store.js —— 轻量全局状态（演示用；真实环境读写后端 + 本地缓存）
// 注意：不能在模块顶层调用 getApp()（App 实例尚未创建会返回 undefined），
// 统一在函数内调用 getApp() 获取全局数据。

function getUser() { return getApp().globalData.userInfo }
function getBalance() { return getApp().globalData.userInfo.balance }
function setBalance(v) { getApp().globalData.userInfo.balance = v }
function getConfig() { return getApp().globalData.config }
function getProviders() { return getApp().globalData.providers }

// —— 服务者入驻申请状态 ——
// status: 0 待审核 / 1 通过 / 2 拒绝
function getApply() {
  const g = getApp().globalData
  if (g.apply) return g.apply
  const cached = wx.getStorageSync('hearcup_apply') || null
  g.apply = cached
  return cached
}
function setApply(a) {
  getApp().globalData.apply = a
  wx.setStorageSync('hearcup_apply', a)
}

// —— 服务者中心视图（演示数据）——
function getProviderMe() {
  const g = getApp().globalData
  if (!g.providerMe) {
    const online = wx.getStorageSync('hearcup_online')
    g.providerMe = {
      isOnline: typeof online === 'boolean' ? online : true,
      todayCalls: 3,
      dailyLimit: 20,
      todayIncome: 36.0,
      totalIncome: 268.5,
      withdrawable: 180.0
    }
  }
  return g.providerMe
}
function setProviderOnline(v) {
  getProviderMe().isOnline = v
  wx.setStorageSync('hearcup_online', v)
}

module.exports = {
  getUser, getBalance, setBalance, getConfig, getProviders,
  getApply, setApply, getProviderMe, setProviderOnline
}
