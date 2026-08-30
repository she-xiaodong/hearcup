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
export declare const PermissionScope: {
    readonly RECORD: "scope.record";
    readonly CAMERA: "scope.camera";
};
export interface PermissionCheckResult {
    /** Whether the permission is granted. */
    granted: boolean;
    /** Human-readable tip shown to the user. */
    tip: string;
    /**
     * Denial level:
     * - 'mini-program': rejected within this mini-program → wx.openSetting works.
     * - 'system': WeChat lacks the OS permission → user must go to system settings.
     * - 'granted': already authorized.
     */
    level: 'granted' | 'mini-program' | 'system';
}
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
export declare function checkMicrophonePermission(): Promise<PermissionCheckResult>;
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
export declare function checkCameraPermission(): Promise<PermissionCheckResult>;
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
export declare function handlePermissionDenied(result: PermissionCheckResult): Promise<{
    confirm: boolean;
}>;
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
export declare function checkDevicePermission(deviceMap?: {
    microphone?: boolean;
    camera?: boolean;
}): Promise<boolean>;
