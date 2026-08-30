"use strict";
/**
 * WeChat mini-program permission utility.
 *
 * NOTE: This module is only referenced inside `// @if process.env.BUILD_TARGET='MINI'`
 * conditional-compilation blocks, so it will be tree-shaken out of the web builds.
 * `wx` global typings are not available in this package, therefore `// @ts-ignore`
 * is used before each `wx.*` call, following the same convention as `miniProgram.ts`.
 *
 * Distinguishes two levels of permission denial:
 * 1. Mini-program level: the user has rejected the scope in this mini-program.
 *    Fix: call wx.openSetting to let the user toggle it.
 * 2. System level: WeChat itself lacks the OS-level permission (Settings >
 *    Privacy > Microphone / Camera on iOS, App Permissions on Android).
 *    Fix: guide the user to the system settings page (cannot be opened
 *    programmatically).
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDevicePermission = exports.handlePermissionDenied = exports.checkCameraPermission = exports.checkMicrophonePermission = exports.PermissionScope = void 0;
// ── Permission Scope Constants ──
exports.PermissionScope = {
    RECORD: 'scope.record',
    CAMERA: 'scope.camera',
};
// ── Helpers ──
/**
 * Get the raw authSetting snapshot from WeChat.
 */
function getAuthSetting() {
    return new Promise((resolve) => {
        // @ts-ignore
        wx.getSetting({
            success(res) {
                resolve(res.authSetting);
            },
            fail() {
                resolve({});
            },
        });
    });
}
/**
 * Attempt to authorize a scope via wx.authorize.
 */
function authorizeScope(scope) {
    return new Promise((resolve) => {
        // @ts-ignore
        wx.authorize({
            scope,
            success() {
                resolve({ success: true, errMsg: '' });
            },
            fail(err) {
                resolve({ success: false, errMsg: err.errMsg || '' });
            },
        });
    });
}
/**
 * Check whether a scope has been explicitly denied by the user at the
 * mini-program level (authSetting returns false for that key).
 */
function isMiniProgramDenied(authSetting, scope) {
    return authSetting[scope] === false;
}
// ── Public API ──
/**
 * Check and request microphone permission.
 *
 * - No camera permission → calls can still proceed (video call falls back to audio).
 * - No microphone permission → calls MUST be blocked; user is guided to settings.
 *
 * The result's `level` field tells you whether the permission is already
 * granted, denied at the mini-program level (wx.openSetting can fix it),
 * or denied at the system level (user must go to OS settings manually).
 */
function checkMicrophonePermission() {
    return __awaiter(this, void 0, void 0, function* () {
        const authSetting = yield getAuthSetting();
        // Already granted
        if (authSetting[exports.PermissionScope.RECORD] === true) {
            return {
                granted: true,
                tip: '',
                level: 'granted',
            };
        }
        // Mini-program level: user has explicitly rejected the scope before.
        if (isMiniProgramDenied(authSetting, exports.PermissionScope.RECORD)) {
            return {
                granted: false,
                tip: '您已拒绝麦克风权限，请前往小程序设置页面开启麦克风权限后重试',
                level: 'mini-program',
            };
        }
        // Scope is undefined — never requested. Try to authorize.
        const result = yield authorizeScope(exports.PermissionScope.RECORD);
        if (result.success) {
            return { granted: true, tip: '', level: 'granted' };
        }
        // Authorization failed.
        // If the native permission dialog was never shown (user actively cancelled
        // or system-level block), errMsg typically contains "auth deny".
        // When the OS-level permission is off, wx.authorize fails immediately
        // without showing the dialog — we treat this as a system-level issue.
        const isSystemLevelDenial = !result.errMsg.includes('cancel') &&
            !result.errMsg.includes('deny');
        // Heuristic: if the error message suggests the dialog did NOT appear,
        // it is very likely a system-level block.
        if (isSystemLevelDenial || result.errMsg.includes('system')) {
            return {
                granted: false,
                tip: '您的微信没有麦克风权限，请前往手机系统设置 > 微信，开启麦克风权限后重试',
                level: 'system',
            };
        }
        // User dismissed the native dialog or denied it → mini-program level.
        return {
            granted: false,
            tip: '您拒绝了麦克风权限，请前往小程序设置页面开启麦克风权限后重试',
            level: 'mini-program',
        };
    });
}
exports.checkMicrophonePermission = checkMicrophonePermission;
/**
 * Check camera permission.
 *
 * Camera permission is REQUIRED for video calls — a denial MUST block the
 * call (both for initiating and for answering). For audio calls this check
 * is irrelevant and should be skipped by the caller.
 *
 * Tip wording here reflects the blocking policy: it tells the user that
 * video calls cannot proceed without camera permission, and points them to
 * the appropriate settings page (mini-program vs. system level).
 */
function checkCameraPermission() {
    return __awaiter(this, void 0, void 0, function* () {
        const authSetting = yield getAuthSetting();
        if (authSetting[exports.PermissionScope.CAMERA] === true) {
            return { granted: true, tip: '', level: 'granted' };
        }
        if (isMiniProgramDenied(authSetting, exports.PermissionScope.CAMERA)) {
            return {
                granted: false,
                tip: '您已拒绝摄像头权限，无法发起或接听视频通话，请前往小程序设置页面开启摄像头权限后重试',
                level: 'mini-program',
            };
        }
        const result = yield authorizeScope(exports.PermissionScope.CAMERA);
        if (result.success) {
            return { granted: true, tip: '', level: 'granted' };
        }
        const isSystemLevelDenial = !result.errMsg.includes('cancel') &&
            !result.errMsg.includes('deny');
        if (isSystemLevelDenial || result.errMsg.includes('system')) {
            return {
                granted: false,
                tip: '您的微信没有摄像头权限，无法发起或接听视频通话，请前往手机系统设置 > 微信，开启摄像头权限后重试',
                level: 'system',
            };
        }
        return {
            granted: false,
            tip: '您拒绝了摄像头权限，无法发起或接听视频通话，请前往小程序设置页面开启摄像头权限后重试',
            level: 'mini-program',
        };
    });
}
exports.checkCameraPermission = checkCameraPermission;
/**
 * Handle a failed permission check by showing the appropriate dialog and
 * optionally navigating to the settings page.
 *
 * Resolves with `{ confirm }` describing the user's choice:
 * - confirm === true : the user clicked the primary button (前往设置 for the
 *   mini-program level, or 我知道了 for the system level).
 * - confirm === false: the user cancelled the dialog (only possible for the
 *   mini-program level, which shows a 取消 button).
 *
 * Callers can use this to decide follow-up behavior, e.g. a callee rejecting
 * the incoming call when the user cancels the mandatory permission dialog.
 */
function handlePermissionDenied(result) {
    return new Promise((resolve) => {
        if (result.level === 'mini-program') {
            // Mini-program level: open the mini-program settings page.
            // @ts-ignore
            wx.showModal({
                title: '权限提示',
                content: result.tip,
                confirmText: '前往设置',
                cancelText: '取消',
                success(modalRes) {
                    if (modalRes.confirm) {
                        // @ts-ignore
                        wx.openSetting({
                            complete() {
                                resolve({ confirm: true });
                            },
                        });
                    }
                    else {
                        resolve({ confirm: false });
                    }
                },
                fail() {
                    resolve({ confirm: false });
                },
            });
        }
        else {
            // System level: can only guide the user, cannot open system settings.
            // @ts-ignore
            wx.showModal({
                title: '权限提示',
                content: result.tip,
                showCancel: false,
                confirmText: '我知道了',
                success() {
                    resolve({ confirm: true });
                },
                fail() {
                    resolve({ confirm: false });
                },
            });
        }
    });
}
exports.handlePermissionDenied = handlePermissionDenied;
/**
 * Combined device-permission pre-check used as the mini-program replacement
 * for `tuiCallEngine.deviceCheck(deviceMap)`.
 *
 * - Microphone is mandatory for every call (audio and video).
 * - Camera is mandatory only for video calls (`deviceMap.camera === true`).
 *
 * When a required permission is missing, the corresponding guidance dialog is
 * shown (via `handlePermissionDenied`) and `false` is returned so the caller
 * can abort / postpone the call. Returns `true` only when all required
 * permissions are granted.
 */
function checkDevicePermission(deviceMap = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        if (deviceMap.microphone) {
            const micResult = yield checkMicrophonePermission();
            if (!micResult.granted) {
                yield handlePermissionDenied(micResult);
                return false;
            }
        }
        if (deviceMap.camera) {
            const cameraResult = yield checkCameraPermission();
            if (!cameraResult.granted) {
                yield handlePermissionDenied(cameraResult);
                return false;
            }
        }
        return true;
    });
}
exports.checkDevicePermission = checkDevicePermission;
