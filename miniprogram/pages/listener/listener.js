// pages/listener/listener —— 倾听者工作台
//
// 倾听者侧的核心页面：查看入驻状态、开关接单、查看收益，以及完成保活设置。
//
// 为什么要有「保活」：小程序被微信回收后就收不到来电，只能靠离线通知触达。
// 本页提供三种保活手段（效果由强到弱）：
//   1) iOS「显示在聊天顶部」/ Android 多任务锁定 —— 用户手动设置，效果最好
//   2) 静音后台音频 —— 降低被系统回收的概率，属辅助手段
//   3) 离线通知兜底 —— 已被回收时的最后一道防线（需腾讯云 IM 推送配置）

const api = require('../../utils/api.js')
const store = require('../../utils/store.js')

// 静音音频：1 秒无声循环，用户完全无感知，用于降低小程序被系统回收的概率
const SILENCE_SRC = '/static/silence.wav'

// 订阅消息模板 ID（「通话邀请通知」）：小程序被回收时的离线触达兜底。
// 需在微信公众平台申请模板后填入，与后端 HEARCUP_SUBSCRIBE_TPL_ID 保持一致。
// 为空时跳过授权请求（不影响上线）。
const SUBSCRIBE_TMPL_ID = ''

let audioCtx = null

Page({
  data: {
    loading: true,
    // 入驻状态：-1 未申请 / 0 待审核 / 1 已通过 / 2 已拒绝
    applyStatus: -1,
    isOnline: false,
    earnings: { today_income: 0, withdrawable: 0, total_earnings: 0, today_calls: 0 },
    platform: '',        // android / ios / devtools
    sysVersion: '',
    lowAndroid: false,   // Android 10 以下：系统层面不支持锁屏来电弹窗
    keepAlive: false,    // 静音音频保活开关
  },

  onLoad() {
    this.detectPlatform()
    try {
      this.setData({ keepAlive: wx.getStorageSync('hearcup_keepalive') === '1' })
    } catch (e) {}
  },

  async onShow() {
    await this.refresh()
    // 回到前台时，若用户此前开启了音频保活则确保仍在播放（切后台可能被系统暂停）
    if (this.data.keepAlive && this.data.applyStatus === 1) this.startAudio()
  },

  onHide() {
    // 注意：不在这里停止音频。保活的目的正是让小程序在后台也尽量存活。
  },

  onUnload() {
    this.stopAudio()
  },

  // 识别系统，给出对应的保活引导与低版本提示
  detectPlatform() {
    let info = {}
    try { info = wx.getSystemInfoSync() || {} } catch (e) {}
    const platform = String(info.platform || '').toLowerCase()
    const sysVersion = String(info.system || '')
    let lowAndroid = false
    if (platform === 'android') {
      const m = sysVersion.match(/(\d+)/)
      // Android 10 以下不支持锁屏状态下的来电弹窗，需提前告知用户，避免预期落差
      if (m && Number(m[1]) < 10) lowAndroid = true
    }
    this.setData({ platform, sysVersion, lowAndroid })
  },

  async refresh() {
    this.setData({ loading: true })
    try {
      const r = await api.getProviderStatus()
      const d = (r && r.data) || {}
      const st = typeof d.status === 'number' ? d.status : -1
      this.setData({ applyStatus: st, isOnline: d.is_online === 1 })
      if (st === 1) {
        const er = await api.getProviderEarnings()
        if (er && er.code === 0 && er.data) this.setData({ earnings: er.data })
      }
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 上/下线：决定是否接收来电。只有审核通过才能上线接单。
  async toggleOnline(e) {
    const on = e.detail.value
    if (this.data.applyStatus !== 1) {
      wx.showToast({ title: '需先通过入驻审核', icon: 'none' })
      this.setData({ isOnline: false })
      return
    }
    wx.showLoading({ title: on ? '上线中…' : '下线中…', mask: true })
    const r = on ? await api.setProviderOnline() : await api.setProviderOffline()
    wx.hideLoading()
    if (r && r.code === 0) {
      this.setData({ isOnline: on })
      wx.showToast({ title: on ? '已上线，可接听来电' : '已下线', icon: 'none' })
      // 上线即开启音频保活；下线时停止，避免无谓耗电
      if (on) {
        if (this.data.keepAlive) this.startAudio()
        this.requestSubscribe()
      } else {
        this.stopAudio()
      }
    } else {
      this.setData({ isOnline: !on })
      wx.showToast({ title: (r && r.msg) || '操作失败', icon: 'none' })
    }
  },

  // 订阅消息授权：在「上线接单」这一关键动作时才弹，不在首次进入一次性申请（微信会拦截）
  requestSubscribe() {
    if (!SUBSCRIBE_TMPL_ID) return
    wx.requestSubscribeMessage({
      tmplIds: [SUBSCRIBE_TMPL_ID],
      success: (res) => {
        // res[SUBSCRIBE_TMPL_ID] === 'accept' 授权成功；'reject' 或 undefined 未授权
        // 用户拒绝后再次调用可能不再弹窗，需引导其手动进「设置 → 订阅消息」开启（见配置清单避坑点）
      },
      fail: () => {}
    })
  },

  // 静音音频保活开关
  toggleKeepAlive(e) {
    const on = e.detail.value
    this.setData({ keepAlive: on })
    try { wx.setStorageSync('hearcup_keepalive', on ? '1' : '0') } catch (err) {}
    if (on && this.data.isOnline) this.startAudio()
    else this.stopAudio()
  },

  startAudio() {
    try {
      if (!audioCtx) {
        audioCtx = wx.createInnerAudioContext()
        audioCtx.src = SILENCE_SRC
        audioCtx.loop = true
        audioCtx.volume = 0                 // 静音，用户无感知
        audioCtx.obeyMuteSwitch = false     // iOS 静音键不影响播放
        audioCtx.onError(() => {})          // 播放失败不影响其它功能
      }
      audioCtx.play()
    } catch (e) {}
  },

  stopAudio() {
    try { if (audioCtx) audioCtx.stop() } catch (e) {}
  },

  // 保活引导：按系统给出不同的操作步骤
  showKeepGuide() {
    const isIOS = this.data.platform === 'ios'
    const content = isIOS
      ? '点击小程序右上角「…」→ 选择「显示在聊天顶部」，小程序会以悬浮窗常驻微信顶部，来电能第一时间弹出。'
      : '打开小程序后，进入手机多任务界面，找到小程序并下拉锁定（或长按选择「锁定」），可避免微信清理后台时被关闭。'
    wx.showModal({
      title: '如何保持在线',
      content,
      showCancel: false,
      confirmText: '知道了',
    })
  },

  goApply() {
    wx.navigateTo({ url: '/pages/apply/apply' })
  },
})
