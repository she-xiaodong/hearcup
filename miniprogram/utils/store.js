// utils/store.js —— 轻量全局状态（演示用；真实环境读写后端 + 本地缓存）
const app = getApp()

function getUser() { return app.globalData.userInfo }
function getBalance() { return app.globalData.userInfo.balance }
function setBalance(v) { app.globalData.userInfo.balance = v }
function getConfig() { return app.globalData.config }
function getProviders() { return app.globalData.providers }

// —— 服务者入驻申请状态 ——
// status: 0 待审核 / 1 通过 / 2 拒绝
function getApply() {
  if (app.globalData.apply) return app.globalData.apply
  const cached = wx.getStorageSync('hearcup_apply') || null
  app.globalData.apply = cached
  return cached
}
function setApply(a) {
  app.globalData.apply = a
  wx.setStorageSync('hearcup_apply', a)
}

// —— 服务者中心视图（演示数据）——
function getProviderMe() {
  if (!app.globalData.providerMe) {
    const online = wx.getStorageSync('hearcup_online')
    app.globalData.providerMe = {
      isOnline: typeof online === 'boolean' ? online : true,
      todayCalls: 3,
      dailyLimit: 20,
      todayIncome: 36.0,
      totalIncome: 268.5,
      withdrawable: 180.0
    }
  }
  return app.globalData.providerMe
}
function setProviderOnline(v) {
  getProviderMe().isOnline = v
  wx.setStorageSync('hearcup_online', v)
}

module.exports = {
  getUser, getBalance, setBalance, getConfig, getProviders,
  getApply, setApply, getProviderMe, setProviderOnline
}
