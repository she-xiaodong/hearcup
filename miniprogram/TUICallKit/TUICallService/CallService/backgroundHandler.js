"use strict";
/**
 * BackgroundHandler - Mini Program background detection and auto hangup handler
 *
 * When mini program goes to background for more than 4s, automatically hang up the call
 * to avoid issues caused by WeChat disconnecting WebSocket after 5s.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../const/index");
const tuiStore_1 = __importDefault(require("../TUIStore/tuiStore"));
const TUIStore = tuiStore_1.default.getInstance();
const DEFAULT_BACKGROUND_CONFIG = {
    enableAutoHangup: true,
    hangupTimeout: 4000, // 4s auto hangup (before ws disconnects at 5s)
};
class BackgroundHandler {
    constructor(callService) {
        this._hangupTimer = null;
        this._backgroundTimestamp = 0;
        this._isInBackground = false;
        this._config = Object.assign({}, DEFAULT_BACKGROUND_CONFIG);
        this._isInitialized = false;
        // Handle app hide event (going to background)
        this._handleAppHide = () => {
            var _a, _b, _c;
            const callStatus = TUIStore.getData(index_1.StoreName.CALL, index_1.NAME.CALL_STATUS) || index_1.CallStatus.IDLE;
            const callRole = TUIStore.getData(index_1.StoreName.CALL, index_1.NAME.CALL_ROLE) || index_1.CallRole.UNKNOWN;
            // Only handle when in connected state (as per requirement: only for connected calls)
            if ((callStatus !== index_1.CallStatus.CONNECTED) || !this._config.enableAutoHangup)
                return;
            this._isInBackground = true;
            this._backgroundTimestamp = Date.now();
            (_c = (_b = (_a = this._callService) === null || _a === void 0 ? void 0 : _a._tuiCallEngine) === null || _b === void 0 ? void 0 : _b.reportLog) === null || _c === void 0 ? void 0 : _c.call(_b, {
                name: 'TUICallkit.background.appHide',
                data: { callStatus, callRole, timestamp: this._backgroundTimestamp, config: this._config },
            });
            this._hangupTimer = setTimeout(() => {
                this._handleBackgroundTimeout();
            }, this._config.hangupTimeout);
        };
        // Handle app show event (returning from background)
        this._handleAppShow = () => {
            var _a, _b, _c;
            if (!this._isInBackground)
                return;
            const backgroundDuration = Date.now() - this._backgroundTimestamp;
            const callStatus = TUIStore.getData(index_1.StoreName.CALL, index_1.NAME.CALL_STATUS) || index_1.CallStatus.IDLE;
            const callRole = TUIStore.getData(index_1.StoreName.CALL, index_1.NAME.CALL_ROLE) || index_1.CallRole.UNKNOWN;
            (_c = (_b = (_a = this._callService) === null || _a === void 0 ? void 0 : _a._tuiCallEngine) === null || _b === void 0 ? void 0 : _b.reportLog) === null || _c === void 0 ? void 0 : _c.call(_b, {
                name: 'TUICallkit.background.appShow',
                data: { callStatus, callRole, backgroundDuration, timestamp: Date.now() },
            });
            this._isInBackground = false;
            this._clearTimers();
            // If background time exceeded hangup timeout, show toast to explain why call ended
            if (backgroundDuration >= this._config.hangupTimeout) {
                this._showToast('后台超时，通话已结束');
                this._checkCallStatusAfterBackground();
            }
        };
        this._callService = callService;
    }
    // Initialize background detection for mini program; Listen to wx.onAppHide/onAppShow events
    initBackgroundDetection() {
        if (this._isInitialized)
            return;
        try {
            // @ts-ignore
            if (typeof wx !== 'undefined' && wx.onAppHide && wx.onAppShow) {
                // @ts-ignore
                wx.onAppHide(this._handleAppHide);
                // @ts-ignore
                wx.onAppShow(this._handleAppShow);
                this._isInitialized = true;
                console.log('[TUICallKit] BackgroundHandler initialized');
            }
        }
        catch (error) {
            console.warn('[TUICallKit] BackgroundHandler init failed:', error);
        }
    }
    // Destroy background detection; Remove event listeners and clear timers
    destroyBackgroundDetection() {
        if (!this._isInitialized)
            return;
        try {
            // @ts-ignore
            if (typeof wx !== 'undefined' && wx.offAppHide && wx.offAppShow) {
                // @ts-ignore
                wx.offAppHide(this._handleAppHide);
                // @ts-ignore
                wx.offAppShow(this._handleAppShow);
            }
            this._clearTimers();
            this._isInitialized = false;
            console.log('[TUICallKit] BackgroundHandler destroyed');
        }
        catch (error) {
            console.warn('[TUICallKit] BackgroundHandler destroy failed:', error);
        }
    }
    // Show toast - compatible with both UniApp and native mini program
    _showToast(title) {
        try {
            // @ts-ignore - UniApp API
            if (typeof uni !== 'undefined' && (uni === null || uni === void 0 ? void 0 : uni.showToast)) {
                // @ts-ignore
                uni.showToast({ title, icon: 'none', duration: 2500 });
                // @ts-ignore - Native mini program API
            }
            else if (typeof wx !== 'undefined' && (wx === null || wx === void 0 ? void 0 : wx.showToast)) {
                // @ts-ignore
                wx.showToast({ title, icon: 'none', duration: 2500 });
            }
        }
        catch (error) { }
    }
    // Handle background timeout - auto hangup
    _handleBackgroundTimeout() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const callStatus = TUIStore.getData(index_1.StoreName.CALL, index_1.NAME.CALL_STATUS) || index_1.CallStatus.IDLE;
                const callRole = TUIStore.getData(index_1.StoreName.CALL, index_1.NAME.CALL_ROLE) || index_1.CallRole.UNKNOWN;
                const backgroundDuration = Date.now() - this._backgroundTimestamp;
                // Report timeout event before hangup
                (_c = (_b = (_a = this._callService) === null || _a === void 0 ? void 0 : _a._tuiCallEngine) === null || _b === void 0 ? void 0 : _b.reportLog) === null || _c === void 0 ? void 0 : _c.call(_b, {
                    name: 'TUICallkit.background.timeout',
                    data: { callStatus, callRole, backgroundDuration, hangupTimeout: this._config.hangupTimeout },
                });
                // Only handle CONNECTED state (CALLING state is filtered in _handleAppHide)
                if (callStatus === index_1.CallStatus.CONNECTED) {
                    (_f = (_e = (_d = this._callService) === null || _d === void 0 ? void 0 : _d._tuiCallEngine) === null || _e === void 0 ? void 0 : _e.reportLog) === null || _f === void 0 ? void 0 : _f.call(_e, {
                        name: 'TUICallkit.background.hangup',
                        data: { callStatus, callRole, action: 'hangup' },
                    });
                    yield ((_h = (_g = this._callService) === null || _g === void 0 ? void 0 : _g.hangup) === null || _h === void 0 ? void 0 : _h.call(_g));
                }
            }
            catch (error) {
                (_l = (_k = (_j = this._callService) === null || _j === void 0 ? void 0 : _j._tuiCallEngine) === null || _k === void 0 ? void 0 : _k.reportLog) === null || _l === void 0 ? void 0 : _l.call(_k, {
                    name: 'TUICallkit.background.hangup.fail',
                    data: { error: String(error) },
                });
            }
        });
    }
    // Check call status after returning from long background; Handle case where call should have ended
    _checkCallStatusAfterBackground() {
        var _a, _b;
        try {
            const callStatus = TUIStore.getData(index_1.StoreName.CALL, index_1.NAME.CALL_STATUS) || index_1.CallStatus.IDLE;
            // If still in call state after exceeding timeout, something went wrong
            // The call should have been ended by _handleBackgroundTimeout
            if (callStatus !== index_1.CallStatus.IDLE) {
                // Force reset if needed
                (_b = (_a = this._callService) === null || _a === void 0 ? void 0 : _a._resetCallStore) === null || _b === void 0 ? void 0 : _b.call(_a);
            }
        }
        catch (error) {
            console.warn('[TUICallKit] Check call status after background failed:', error);
        }
    }
    // Clear hangup timer
    _clearTimers() {
        if (this._hangupTimer) {
            clearTimeout(this._hangupTimer);
            this._hangupTimer = null;
        }
    }
}
exports.default = BackgroundHandler;
