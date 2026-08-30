"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleModalError = void 0;
// Use the explicit `/index` path so the WeChat mini-program `require`, which
// only appends `.js` and does not resolve a directory to its `index.js`, can
// locate the module.
const index_1 = require("../UIKitModal/index");
const MINI_MODAL_ERROR_CODES = [
    -1001,
    -1002,
    101002,
];
const MINI_MODAL_ERROR_MAP = {
    '-1001': {
        id: 10001,
        content: '您的应用还未开通音视频通话能力'
    },
    '-1002': {
        id: 10002,
        content: '您暂不支持使用该能力，请前往购买页购买开通'
    },
    '101002': {
        id: 10014,
        content: '发起通话失败，用户 ID 无效，请确认该用户已注册'
    }
};
function handleModalError(error) {
    if (!error || !(error === null || error === void 0 ? void 0 : error.code)) {
        return;
    }
    handleMiniModalError(error);
}
exports.handleModalError = handleModalError;
function handleMiniModalError(error) {
    if (!MINI_MODAL_ERROR_CODES.includes(error.code)) {
        return;
    }
    const errorInfo = MINI_MODAL_ERROR_MAP[error.code.toString()];
    if (errorInfo) {
        index_1.UIKitModal.openModal({
            id: errorInfo.id,
            content: errorInfo.content,
            title: '错误',
            type: 'error'
        });
    }
}
