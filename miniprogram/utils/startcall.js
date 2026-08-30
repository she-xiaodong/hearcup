// utils/startcall.js —— 统一的呼叫发起流程（首页与详情页共用）
//
// 一次呼叫要跨「业务」与「通话」两个系统，顺序不能颠倒：
//   1) 业务侧建单：后端创建通话记录、冻结起步余额、签发 IM 凭据
//   2) 通话侧呼叫：把房间号与凭据交给 TUICallKit，由它负责信令与音视频
//   3) 失败兜底：任何一步失败都要把冻结的余额解冻，不能让用户平白被扣
//
// 通话开始后的状态流转（接通 / 拒接 / 超时 / 结束）由 app.js 的状态回调接管。

const api = require('./api.js')
const store = require('./store.js')
const callkit = require('./callkit.js')

/**
 * @param {number} providerId 倾听者 ID
 * @param {number} callType 1=语音 2=视频
 * @returns {Promise<{ok:boolean, msg?:string, needRecharge?:boolean}>}
 */
async function startCall(providerId, callType) {
  const app = getApp()
  const cfg = store.getConfig()

  // ① 余额前置校验（与后端冻结金额保持一致，避免无谓请求）
  if (store.getBalance() < cfg.minBalance) {
    wx.showModal({
      title: '余额不足',
      content: `发起呼叫需至少 ${app.toCoins(cfg.minBalance)} H币，是否去充值？`,
      confirmText: '去充值',
      success: (r) => { if (r.confirm) wx.navigateTo({ url: '/pages/recharge/recharge' }) }
    })
    return { ok: false, needRecharge: true }
  }

  // ② 通话组件必须已初始化（登录后由 app.js 完成），否则收不到来电也无法呼叫
  if (!callkit.isInited()) {
    wx.showToast({ title: '通话组件尚未就绪，请稍候重试', icon: 'none' })
    return { ok: false, msg: '通话组件未就绪' }
  }

  wx.showLoading({ title: '正在呼叫…', mask: true })
  let inv
  try {
    inv = await api.invite(providerId, callType)
  } catch (err) {
    wx.hideLoading()
    wx.showToast({ title: '网络异常，呼叫失败', icon: 'none' })
    return { ok: false, msg: '网络异常' }
  }
  wx.hideLoading()

  if (!inv || inv.code !== 0 || !inv.data) {
    wx.showToast({ title: (inv && inv.msg) || '呼叫失败', icon: 'none' })
    return { ok: false, msg: (inv && inv.msg) || '呼叫失败' }
  }

  const d = inv.data
  const me = (app.globalData.userInfo || {}).nickname || '用户'

  // ③ 发起音视频呼叫；成功后 CallManager 会自动跳转到通话页
  try {
    await callkit.calls({
      calleeUserID: d.callee_im_user_id,
      callType: d.call_type,
      roomID: d.trtc_room_id,
      timeout: d.timeout || 60,
      // 被叫不在前台时，由腾讯云经 IM 通道下发离线提醒（微信服务通知）
      pushTitle: `${me} 邀请你通话`,
      pushDesc: callType === 2 ? '点击接听视频通话' : '点击接听语音通话',
      roomIDBiz: d.room_id,
      callID: d.call_id,
    })
    return { ok: true }
  } catch (err) {
    // 呼叫未发出：立刻解冻，避免余额被无谓占用
    await api.reportCallResult('cancel', d.room_id, d.call_id).catch(() => {})
    wx.showToast({ title: '呼叫失败，请重试', icon: 'none' })
    return { ok: false, msg: '呼叫失败' }
  }
}

module.exports = { startCall }
