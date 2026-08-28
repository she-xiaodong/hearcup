// utils/trtc.js —— 腾讯云 TRTC 集成壳（V1.0 接入点）
// 真实实现需引入腾讯云小程序 SDK（trtc-wx 组件），此处仅给出调用骨架与注释。
//
// 参考：https://cloud.tencent.com/document/product/647/32399
// 后端在 /api/v1/call/invite 返回 room_id / user_sig / sdk_app_id / user_id

/**
 * 发起呼叫：请求后端创建房间并换取双端 UserSig
 * @param {number} providerId 服务者ID
 * @param {number} callType 1=语音 2=视频
 * @returns {Promise<{room_id,user_sig,provider_sig,sdk_app_id,user_id,provider_user_id}>}
 */
function inviteCall(providerId, callType) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: 'https://your-api.com/api/v1/call/invite',
      method: 'POST',
      data: { provider_id: providerId, call_type: callType },
      success: (res) => {
        if (res.data && res.data.code === 0) resolve(res.data.data)
        else reject(res.data)
      },
      fail: reject
    })
  })
}

/**
 * 进入 TRTC 房间（需在页面 onReady 后调用）
 * 真实代码：const trtcRoomContext = wx.$trtcRoomContext; ...
 */
function enterRoom(opts) {
  console.log('[TRTC] enterRoom stub', opts)
  // 真实实现：trtcRoomContext.enterRoom({ roomID, sdkAppID, userID, userSig, ... })
}

function exitRoom() {
  console.log('[TRTC] exitRoom stub')
  // 真实实现：trtcRoomContext.exitRoom()
}

module.exports = { inviteCall, enterRoom, exitRoom }
