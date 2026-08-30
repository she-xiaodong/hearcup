"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UIKitModal = void 0;
// Use the explicit `/index` path so the WeChat mini-program `require`, which
// only appends `.js` and does not resolve a directory to its `index.js`, can
// locate the module.
const index_1 = __importDefault(require("../CallService/index"));
// Native WeChat mini-program only exposes `wx`, while uniapp exposes `uni`.
// Fall back to `wx` when `uni` is not defined so the modal works in both.
const platform = typeof uni !== 'undefined' ? uni : wx;
const URL_REGEX = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;
const FULL_URL_REGEX = /(https?:\/\/[^\s]+)/g;
function isDevEnvironment() {
    var _a, _b;
    const accountInfo = (_a = platform.getAccountInfoSync) === null || _a === void 0 ? void 0 : _a.call(platform);
    const envVersion = (_b = accountInfo === null || accountInfo === void 0 ? void 0 : accountInfo.miniProgram) === null || _b === void 0 ? void 0 : _b.envVersion;
    return envVersion === 'develop' || envVersion === 'trial';
}
function extractUrlFromContent(content) {
    if (!content || typeof content !== 'string') {
        return null;
    }
    if (content.includes('<a ') || content.includes('<a>')) {
        const hrefMatch = content.match(/href=["']([^"']+)["']/);
        return hrefMatch ? hrefMatch[1] : null;
    }
    if (URL_REGEX.test(content.trim())) {
        return content.trim();
    }
    const urlMatch = content.match(FULL_URL_REGEX);
    return urlMatch ? urlMatch[0] : null;
}
function processContent(content) {
    if (!content || typeof content !== 'string') {
        return '';
    }
    let text = content.replace(/<[^>]+>/g, '');
    text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"');
    text = text.replace(/\s+/g, ' ').trim();
    const url = extractUrlFromContent(content);
    if (url && !text.includes(url)) {
        return text ? `${text}\n${url}` : url;
    }
    return text;
}
function reportModalView(options) {
    var _a;
    try {
        const tim = (_a = index_1.default === null || index_1.default === void 0 ? void 0 : index_1.default.getTim) === null || _a === void 0 ? void 0 : _a.call(index_1.default);
        if (tim && typeof tim.callExperimentalAPI === 'function') {
            const reportData = {
                id: options.id,
                title: options.title,
                type: options.type,
                content: options.content,
                platform: 'miniprogram',
            };
            tim.callExperimentalAPI('reportModalView', JSON.stringify(reportData));
        }
    }
    catch (error) {
        console.warn('[UIKitModal] reportModalView failed:', error);
    }
}
const createUIKitModal = (options) => {
    return new Promise((resolve) => {
        reportModalView(options);
        if (!isDevEnvironment()) {
            resolve({ action: 'confirm' });
            return;
        }
        const url = extractUrlFromContent(options.content);
        const processedContent = processContent(options.content);
        const hasLink = !!url;
        platform.showModal({
            title: options.title || '',
            content: processedContent,
            cancelText: '取消',
            confirmText: hasLink ? '复制链接' : '确认',
            success: (res) => {
                var _a, _b;
                const action = res.confirm ? 'confirm' : 'cancel';
                if (res.confirm) {
                    if (hasLink && url) {
                        platform.setClipboardData({
                            data: url,
                            success: () => {
                                platform.showToast({ title: '链接已复制', icon: 'success' });
                            },
                        });
                    }
                    (_a = options.onConfirm) === null || _a === void 0 ? void 0 : _a.call(options);
                }
                else {
                    (_b = options.onCancel) === null || _b === void 0 ? void 0 : _b.call(options);
                }
                resolve({ action, raw: res });
            },
            fail: () => {
                var _a;
                (_a = options.onCancel) === null || _a === void 0 ? void 0 : _a.call(options);
                resolve({ action: 'cancel' });
            },
        });
    });
};
exports.UIKitModal = {
    openModal: (config) => createUIKitModal(config),
};
