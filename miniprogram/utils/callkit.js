// utils/callkit.js —— TUICallKit 封装层
//
// 职责：把腾讯云 TUICallKit 的能力包装成 HearCup 业务可直接调用的接口，
//      并把「通话状态变化」翻译成「业务计费事件」，驱动后端结算。
//
// 分工边界（重要，改动前请先理解）：
//   - TUICallKit 负责：信令、音视频、来电 UI、铃声、悬浮窗、离线推送。它直连腾讯云，不经过我们的 Go 后端。
//   - 本文件负责：初始化、发起呼叫、状态监听 → 通知后端「接通/拒接/取消/超时」，后端据此冻结/扣费/解冻。
//
// 两端通过 room_id 关联：房间号由后端生成并下发，通话记录与计费都以它为主键。

// 全局来电唤醒页：来电时 CallManager 会自动 navigateTo 到此页，
// 因此倾听者无论停在小程序的哪个页面，都能收到来电。
const GLOBAL_CALL_PATH = 'TUICallKit/pages/globalCall/globalCall'

// 通话状态枚举（与 TUICallKit 内部 CallStatus 保持一致）
const STATUS = { IDLE: 'idle', CALLING: 'calling', CONNECTED: 'connected' }

let _inited = false
let _mgr = null          // CallManager 实例（负责全局来电跳转）
let _im = null           // 当前用户的 IM 凭据
let _session = null      // 当前通话会话上下文
let _statusHooks = []    // 业务侧状态回调

// 懒加载 SDK：避免在未配置 IM 时因模块加载失败导致整个小程序崩溃
function pkg() {
  return require('/TUICallKit/index')
}

function getMgr() {
  if (!_mgr) {
    // CallManager 未被 SDK 自动引用，需业务显式实例化；
    // 它监听通话状态并在来电时自动跳转到全局通话页。
    const { CallManager } = require('/TUICallKit/TUICallService/serve/callManager')
    _mgr = new CallManager()
  }
  return _mgr
}

/**
 * 初始化通话组件（登录后调用一次，重复调用安全）
 * @param {{sdk_app_id:number, user_id:string, user_sig:string, nickname?:string, avatar?:string}} im
 * @param {{nickname?:string, avatar?:string}} [selfInfo] 可选，覆盖来电界面显示的昵称/头像
 */
async function init(im, selfInfo) {
  if (!im || !im.sdk_app_id || !im.user_id || !im.user_sig) {
    console.warn('[callkit] IM 凭据缺失，跳过初始化')
    return false
  }
  _im = im
  if (_inited) {
    // 凭据可能已刷新（UserSig 有有效期），此处仅更新自身资料
    try {
      await pkg().TUICallKitAPI.setSelfInfo({
        nickName: (selfInfo && selfInfo.nickname) || im.nickname || '',
        avatar: (selfInfo && selfInfo.avatar) || im.avatar || '',
      })
    } catch (e) {}
    return true
  }
  try {
    await getMgr().init({
      sdkAppID: Number(im.sdk_app_id),
      userID: String(im.user_id),
      userSig: im.user_sig,
      globalCallPagePath: GLOBAL_CALL_PATH,
    })
    try {
      await pkg().TUICallKitAPI.setSelfInfo({
        nickName: (selfInfo && selfInfo.nickname) || im.nickname || '',
        avatar: (selfInfo && selfInfo.avatar) || im.avatar || '',
      })
    } catch (e) {}
    _inited = true
    _watchStatus()
    console.log('[callkit] init ready')
    return true
  } catch (e) {
    console.error('[callkit] init fail', e)
    return false
  }
}

/**
 * 发起通话
 * @param {Object} opts
 * @param {string} opts.calleeUserID 被叫的 IM userID（后端下发）
 * @param {number} opts.callType 1=语音 2=视频
 * @param {number} opts.roomID  后端生成的数字房间号（TUICallKit 要求 1~2147483647）
 * @param {number} [opts.timeout] 呼叫超时秒数，默认 60
 * @param {string} [opts.pushTitle] 离线推送标题
 * @param {string} [opts.pushDesc]  离线推送内容
 * @param {string} [opts.roomIDBiz] 业务房间号（字符串），用于计费上报
 * @param {number} [opts.callID]    业务通话记录 ID，用于计费上报
 */
async function calls(opts) {
  if (!_inited) throw new Error('通话组件未初始化')
  _session = {
    roomIDBiz: opts.roomIDBiz || '',
    callID: opts.callID || 0,
    callType: opts.callType || 1,
    calleeUserID: opts.calleeUserID,
    startedAt: Date.now(),
    connected: false,    // 是否曾经接通（区分「正常结束」与「未接通」）
    ended: false,
    role: 'caller',      // 本端是主叫
    userHangup: false,   // 是否被本端主动挂断（区分「主叫取消」与「被叫拒接/超时」）
  }
  const payload = {
    userIDList: [String(opts.calleeUserID)],
    type: Number(opts.callType) || 1,
    timeout: Number(opts.timeout) || 60,
  }
  if (opts.roomID) payload.roomID = Number(opts.roomID)
  // 离线推送：被叫小程序不在前台时，由腾讯云经 IM 通道下发提醒
  if (opts.pushTitle || opts.pushDesc) {
    payload.offlinePushInfo = {
      title: opts.pushTitle || 'HearCup 来电',
      description: opts.pushDesc || '有人正在呼叫你，点击接听',
    }
  }
  return pkg().TUICallKitAPI.calls(payload)
}

/**
 * 本端主动挂断 / 取消呼叫。
 * 会先打标记再执行挂断，使状态回调能区分「主叫主动取消」与「被叫拒接/超时未接」——
 * 前者静默解冻余额即可，后者需要给倾听者补发未接通知。
 */
async function hangup() {
  if (_session) _session.userHangup = true
  if (!_inited) return
  try {
    const engine = pkg().TUICallKitAPI.getTUICallEngineInstance()
    if (engine && engine.hangup) await engine.hangup()
  } catch (e) {
    console.warn('[callkit] hangup fail', e)
  }
}

/** 开启/关闭悬浮窗（通话中最小化，仅业务页面内嵌组件时生效） */
async function enableFloatWindow(enable) {
  if (!_inited) return
  try { await pkg().TUICallKitAPI.enableFloatWindow(!!enable) } catch (e) {}
}

/** 注册状态回调，回调签名为 ({status, session}) */
function onStatus(cb) {
  if (typeof cb === 'function') _statusHooks.push(cb)
}

function _emit(status) {
  const snap = Object.assign({}, _session || {}, { status })
  _statusHooks.forEach(fn => {
    try { fn(snap) } catch (e) { console.error('[callkit] hook error', e) }
  })
}

// 监听通话状态：驱动业务计费（接通/结束/未接通）
function _watchStatus() {
  const { TUIStore, StoreName, NAME } = pkg()
  TUIStore.watch(StoreName.CALL, {
    [NAME.CALL_STATUS]: (val) => {
      if (val === STATUS.CONNECTED) {
        // 仅主叫侧持有会话上下文；被叫侧不参与计费上报（计费以主叫为准）
        if (!_session) return
        _session.connected = true
        _emit('connected')
      } else if (val === STATUS.IDLE) {
        if (!_session || _session.ended) return
        _session.ended = true
        // 从未接通即结束 → 拒接/取消/超时未接，需要后端解冻主叫余额
        _emit(_session.connected ? 'ended' : 'unconnected')
      }
    },
  }, { notifyRangeWhenWatch: NAME.MYSELF })
}

/** 当前会话快照（供页面在 onShow 时补齐状态） */
function currentSession() {
  return _session ? Object.assign({}, _session) : null
}

function isInited() {
  return _inited
}

function clearSession() {
  _session = null
}

module.exports = {
  STATUS, GLOBAL_CALL_PATH,
  init, calls, hangup, enableFloatWindow,
  onStatus, currentSession, isInited, clearSession,
}
