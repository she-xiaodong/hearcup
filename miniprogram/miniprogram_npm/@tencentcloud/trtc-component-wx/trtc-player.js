module.exports =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 2);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports) {

module.exports = require("@tencentcloud/trtc-cloud-wx");

/***/ }),
/* 1 */,
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _trtcCloudWx = __webpack_require__(0);

var _trtcCloudWx2 = _interopRequireDefault(_trtcCloudWx);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var trtcCloud = _trtcCloudWx2.default.getTRTCShareInstance();
var trtc = trtcCloud.trtc;
var InterfaceEventEmitter = trtcCloud.InterfaceEventEmitter;

Component({
  properties: {
    streamId: String,
    pictureInPictureMode: {
      type: null
    },
    pictureInPictureInitPosition: {
      type: String
    },
    enableSystemPip: {
      type: Boolean
    },
    enableCasting: {
      type: Boolean
    }
  },
  data: {
    player: {},
    TRTCStreamId: '',
    soundMode: ''
  },
  lifetimes: {
    attached: function attached() {
      trtcCloud.logger.info('trtc-player attached', this.data.streamId);
      if (this.data.streamId) {
        InterfaceEventEmitter.emit('playerDomReady', { isReady: true, view: this.data.streamId });
      }
      this.data.TRTCStreamId = this.getTRTCStreamId(this.data.streamId);
      this.bindTRTCCloudEvent();
    },
    detached: function detached() {
      trtcCloud.logger.info('trtc-player detached', this.data.streamId);
      InterfaceEventEmitter.emit('playerDomReady', { isReady: false, streamId: this.data.streamId });
      this.unbindTRTCCloudEvent();
    }
  },

  methods: {
    // todo room uniapp 特供，因为 uniapp 打包导致组件传惨变量名更替 trtc-player 组建内部无法识别
    setTRTCStreamId: function setTRTCStreamId(id) {
      var _this = this;

      trtcCloud.logger.info('trtc-player setTRTCStreamId', id);
      return new Promise(function (resolve, reject) {
        try {
          _this.data.streamId = id;
          _this.data.TRTCStreamId = _this.getTRTCStreamId(id);
          _this.setData({ streamId: _this.data.streamId }, function () {
            trtcCloud.logger.info('trtc-player setTRTCStreamId success', id);
            resolve();
            InterfaceEventEmitter.emit('playerDomReady', { isReady: true, view: id });
          });
        } catch (err) {
          trtcCloud.logger.info('trtc-player setTRTCStreamId fail', id, err);
          reject(err);
        }
      });
    },
    playerAttributesChange: function playerAttributesChange(event) {
      var view = event.view,
          playerAttributes = event.playerAttributes,
          callback = event.callback;

      trtcCloud.logger.info('trtc-player playerAttributesChange', view, JSON.stringify(playerAttributes), this.data.streamId);
      if (view === this.data.streamId) {
        this.setData({ player: playerAttributes }, callback);
      }
    },
    playerAudioRouteChange: function playerAudioRouteChange(event) {
      var soundMode = event.soundMode,
          callback = event.callback;

      trtcCloud.logger.info('trtc-player playerAudioRouteChange', soundMode);
      this.setData({ soundMode: soundMode }, callback);
    },
    getTRTCStreamId: function getTRTCStreamId(streamId) {
      var tempArray = streamId.split('_');
      var userId = tempArray.slice(0, -1).join('_');
      var streamType = Number(tempArray[tempArray.length - 1]);
      return (0, _trtcCloudWx.translateTRTCStreamId)(userId, streamType);
    },
    bindTRTCCloudEvent: function bindTRTCCloudEvent() {
      InterfaceEventEmitter.on('playerAttributesChange', this.playerAttributesChange, this);
      InterfaceEventEmitter.on('playerAudioRouteChange', this.playerAudioRouteChange, this);
    },
    unbindTRTCCloudEvent: function unbindTRTCCloudEvent() {
      InterfaceEventEmitter.off('playerAttributesChange', this.playerAttributesChange);
      InterfaceEventEmitter.off('playerAudioRouteChange', this.playerAudioRouteChange);
    },
    emitDocEvent: function emitDocEvent(name, event) {
      this.triggerEvent(name, event && event.detail || {});
    },

    // 请保持跟 wxml 中绑定的事件名称一致
    _playerStateChange: function _playerStateChange(event) {
      trtc.playerEventHandler(event);
      this.emitDocEvent('statechange', event);
    },
    _playerFullscreenChange: function _playerFullscreenChange(event) {
      trtc.playerFullscreenChange(event);
      this.emitDocEvent('fullscreenchange', event);
    },
    _playerNetStatus: function _playerNetStatus(event) {
      trtc.playerNetStatus(event);
      this.emitDocEvent('netstatus', event);
    },
    _playerAudioVolumeNotify: function _playerAudioVolumeNotify(event) {
      try {
        event.currentTarget.dataset.streamid = this.data.player.streamID;
        trtc.playerAudioVolumeNotify(event);
      } catch (err) {
        trtcCloud.logger.warn(err);
      } finally {
        this.emitDocEvent('audiovolumenotify', event);
      }
    },
    _playerEnterPictureInPicture: function _playerEnterPictureInPicture(event) {
      this.emitDocEvent('enterpictureinpicture', event);
    },
    _playerLeavePictureInPicture: function _playerLeavePictureInPicture(event) {
      this.emitDocEvent('leavepictureinpicture', event);
    },
    _playerCastingUserSelect: function _playerCastingUserSelect(event) {
      this.emitDocEvent('castinguserselect', event);
    },
    _playerCastingStateChange: function _playerCastingStateChange(event) {
      this.emitDocEvent('castingstatechange', event);
    },
    _playerCastingInterrupt: function _playerCastingInterrupt(event) {
      this.emitDocEvent('castinginterrupt', event);
    }
  }
});

/***/ })
/******/ ]);
//# sourceMappingURL=trtc-player.js.map