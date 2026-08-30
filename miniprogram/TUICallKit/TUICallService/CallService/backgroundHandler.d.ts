/**
 * BackgroundHandler - Mini Program background detection and auto hangup handler
 *
 * When mini program goes to background for more than 4s, automatically hang up the call
 * to avoid issues caused by WeChat disconnecting WebSocket after 5s.
 */
export interface IBackgroundConfig {
    enableAutoHangup: boolean;
    hangupTimeout: number;
}
export default class BackgroundHandler {
    private _callService;
    private _hangupTimer;
    private _backgroundTimestamp;
    private _isInBackground;
    private _config;
    private _isInitialized;
    constructor(callService: any);
    initBackgroundDetection(): void;
    destroyBackgroundDetection(): void;
    private _handleAppHide;
    private _handleAppShow;
    private _showToast;
    private _handleBackgroundTimeout;
    private _checkCallStatusAfterBackground;
    private _clearTimers;
}
