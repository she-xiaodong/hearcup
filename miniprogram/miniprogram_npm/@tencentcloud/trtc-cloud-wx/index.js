module.exports = (function() {
var __MODS__ = {};
var __DEFINE__ = function(modId, func, req) { var m = { exports: {}, _tempexports: {} }; __MODS__[modId] = { status: 0, func: func, req: req, m: m }; };
var __REQUIRE__ = function(modId, source) { if(!__MODS__[modId]) return require(source); if(!__MODS__[modId].status) { var m = __MODS__[modId].m; m._exports = m._tempexports; var desp = Object.getOwnPropertyDescriptor(m, "exports"); if (desp && desp.configurable) Object.defineProperty(m, "exports", { set: function (val) { if(typeof val === "object" && val !== m._exports) { m._exports.__proto__ = val.__proto__; Object.keys(val).forEach(function (k) { m._exports[k] = val[k]; }); } m._tempexports = val }, get: function () { return m._tempexports; } }); __MODS__[modId].status = 1; __MODS__[modId].func(__MODS__[modId].req, m, m.exports); } return __MODS__[modId].m.exports; };
var __REQUIRE_WILDCARD__ = function(obj) { if(obj && obj.__esModule) { return obj; } else { var newObj = {}; if(obj != null) { for(var k in obj) { if (Object.prototype.hasOwnProperty.call(obj, k)) newObj[k] = obj[k]; } } newObj.default = obj; return newObj; } };
var __REQUIRE_DEFAULT__ = function(obj) { return obj && obj.__esModule ? obj.default : obj; };
__DEFINE__(1788161987520, function(require, module, exports) {


Object.defineProperty(exports, '__esModule', { value: true });

var EventEmitter = require('../../eventemitter3/index.js');
var TRTC = require('../../trtc-wx-sdk/index.js');

function _iterableToArrayLimit(arr, i) {
  var _i = null == arr ? null : "undefined" != typeof Symbol && arr[Symbol.iterator] || arr["@@iterator"];
  if (null != _i) {
    var _s,
      _e,
      _x,
      _r,
      _arr = [],
      _n = !0,
      _d = !1;
    try {
      if (_x = (_i = _i.call(arr)).next, 0 === i) {
        if (Object(_i) !== _i) return;
        _n = !1;
      } else for (; !(_n = (_s = _x.call(_i)).done) && (_arr.push(_s.value), _arr.length !== i); _n = !0);
    } catch (err) {
      _d = !0, _e = err;
    } finally {
      try {
        if (!_n && null != _i.return && (_r = _i.return(), Object(_r) !== _r)) return;
      } finally {
        if (_d) throw _e;
      }
    }
    return _arr;
  }
}
function _regeneratorRuntime() {
  _regeneratorRuntime = function () {
    return exports;
  };
  var exports = {},
    Op = Object.prototype,
    hasOwn = Op.hasOwnProperty,
    defineProperty = Object.defineProperty || function (obj, key, desc) {
      obj[key] = desc.value;
    },
    $Symbol = "function" == typeof Symbol ? Symbol : {},
    iteratorSymbol = $Symbol.iterator || "@@iterator",
    asyncIteratorSymbol = $Symbol.asyncIterator || "@@asyncIterator",
    toStringTagSymbol = $Symbol.toStringTag || "@@toStringTag";
  function define(obj, key, value) {
    return Object.defineProperty(obj, key, {
      value: value,
      enumerable: !0,
      configurable: !0,
      writable: !0
    }), obj[key];
  }
  try {
    define({}, "");
  } catch (err) {
    define = function (obj, key, value) {
      return obj[key] = value;
    };
  }
  function wrap(innerFn, outerFn, self, tryLocsList) {
    var protoGenerator = outerFn && outerFn.prototype instanceof Generator ? outerFn : Generator,
      generator = Object.create(protoGenerator.prototype),
      context = new Context(tryLocsList || []);
    return defineProperty(generator, "_invoke", {
      value: makeInvokeMethod(innerFn, self, context)
    }), generator;
  }
  function tryCatch(fn, obj, arg) {
    try {
      return {
        type: "normal",
        arg: fn.call(obj, arg)
      };
    } catch (err) {
      return {
        type: "throw",
        arg: err
      };
    }
  }
  exports.wrap = wrap;
  var ContinueSentinel = {};
  function Generator() {}
  function GeneratorFunction() {}
  function GeneratorFunctionPrototype() {}
  var IteratorPrototype = {};
  define(IteratorPrototype, iteratorSymbol, function () {
    return this;
  });
  var getProto = Object.getPrototypeOf,
    NativeIteratorPrototype = getProto && getProto(getProto(values([])));
  NativeIteratorPrototype && NativeIteratorPrototype !== Op && hasOwn.call(NativeIteratorPrototype, iteratorSymbol) && (IteratorPrototype = NativeIteratorPrototype);
  var Gp = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(IteratorPrototype);
  function defineIteratorMethods(prototype) {
    ["next", "throw", "return"].forEach(function (method) {
      define(prototype, method, function (arg) {
        return this._invoke(method, arg);
      });
    });
  }
  function AsyncIterator(generator, PromiseImpl) {
    function invoke(method, arg, resolve, reject) {
      var record = tryCatch(generator[method], generator, arg);
      if ("throw" !== record.type) {
        var result = record.arg,
          value = result.value;
        return value && "object" == typeof value && hasOwn.call(value, "__await") ? PromiseImpl.resolve(value.__await).then(function (value) {
          invoke("next", value, resolve, reject);
        }, function (err) {
          invoke("throw", err, resolve, reject);
        }) : PromiseImpl.resolve(value).then(function (unwrapped) {
          result.value = unwrapped, resolve(result);
        }, function (error) {
          return invoke("throw", error, resolve, reject);
        });
      }
      reject(record.arg);
    }
    var previousPromise;
    defineProperty(this, "_invoke", {
      value: function (method, arg) {
        function callInvokeWithMethodAndArg() {
          return new PromiseImpl(function (resolve, reject) {
            invoke(method, arg, resolve, reject);
          });
        }
        return previousPromise = previousPromise ? previousPromise.then(callInvokeWithMethodAndArg, callInvokeWithMethodAndArg) : callInvokeWithMethodAndArg();
      }
    });
  }
  function makeInvokeMethod(innerFn, self, context) {
    var state = "suspendedStart";
    return function (method, arg) {
      if ("executing" === state) throw new Error("Generator is already running");
      if ("completed" === state) {
        if ("throw" === method) throw arg;
        return doneResult();
      }
      for (context.method = method, context.arg = arg;;) {
        var delegate = context.delegate;
        if (delegate) {
          var delegateResult = maybeInvokeDelegate(delegate, context);
          if (delegateResult) {
            if (delegateResult === ContinueSentinel) continue;
            return delegateResult;
          }
        }
        if ("next" === context.method) context.sent = context._sent = context.arg;else if ("throw" === context.method) {
          if ("suspendedStart" === state) throw state = "completed", context.arg;
          context.dispatchException(context.arg);
        } else "return" === context.method && context.abrupt("return", context.arg);
        state = "executing";
        var record = tryCatch(innerFn, self, context);
        if ("normal" === record.type) {
          if (state = context.done ? "completed" : "suspendedYield", record.arg === ContinueSentinel) continue;
          return {
            value: record.arg,
            done: context.done
          };
        }
        "throw" === record.type && (state = "completed", context.method = "throw", context.arg = record.arg);
      }
    };
  }
  function maybeInvokeDelegate(delegate, context) {
    var methodName = context.method,
      method = delegate.iterator[methodName];
    if (undefined === method) return context.delegate = null, "throw" === methodName && delegate.iterator.return && (context.method = "return", context.arg = undefined, maybeInvokeDelegate(delegate, context), "throw" === context.method) || "return" !== methodName && (context.method = "throw", context.arg = new TypeError("The iterator does not provide a '" + methodName + "' method")), ContinueSentinel;
    var record = tryCatch(method, delegate.iterator, context.arg);
    if ("throw" === record.type) return context.method = "throw", context.arg = record.arg, context.delegate = null, ContinueSentinel;
    var info = record.arg;
    return info ? info.done ? (context[delegate.resultName] = info.value, context.next = delegate.nextLoc, "return" !== context.method && (context.method = "next", context.arg = undefined), context.delegate = null, ContinueSentinel) : info : (context.method = "throw", context.arg = new TypeError("iterator result is not an object"), context.delegate = null, ContinueSentinel);
  }
  function pushTryEntry(locs) {
    var entry = {
      tryLoc: locs[0]
    };
    1 in locs && (entry.catchLoc = locs[1]), 2 in locs && (entry.finallyLoc = locs[2], entry.afterLoc = locs[3]), this.tryEntries.push(entry);
  }
  function resetTryEntry(entry) {
    var record = entry.completion || {};
    record.type = "normal", delete record.arg, entry.completion = record;
  }
  function Context(tryLocsList) {
    this.tryEntries = [{
      tryLoc: "root"
    }], tryLocsList.forEach(pushTryEntry, this), this.reset(!0);
  }
  function values(iterable) {
    if (iterable) {
      var iteratorMethod = iterable[iteratorSymbol];
      if (iteratorMethod) return iteratorMethod.call(iterable);
      if ("function" == typeof iterable.next) return iterable;
      if (!isNaN(iterable.length)) {
        var i = -1,
          next = function next() {
            for (; ++i < iterable.length;) if (hasOwn.call(iterable, i)) return next.value = iterable[i], next.done = !1, next;
            return next.value = undefined, next.done = !0, next;
          };
        return next.next = next;
      }
    }
    return {
      next: doneResult
    };
  }
  function doneResult() {
    return {
      value: undefined,
      done: !0
    };
  }
  return GeneratorFunction.prototype = GeneratorFunctionPrototype, defineProperty(Gp, "constructor", {
    value: GeneratorFunctionPrototype,
    configurable: !0
  }), defineProperty(GeneratorFunctionPrototype, "constructor", {
    value: GeneratorFunction,
    configurable: !0
  }), GeneratorFunction.displayName = define(GeneratorFunctionPrototype, toStringTagSymbol, "GeneratorFunction"), exports.isGeneratorFunction = function (genFun) {
    var ctor = "function" == typeof genFun && genFun.constructor;
    return !!ctor && (ctor === GeneratorFunction || "GeneratorFunction" === (ctor.displayName || ctor.name));
  }, exports.mark = function (genFun) {
    return Object.setPrototypeOf ? Object.setPrototypeOf(genFun, GeneratorFunctionPrototype) : (genFun.__proto__ = GeneratorFunctionPrototype, define(genFun, toStringTagSymbol, "GeneratorFunction")), genFun.prototype = Object.create(Gp), genFun;
  }, exports.awrap = function (arg) {
    return {
      __await: arg
    };
  }, defineIteratorMethods(AsyncIterator.prototype), define(AsyncIterator.prototype, asyncIteratorSymbol, function () {
    return this;
  }), exports.AsyncIterator = AsyncIterator, exports.async = function (innerFn, outerFn, self, tryLocsList, PromiseImpl) {
    void 0 === PromiseImpl && (PromiseImpl = Promise);
    var iter = new AsyncIterator(wrap(innerFn, outerFn, self, tryLocsList), PromiseImpl);
    return exports.isGeneratorFunction(outerFn) ? iter : iter.next().then(function (result) {
      return result.done ? result.value : iter.next();
    });
  }, defineIteratorMethods(Gp), define(Gp, toStringTagSymbol, "Generator"), define(Gp, iteratorSymbol, function () {
    return this;
  }), define(Gp, "toString", function () {
    return "[object Generator]";
  }), exports.keys = function (val) {
    var object = Object(val),
      keys = [];
    for (var key in object) keys.push(key);
    return keys.reverse(), function next() {
      for (; keys.length;) {
        var key = keys.pop();
        if (key in object) return next.value = key, next.done = !1, next;
      }
      return next.done = !0, next;
    };
  }, exports.values = values, Context.prototype = {
    constructor: Context,
    reset: function (skipTempReset) {
      if (this.prev = 0, this.next = 0, this.sent = this._sent = undefined, this.done = !1, this.delegate = null, this.method = "next", this.arg = undefined, this.tryEntries.forEach(resetTryEntry), !skipTempReset) for (var name in this) "t" === name.charAt(0) && hasOwn.call(this, name) && !isNaN(+name.slice(1)) && (this[name] = undefined);
    },
    stop: function () {
      this.done = !0;
      var rootRecord = this.tryEntries[0].completion;
      if ("throw" === rootRecord.type) throw rootRecord.arg;
      return this.rval;
    },
    dispatchException: function (exception) {
      if (this.done) throw exception;
      var context = this;
      function handle(loc, caught) {
        return record.type = "throw", record.arg = exception, context.next = loc, caught && (context.method = "next", context.arg = undefined), !!caught;
      }
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i],
          record = entry.completion;
        if ("root" === entry.tryLoc) return handle("end");
        if (entry.tryLoc <= this.prev) {
          var hasCatch = hasOwn.call(entry, "catchLoc"),
            hasFinally = hasOwn.call(entry, "finallyLoc");
          if (hasCatch && hasFinally) {
            if (this.prev < entry.catchLoc) return handle(entry.catchLoc, !0);
            if (this.prev < entry.finallyLoc) return handle(entry.finallyLoc);
          } else if (hasCatch) {
            if (this.prev < entry.catchLoc) return handle(entry.catchLoc, !0);
          } else {
            if (!hasFinally) throw new Error("try statement without catch or finally");
            if (this.prev < entry.finallyLoc) return handle(entry.finallyLoc);
          }
        }
      }
    },
    abrupt: function (type, arg) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc <= this.prev && hasOwn.call(entry, "finallyLoc") && this.prev < entry.finallyLoc) {
          var finallyEntry = entry;
          break;
        }
      }
      finallyEntry && ("break" === type || "continue" === type) && finallyEntry.tryLoc <= arg && arg <= finallyEntry.finallyLoc && (finallyEntry = null);
      var record = finallyEntry ? finallyEntry.completion : {};
      return record.type = type, record.arg = arg, finallyEntry ? (this.method = "next", this.next = finallyEntry.finallyLoc, ContinueSentinel) : this.complete(record);
    },
    complete: function (record, afterLoc) {
      if ("throw" === record.type) throw record.arg;
      return "break" === record.type || "continue" === record.type ? this.next = record.arg : "return" === record.type ? (this.rval = this.arg = record.arg, this.method = "return", this.next = "end") : "normal" === record.type && afterLoc && (this.next = afterLoc), ContinueSentinel;
    },
    finish: function (finallyLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.finallyLoc === finallyLoc) return this.complete(entry.completion, entry.afterLoc), resetTryEntry(entry), ContinueSentinel;
      }
    },
    catch: function (tryLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc === tryLoc) {
          var record = entry.completion;
          if ("throw" === record.type) {
            var thrown = record.arg;
            resetTryEntry(entry);
          }
          return thrown;
        }
      }
      throw new Error("illegal catch attempt");
    },
    delegateYield: function (iterable, resultName, nextLoc) {
      return this.delegate = {
        iterator: values(iterable),
        resultName: resultName,
        nextLoc: nextLoc
      }, "next" === this.method && (this.arg = undefined), ContinueSentinel;
    }
  }, exports;
}
function _typeof(obj) {
  "@babel/helpers - typeof";

  return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) {
    return typeof obj;
  } : function (obj) {
    return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
  }, _typeof(obj);
}
function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}
function _defineProperties(target, props) {
  for (var i = 0; i < props.length; i++) {
    var descriptor = props[i];
    descriptor.enumerable = descriptor.enumerable || false;
    descriptor.configurable = true;
    if ("value" in descriptor) descriptor.writable = true;
    Object.defineProperty(target, _toPropertyKey(descriptor.key), descriptor);
  }
}
function _createClass(Constructor, protoProps, staticProps) {
  if (protoProps) _defineProperties(Constructor.prototype, protoProps);
  if (staticProps) _defineProperties(Constructor, staticProps);
  Object.defineProperty(Constructor, "prototype", {
    writable: false
  });
  return Constructor;
}
function _defineProperty(obj, key, value) {
  key = _toPropertyKey(key);
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }
  return obj;
}
function _slicedToArray(arr, i) {
  return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest();
}
function _toConsumableArray(arr) {
  return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread();
}
function _arrayWithoutHoles(arr) {
  if (Array.isArray(arr)) return _arrayLikeToArray(arr);
}
function _arrayWithHoles(arr) {
  if (Array.isArray(arr)) return arr;
}
function _iterableToArray(iter) {
  if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter);
}
function _unsupportedIterableToArray(o, minLen) {
  if (!o) return;
  if (typeof o === "string") return _arrayLikeToArray(o, minLen);
  var n = Object.prototype.toString.call(o).slice(8, -1);
  if (n === "Object" && o.constructor) n = o.constructor.name;
  if (n === "Map" || n === "Set") return Array.from(o);
  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
}
function _arrayLikeToArray(arr, len) {
  if (len == null || len > arr.length) len = arr.length;
  for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];
  return arr2;
}
function _nonIterableSpread() {
  throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _nonIterableRest() {
  throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _createForOfIteratorHelper(o, allowArrayLike) {
  var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"];
  if (!it) {
    if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") {
      if (it) o = it;
      var i = 0;
      var F = function () {};
      return {
        s: F,
        n: function () {
          if (i >= o.length) return {
            done: true
          };
          return {
            done: false,
            value: o[i++]
          };
        },
        e: function (e) {
          throw e;
        },
        f: F
      };
    }
    throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }
  var normalCompletion = true,
    didErr = false,
    err;
  return {
    s: function () {
      it = it.call(o);
    },
    n: function () {
      var step = it.next();
      normalCompletion = step.done;
      return step;
    },
    e: function (e) {
      didErr = true;
      err = e;
    },
    f: function () {
      try {
        if (!normalCompletion && it.return != null) it.return();
      } finally {
        if (didErr) throw err;
      }
    }
  };
}
function _toPrimitive(input, hint) {
  if (typeof input !== "object" || input === null) return input;
  var prim = input[Symbol.toPrimitive];
  if (prim !== undefined) {
    var res = prim.call(input, hint || "default");
    if (typeof res !== "object") return res;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (hint === "string" ? String : Number)(input);
}
function _toPropertyKey(arg) {
  var key = _toPrimitive(arg, "string");
  return typeof key === "symbol" ? key : String(key);
}

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol */

function __decorate(decorators, target, key, desc) {
  var c = arguments.length,
    r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc,
    d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function __awaiter(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function (resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function (resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
}
typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
  var e = new Error(message);
  return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

exports.TRTCAppScene = void 0;
(function (TRTCAppScene) {
  // web
  // TRTCAppSceneVideoCall = 0,
  // TRTCAppSceneLIVE = 1,
  // TRTCAppSceneAudioCall = 2,
  // TRTCAppSceneVoiceChatRoom = 3,
  // miniprogram
  // TRTCAppSceneVideoCall = 'videocall',
  // TRTCAppSceneLIVE = 'live',
  // TRTCAppSceneAudioCall = 'audiocall',
  // TRTCAppSceneVoiceChatRoom = 'voicechatroom',
  TRTCAppScene[TRTCAppScene["TRTCAppSceneVideoCall"] = 0] = "TRTCAppSceneVideoCall";
  TRTCAppScene[TRTCAppScene["TRTCAppSceneLIVE"] = 1] = "TRTCAppSceneLIVE";
  TRTCAppScene[TRTCAppScene["TRTCAppSceneAudioCall"] = 2] = "TRTCAppSceneAudioCall";
  TRTCAppScene[TRTCAppScene["TRTCAppSceneVoiceChatRoom"] = 3] = "TRTCAppSceneVoiceChatRoom";
})(exports.TRTCAppScene || (exports.TRTCAppScene = {}));
exports.TRTCRoleType = void 0;
(function (TRTCRoleType) {
  TRTCRoleType[TRTCRoleType["TRTCRoleAnchor"] = 20] = "TRTCRoleAnchor";
  TRTCRoleType[TRTCRoleType["TRTCRoleAudience"] = 21] = "TRTCRoleAudience";
})(exports.TRTCRoleType || (exports.TRTCRoleType = {}));
exports.TRTCVideoStreamType = void 0;
(function (TRTCVideoStreamType) {
  TRTCVideoStreamType[TRTCVideoStreamType["TRTCVideoStreamTypeBig"] = 0] = "TRTCVideoStreamTypeBig";
  TRTCVideoStreamType[TRTCVideoStreamType["TRTCVideoStreamTypeSmall"] = 1] = "TRTCVideoStreamTypeSmall";
  TRTCVideoStreamType[TRTCVideoStreamType["TRTCVideoStreamTypeSub"] = 2] = "TRTCVideoStreamTypeSub";
})(exports.TRTCVideoStreamType || (exports.TRTCVideoStreamType = {}));
exports.TRTCVideoResolution = void 0;
(function (TRTCVideoResolution) {
  TRTCVideoResolution[TRTCVideoResolution["TRTCVideoResolution_120_120"] = 1] = "TRTCVideoResolution_120_120";
  TRTCVideoResolution[TRTCVideoResolution["TRTCVideoResolution_160_160"] = 3] = "TRTCVideoResolution_160_160";
  TRTCVideoResolution[TRTCVideoResolution["TRTCVideoResolution_270_270"] = 5] = "TRTCVideoResolution_270_270";
  TRTCVideoResolution[TRTCVideoResolution["TRTCVideoResolution_480_480"] = 7] = "TRTCVideoResolution_480_480";
  TRTCVideoResolution[TRTCVideoResolution["TRTCVideoResolution_160_120"] = 50] = "TRTCVideoResolution_160_120";
  TRTCVideoResolution[TRTCVideoResolution["TRTCVideoResolution_240_180"] = 52] = "TRTCVideoResolution_240_180";
  TRTCVideoResolution[TRTCVideoResolution["TRTCVideoResolution_280_210"] = 54] = "TRTCVideoResolution_280_210";
  TRTCVideoResolution[TRTCVideoResolution["TRTCVideoResolution_320_240"] = 56] = "TRTCVideoResolution_320_240";
  TRTCVideoResolution[TRTCVideoResolution["TRTCVideoResolution_400_300"] = 58] = "TRTCVideoResolution_400_300";
  TRTCVideoResolution[TRTCVideoResolution["TRTCVideoResolution_480_360"] = 60] = "TRTCVideoResolution_480_360";
  TRTCVideoResolution[TRTCVideoResolution["TRTCVideoResolution_640_480"] = 62] = "TRTCVideoResolution_640_480";
  TRTCVideoResolution[TRTCVideoResolution["TRTCVideoResolution_960_720"] = 64] = "TRTCVideoResolution_960_720";
  TRTCVideoResolution[TRTCVideoResolution["TRTCVideoResolution_160_90"] = 100] = "TRTCVideoResolution_160_90";
  TRTCVideoResolution[TRTCVideoResolution["TRTCVideoResolution_256_144"] = 102] = "TRTCVideoResolution_256_144";
  TRTCVideoResolution[TRTCVideoResolution["TRTCVideoResolution_320_180"] = 104] = "TRTCVideoResolution_320_180";
  TRTCVideoResolution[TRTCVideoResolution["TRTCVideoResolution_480_270"] = 106] = "TRTCVideoResolution_480_270";
  TRTCVideoResolution[TRTCVideoResolution["TRTCVideoResolution_640_360"] = 108] = "TRTCVideoResolution_640_360";
  TRTCVideoResolution[TRTCVideoResolution["TRTCVideoResolution_960_540"] = 110] = "TRTCVideoResolution_960_540";
  TRTCVideoResolution[TRTCVideoResolution["TRTCVideoResolution_1280_720"] = 112] = "TRTCVideoResolution_1280_720";
  TRTCVideoResolution[TRTCVideoResolution["TRTCVideoResolution_1920_1080"] = 114] = "TRTCVideoResolution_1920_1080";
})(exports.TRTCVideoResolution || (exports.TRTCVideoResolution = {}));
exports.TRTCVideoResolutionMode = void 0;
(function (TRTCVideoResolutionMode) {
  TRTCVideoResolutionMode[TRTCVideoResolutionMode["TRTCVideoResolutionModeLandscape"] = 0] = "TRTCVideoResolutionModeLandscape";
  TRTCVideoResolutionMode[TRTCVideoResolutionMode["TRTCVideoResolutionModePortrait"] = 1] = "TRTCVideoResolutionModePortrait";
})(exports.TRTCVideoResolutionMode || (exports.TRTCVideoResolutionMode = {}));
exports.TRTCVideoRotation = void 0;
(function (TRTCVideoRotation) {
  TRTCVideoRotation[TRTCVideoRotation["TRTCVideoRotation0"] = 0] = "TRTCVideoRotation0";
  TRTCVideoRotation[TRTCVideoRotation["TRTCVideoRotation90"] = 1] = "TRTCVideoRotation90";
  TRTCVideoRotation[TRTCVideoRotation["TRTCVideoRotation180"] = 2] = "TRTCVideoRotation180";
  TRTCVideoRotation[TRTCVideoRotation["TRTCVideoRotation270"] = 3] = "TRTCVideoRotation270";
})(exports.TRTCVideoRotation || (exports.TRTCVideoRotation = {}));
exports.TRTCVideoFillMode = void 0;
(function (TRTCVideoFillMode) {
  TRTCVideoFillMode[TRTCVideoFillMode["TRTCVideoFillMode_Fill"] = 0] = "TRTCVideoFillMode_Fill";
  TRTCVideoFillMode[TRTCVideoFillMode["TRTCVideoFillMode_Fit"] = 1] = "TRTCVideoFillMode_Fit";
})(exports.TRTCVideoFillMode || (exports.TRTCVideoFillMode = {}));
exports.TRTCVideoMirrorType = void 0;
(function (TRTCVideoMirrorType) {
  TRTCVideoMirrorType[TRTCVideoMirrorType["TRTCVideoMirrorType_Auto"] = 0] = "TRTCVideoMirrorType_Auto";
  TRTCVideoMirrorType[TRTCVideoMirrorType["TRTCVideoMirrorType_Enable"] = 1] = "TRTCVideoMirrorType_Enable";
  TRTCVideoMirrorType[TRTCVideoMirrorType["TRTCVideoMirrorType_Disable"] = 2] = "TRTCVideoMirrorType_Disable";
})(exports.TRTCVideoMirrorType || (exports.TRTCVideoMirrorType = {}));
exports.TRTCAudioQuality = void 0;
(function (TRTCAudioQuality) {
  /** 语音模式：采样率：16k；单声道；音频裸码率：16kbps；适合语音通话为主的场景，比如在线会议，语音通话。 */
  TRTCAudioQuality[TRTCAudioQuality["TRTCAudioQualitySpeech"] = 1] = "TRTCAudioQualitySpeech";
  /** 标准模式（或者默认模式）：采样率：48k；单声道；音频裸码率：50kbps；SDK 默认的音频质量，如无特殊需求推荐选择之。 */
  TRTCAudioQuality[TRTCAudioQuality["TRTCAudioQualityDefault"] = 2] = "TRTCAudioQualityDefault";
  /** 音乐模式：采样率：48k；双声道 + 全频带；音频裸码率：128kbps；适合需要高保真传输音乐的场景，比如K歌、音乐直播等。 */
  TRTCAudioQuality[TRTCAudioQuality["TRTCAudioQualityMusic"] = 3] = "TRTCAudioQualityMusic";
})(exports.TRTCAudioQuality || (exports.TRTCAudioQuality = {}));
exports.TRTCBeautyStyle = void 0;
(function (TRTCBeautyStyle) {
  TRTCBeautyStyle[TRTCBeautyStyle["TRTCBeautyStyleSmooth"] = 0] = "TRTCBeautyStyleSmooth";
  TRTCBeautyStyle[TRTCBeautyStyle["TRTCBeautyStyleNature"] = 1] = "TRTCBeautyStyleNature";
})(exports.TRTCBeautyStyle || (exports.TRTCBeautyStyle = {}));
exports.TRTCAudioRoute = void 0;
(function (TRTCAudioRoute) {
  /** 扬声器模式 */
  TRTCAudioRoute[TRTCAudioRoute["TRTC_AUDIO_ROUTE_SPEAKER"] = 0] = "TRTC_AUDIO_ROUTE_SPEAKER";
  /** 听筒模式 */
  TRTCAudioRoute[TRTCAudioRoute["TRTC_AUDIO_ROUTE_EARPIECE"] = 1] = "TRTC_AUDIO_ROUTE_EARPIECE";
})(exports.TRTCAudioRoute || (exports.TRTCAudioRoute = {}));

var Handletype;
(function (Handletype) {
  Handletype["setPusher"] = "setPusher";
  Handletype["setPlayer"] = "setPlayer";
})(Handletype || (Handletype = {}));
// 数字越高，set优先级越高
var TaskMap = {
  enterRoom: {
    priority: 0,
    type: Handletype.setPusher
  },
  switchRole: {
    priority: 1,
    type: Handletype.setPusher
  },
  startLocalPreview: {
    priority: 0,
    type: Handletype.setPusher
  },
  stopLocalPreview: {
    priority: 0,
    type: Handletype.setPusher
  },
  muteLocalVideo: {
    priority: 1,
    type: Handletype.setPusher
  },
  setVideoEncoderParam: {
    priority: 0,
    type: Handletype.setPusher
  },
  setLocalRenderParams: {
    priority: 0,
    type: Handletype.setPusher
  },
  startLocalAudio: {
    priority: 0,
    type: Handletype.setPusher
  },
  stopLocalAudio: {
    priority: 0,
    type: Handletype.setPusher
  },
  muteLocalAudio: {
    priority: 1,
    type: Handletype.setPusher
  },
  switchCamera: {
    priority: 0,
    type: Handletype.setPusher
  },
  setBeautyStyle: {
    priority: 0,
    type: Handletype.setPusher
  },
  exitRoom: {
    priority: 9,
    type: Handletype.setPusher
  },
  startRemoteView: {
    priority: 0,
    type: Handletype.setPlayer
  },
  updateRemoteView: {
    priority: 0,
    type: Handletype.setPlayer
  },
  stopAllRemoteView: {
    priority: 1,
    type: Handletype.setPlayer
  },
  muteRemoteVideoStream: {
    priority: 1,
    type: Handletype.setPlayer
  },
  muteAllRemoteVideoStreams: {
    priority: 1,
    type: Handletype.setPlayer
  },
  setRemoteRenderParams: {
    priority: 0,
    type: Handletype.setPlayer
  },
  muteRemoteAudio: {
    priority: 1,
    type: Handletype.setPlayer
  },
  muteAllRemoteAudio: {
    priority: 1,
    type: Handletype.setPlayer
  }
};
var Task = /*#__PURE__*/function () {
  function Task(optinos) {
    _classCallCheck(this, Task);
    var _a;
    var _optinos$priority = optinos.priority,
      priority = _optinos$priority === void 0 ? 0 : _optinos$priority,
      action = optinos.action,
      args = optinos.args,
      resolve = optinos.resolve,
      reject = optinos.reject,
      ctx = optinos.ctx,
      name = optinos.name;
    this.ctx = ctx;
    this.priority = priority;
    this.action = action;
    this.args = args;
    this.resolve = resolve;
    this.reject = reject;
    this.name = name;
    this.single = this.whetherSingle(name);
    this.type = ((_a = TaskMap[name]) === null || _a === void 0 ? void 0 : _a.type) || Handletype.setPusher;
    this.sequenceNumber = Task.nextSequenceNumber++;
  }
  _createClass(Task, [{
    key: "whetherSingle",
    value: function whetherSingle(funName) {
      switch (funName) {
        case 'enterRoom':
          return true;
        default:
          return false;
      }
    }
  }]);
  return Task;
}();
Task.nextSequenceNumber = 0;
var TaskQueueState;
(function (TaskQueueState) {
  TaskQueueState["IDLE"] = "idle";
  TaskQueueState["PENDING"] = "pending";
  TaskQueueState["PROCESS"] = "process";
})(TaskQueueState || (TaskQueueState = {}));
var TaskQueueEvent;
(function (TaskQueueEvent) {
  TaskQueueEvent["SET"] = "SET";
  TaskQueueEvent["SETPROCESS"] = "SETPROCESS";
  TaskQueueEvent["SETDONE"] = "SETDONE";
})(TaskQueueEvent || (TaskQueueEvent = {}));
var TaskMachine = /*#__PURE__*/function () {
  function TaskMachine() {
    _classCallCheck(this, TaskMachine);
    this.isProcessing = false; // 表示 pusherTaskQueue 是否正在处理
    this.pusherDomReady = false;
    this.pusherTaskQueue = []; // 存储所有 pusher 任务
    this.playerTasks = {}; // 存储每个 player 的任务队列
    this.state = TaskQueueState.IDLE;
  }
  _createClass(TaskMachine, [{
    key: "reset",
    value: function reset() {
      this.state = TaskQueueState.IDLE;
      this.resetPusherTasks();
      for (var key in this.playerTasks) {
        if (this.playerTasks[key]) {
          this.resetPlayerTasks(key);
        }
      }
      this.playerTasks = {};
    }
  }, {
    key: "resetPusherTasks",
    value: function resetPusherTasks() {
      this.isProcessing = false;
      this.pusherTaskQueue.forEach(function (task) {
        task.resolve();
      });
      this.pusherTaskQueue.length = 0;
    }
  }, {
    key: "resetPlayerTasks",
    value: function resetPlayerTasks(view) {
      if (this.playerTasks[view]) {
        this.playerTasks[view].taskQueue.forEach(function (task) {
          task.resolve();
        });
        this.playerTasks[view].taskQueue.length = 0;
        this.playerTasks[view].isProcessing = false;
        this.playerTasks[view].domReady = false;
      }
    }
  }, {
    key: "setPusherDomReady",
    value: function setPusherDomReady(isReady) {
      this.pusherDomReady = isReady;
      if (!isReady) {
        this.resetPusherTasks();
      }
      return this.pusherDomReady;
    }
  }, {
    key: "setPlayerDomReady",
    value: function setPlayerDomReady(view, isReady) {
      if (!this.playerTasks[view]) {
        this.playerTasks[view] = {
          taskQueue: [],
          isProcessing: false,
          domReady: false
        };
      }
      this.playerTasks[view].domReady = isReady;
      if (isReady) {
        this.processPlayerTasks(view);
      } else {
        this.resetPlayerTasks(view);
      }
    }
  }, {
    key: "send",
    value: function send(event, view) {
      switch (this.state) {
        case TaskQueueState.IDLE:
          if (event === TaskQueueEvent.SET) {
            this.state = TaskQueueState.PENDING;
            if (view) {
              this.processPlayerTasks(view);
            } else {
              this.processPusherTasks();
            }
          }
          break;
        case TaskQueueState.PENDING:
          if (event === TaskQueueEvent.SETPROCESS) {
            if (view) {
              this.processPlayerTasks(view);
            } else {
              this.processPusherTasks();
            }
          }
          if (event === TaskQueueEvent.SETDONE) {
            this.state = TaskQueueState.IDLE;
          }
          break;
        case TaskQueueState.PROCESS:
          if (event === TaskQueueEvent.SETDONE) {
            this.state = TaskQueueState.IDLE;
          }
          break;
      }
    }
  }, {
    key: "addTask",
    value: function addTask(task) {
      if (task.type === Handletype.setPusher) {
        this.addPusherTask(task);
      } else {
        this.addPlayerTask(task.args.view, task);
      }
    }
  }, {
    key: "addPusherTask",
    value: function addPusherTask(task) {
      this.addTaskToQueue(task, this.pusherTaskQueue);
      if (this.state === TaskQueueState.PROCESS && !this.isProcessing) {
        this.processPusherTasks();
      } else if (this.state === TaskQueueState.IDLE) {
        this.send(TaskQueueEvent.SET);
      } else if (this.state === TaskQueueState.PENDING) {
        this.send(TaskQueueEvent.SETPROCESS);
      }
    }
  }, {
    key: "addPlayerTask",
    value: function addPlayerTask(view, task) {
      if (!this.playerTasks[view]) {
        this.playerTasks[view] = {
          taskQueue: [],
          isProcessing: false,
          domReady: false
        };
      }
      this.addTaskToQueue(task, this.playerTasks[view].taskQueue);
      if (this.state === TaskQueueState.PROCESS && !this.playerTasks[view].isProcessing) {
        this.processPlayerTasks(view);
      } else if (this.state === TaskQueueState.IDLE) {
        this.send(TaskQueueEvent.SET, view);
      } else if (this.state === TaskQueueState.PENDING) {
        this.send(TaskQueueEvent.SETPROCESS, view);
      }
    }
  }, {
    key: "addTaskToQueue",
    value: function addTaskToQueue(task, queue) {
      queue.push(task);
      queue.sort(function (a, b) {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return a.sequenceNumber - b.sequenceNumber;
      });
    }
    /**
     * 处理任务队列
     * @param taskQueue
     * @param isProcessing
     * @param domReady
     * @param setProcessing
     * @returns
     */
  }, {
    key: "processTasks",
    value: function processTasks(taskQueue, isProcessing, domReady, setProcessing, view) {
      return __awaiter(this, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee() {
        var _this = this;
        var currentTasks, singleTasks, exceptSingleTask, _iterator, _step, _task3, params, task, sequenceTask, r, _iterator2, _step2, _task, _iterator3, _step3, _task2;
        return _regeneratorRuntime().wrap(function _callee$(_context) {
          while (1) switch (_context.prev = _context.next) {
            case 0:
              if (!(isProcessing || !domReady || taskQueue.length === 0)) {
                _context.next = 2;
                break;
              }
              return _context.abrupt("return");
            case 2:
              setProcessing(true);
              this.state = TaskQueueState.PROCESS;
              currentTasks = _toConsumableArray(taskQueue);
              taskQueue.length = 0;
              singleTasks = currentTasks.filter(function (task) {
                return task.single;
              });
              exceptSingleTask = currentTasks.filter(function (task) {
                return !task.single;
              });
              _iterator = _createForOfIteratorHelper(singleTasks);
              _context.prev = 9;
              _iterator.s();
            case 11:
              if ((_step = _iterator.n()).done) {
                _context.next = 24;
                break;
              }
              _task3 = _step.value;
              _context.prev = 13;
              _context.next = 16;
              return _task3.action.call(_task3.ctx, _task3.args, _task3.name, TaskMap[_task3.name].type);
            case 16:
              _task3.result = _context.sent;
              _context.next = 22;
              break;
            case 19:
              _context.prev = 19;
              _context.t0 = _context["catch"](13);
              _task3.err = _context.t0;
            case 22:
              _context.next = 11;
              break;
            case 24:
              _context.next = 29;
              break;
            case 26:
              _context.prev = 26;
              _context.t1 = _context["catch"](9);
              _iterator.e(_context.t1);
            case 29:
              _context.prev = 29;
              _iterator.f();
              return _context.finish(29);
            case 32:
              params = exceptSingleTask.reduce(function (acc, cur) {
                var params = cur.args.params;
                return Object.assign(Object.assign({}, acc), typeof params === 'function' ? params() : params);
              }, {});
              task = exceptSingleTask[0];
              sequenceTask = currentTasks.sort(function (a, b) {
                return a.sequenceNumber - b.sequenceNumber;
              });
              _context.prev = 35;
              r = null;
              if (!task) {
                _context.next = 47;
                break;
              }
              if (!view) {
                _context.next = 44;
                break;
              }
              _context.next = 41;
              return task.action.call(task.ctx, {
                params: params,
                streamId: task.args.streamId,
                view: view
              }, task.name, Handletype.setPlayer);
            case 41:
              r = _context.sent;
              _context.next = 47;
              break;
            case 44:
              _context.next = 46;
              return task.action.call(task.ctx, {
                params: params
              }, task.name, Handletype.setPusher);
            case 46:
              r = _context.sent;
            case 47:
              _iterator2 = _createForOfIteratorHelper(sequenceTask);
              try {
                for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
                  _task = _step2.value;
                  if (_task.err) {
                    _task.reject(_task.err);
                  } else {
                    _task.resolve(_task.result || r);
                  }
                }
              } catch (err) {
                _iterator2.e(err);
              } finally {
                _iterator2.f();
              }
              _context.next = 55;
              break;
            case 51:
              _context.prev = 51;
              _context.t2 = _context["catch"](35);
              _iterator3 = _createForOfIteratorHelper(sequenceTask);
              try {
                for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
                  _task2 = _step3.value;
                  _task2.reject(_context.t2);
                }
              } catch (err) {
                _iterator3.e(err);
              } finally {
                _iterator3.f();
              }
            case 55:
              setProcessing(false);
              this.send(TaskQueueEvent.SETDONE, view);
              if (taskQueue.length > 0) {
                Promise.resolve().then(function () {
                  _this.processTasks(taskQueue, isProcessing, domReady, setProcessing, view);
                })["catch"](console.error);
              }
            case 58:
            case "end":
              return _context.stop();
          }
        }, _callee, this, [[9, 26, 29, 32], [13, 19], [35, 51]]);
      }));
    }
  }, {
    key: "processPusherTasks",
    value: function processPusherTasks() {
      return __awaiter(this, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee2() {
        var _this2 = this;
        return _regeneratorRuntime().wrap(function _callee2$(_context2) {
          while (1) switch (_context2.prev = _context2.next) {
            case 0:
              _context2.next = 2;
              return this.processTasks(this.pusherTaskQueue, this.isProcessing, this.pusherDomReady, function (value) {
                _this2.isProcessing = value;
              });
            case 2:
            case "end":
              return _context2.stop();
          }
        }, _callee2, this);
      }));
    }
  }, {
    key: "processPlayerTasks",
    value: function processPlayerTasks(view) {
      return __awaiter(this, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee3() {
        var _this3 = this;
        return _regeneratorRuntime().wrap(function _callee3$(_context3) {
          while (1) switch (_context3.prev = _context3.next) {
            case 0:
              if (this.playerTasks[view]) {
                _context3.next = 2;
                break;
              }
              return _context3.abrupt("return");
            case 2:
              _context3.next = 4;
              return this.processTasks(this.playerTasks[view].taskQueue, this.playerTasks[view].isProcessing, this.playerTasks[view].domReady, function (value) {
                _this3.playerTasks[view].isProcessing = value;
              }, view);
            case 4:
            case "end":
              return _context3.stop();
          }
        }, _callee3, this);
      }));
    }
  }]);
  return TaskMachine;
}();
var taskMachine = new TaskMachine();
var setHandle = function setHandle(target, key, descriptor) {
  var originalMethod = descriptor.value;
  descriptor.value = function () {
    var _this4 = this;
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }
    var params = args[0],
      funName = args[1];
    return new Promise(function (resolve, reject) {
      var _a;
      try {
        taskMachine.addTask(new Task({
          ctx: _this4,
          priority: ((_a = TaskMap[funName]) === null || _a === void 0 ? void 0 : _a.priority) || 0,
          action: originalMethod,
          args: params,
          name: funName,
          resolve: resolve,
          reject: reject
        }));
      } catch (error) {
        reject(error);
      }
    });
  };
  return descriptor;
};

var _TRTCVideoResolutionM, _TRTCBeautyStyleMap, _TRTCVideoFillModeMap;
var translateTRTCAppScene = function translateTRTCAppScene(scene) {
  switch (scene) {
    case 0:
      return 'videocall';
    case 1:
      return 'live';
    case 2:
      return 'audiocall';
    case 3:
      return 'voicechatroom';
    default:
      return '';
  }
};
var translateTRTCVideoStreamType = function translateTRTCVideoStreamType(streamType) {
  switch (streamType) {
    case 0:
      return 'main';
    case 1:
      return 'small';
    case 2:
      return 'aux';
    default:
      return '';
  }
};
var translateTRTCStreamId = function translateTRTCStreamId(userId, streamType) {
  return "".concat(userId, "_").concat(translateTRTCVideoStreamType(streamType));
};
var TRTCVideoResolutionMap = (_TRTCVideoResolutionM = {}, _defineProperty(_TRTCVideoResolutionM, exports.TRTCVideoResolution.TRTCVideoResolution_120_120, [120, 120]), _defineProperty(_TRTCVideoResolutionM, exports.TRTCVideoResolution.TRTCVideoResolution_160_160, [160, 160]), _defineProperty(_TRTCVideoResolutionM, exports.TRTCVideoResolution.TRTCVideoResolution_270_270, [270, 270]), _defineProperty(_TRTCVideoResolutionM, exports.TRTCVideoResolution.TRTCVideoResolution_480_480, [480, 480]), _defineProperty(_TRTCVideoResolutionM, exports.TRTCVideoResolution.TRTCVideoResolution_160_120, [160, 120]), _defineProperty(_TRTCVideoResolutionM, exports.TRTCVideoResolution.TRTCVideoResolution_240_180, [240, 180]), _defineProperty(_TRTCVideoResolutionM, exports.TRTCVideoResolution.TRTCVideoResolution_280_210, [280, 210]), _defineProperty(_TRTCVideoResolutionM, exports.TRTCVideoResolution.TRTCVideoResolution_320_240, [320, 240]), _defineProperty(_TRTCVideoResolutionM, exports.TRTCVideoResolution.TRTCVideoResolution_400_300, [400, 300]), _defineProperty(_TRTCVideoResolutionM, exports.TRTCVideoResolution.TRTCVideoResolution_480_360, [480, 360]), _defineProperty(_TRTCVideoResolutionM, exports.TRTCVideoResolution.TRTCVideoResolution_640_480, [640, 480]), _defineProperty(_TRTCVideoResolutionM, exports.TRTCVideoResolution.TRTCVideoResolution_960_720, [960, 720]), _defineProperty(_TRTCVideoResolutionM, exports.TRTCVideoResolution.TRTCVideoResolution_160_90, [160, 90]), _defineProperty(_TRTCVideoResolutionM, exports.TRTCVideoResolution.TRTCVideoResolution_256_144, [256, 144]), _defineProperty(_TRTCVideoResolutionM, exports.TRTCVideoResolution.TRTCVideoResolution_320_180, [320, 180]), _defineProperty(_TRTCVideoResolutionM, exports.TRTCVideoResolution.TRTCVideoResolution_480_270, [480, 270]), _defineProperty(_TRTCVideoResolutionM, exports.TRTCVideoResolution.TRTCVideoResolution_640_360, [640, 360]), _defineProperty(_TRTCVideoResolutionM, exports.TRTCVideoResolution.TRTCVideoResolution_960_540, [960, 540]), _defineProperty(_TRTCVideoResolutionM, exports.TRTCVideoResolution.TRTCVideoResolution_1280_720, [1280, 720]), _defineProperty(_TRTCVideoResolutionM, exports.TRTCVideoResolution.TRTCVideoResolution_1920_1080, [1920, 1080]), _TRTCVideoResolutionM);
var translateTRTCVideoResolution = function translateTRTCVideoResolution(resolution) {
  var _TRTCVideoResolutionM2 = _slicedToArray(TRTCVideoResolutionMap[resolution], 2),
    _TRTCVideoResolutionM3 = _TRTCVideoResolutionM2[0],
    videoWidth = _TRTCVideoResolutionM3 === void 0 ? 0 : _TRTCVideoResolutionM3,
    _TRTCVideoResolutionM4 = _TRTCVideoResolutionM2[1],
    videoHeight = _TRTCVideoResolutionM4 === void 0 ? 0 : _TRTCVideoResolutionM4;
  return {
    videoWidth: videoWidth,
    videoHeight: videoHeight
  };
};
var translateTRTCVideoResolutionMode = function translateTRTCVideoResolutionMode(resolutionMode) {
  switch (resolutionMode) {
    case exports.TRTCVideoResolutionMode.TRTCVideoResolutionModeLandscape:
      return 'horizontal';
    case exports.TRTCVideoResolutionMode.TRTCVideoResolutionModePortrait:
      return 'vertical';
    default:
      return '';
  }
};
var translateTRTCVideoRotation = function translateTRTCVideoRotation(rotation) {
  switch (rotation) {
    case exports.TRTCVideoRotation.TRTCVideoRotation0:
      return 'vertical';
    case exports.TRTCVideoRotation.TRTCVideoRotation90:
      return 'horizontal';
    default:
      return '';
  }
};
var translateTRTCVideoMirrorType = function translateTRTCVideoMirrorType(mirrorType) {
  switch (mirrorType) {
    case exports.TRTCVideoMirrorType.TRTCVideoMirrorType_Auto:
      return 'auto';
    case exports.TRTCVideoMirrorType.TRTCVideoMirrorType_Enable:
      return 'enable';
    case exports.TRTCVideoMirrorType.TRTCVideoMirrorType_Disable:
      return 'disable';
    default:
      return '';
  }
};
var translateTRTCAudioRoute = function translateTRTCAudioRoute(route) {
  switch (route) {
    case exports.TRTCAudioRoute.TRTC_AUDIO_ROUTE_SPEAKER:
      return 'speaker';
    case exports.TRTCAudioRoute.TRTC_AUDIO_ROUTE_EARPIECE:
      return 'ear';
    default:
      return '';
  }
};
var TRTCBeautyStyleMap = (_TRTCBeautyStyleMap = {}, _defineProperty(_TRTCBeautyStyleMap, exports.TRTCBeautyStyle.TRTCBeautyStyleSmooth, 'smooth'), _defineProperty(_TRTCBeautyStyleMap, exports.TRTCBeautyStyle.TRTCBeautyStyleNature, 'nature'), _TRTCBeautyStyleMap);
var translateBeautyStyle = function translateBeautyStyle(beautyStyle) {
  return TRTCBeautyStyleMap[beautyStyle];
};
var TRTCVideoFillModeMap = (_TRTCVideoFillModeMap = {}, _defineProperty(_TRTCVideoFillModeMap, exports.TRTCVideoFillMode.TRTCVideoFillMode_Fill, 'fillCrop'), _defineProperty(_TRTCVideoFillModeMap, exports.TRTCVideoFillMode.TRTCVideoFillMode_Fit, 'contain'), _TRTCVideoFillModeMap);
var translateVideoFillMod = function translateVideoFillMod(videoFillMod) {
  return TRTCVideoFillModeMap[videoFillMod];
};

var uniqueFunc = function uniqueFunc(arr, uniId) {
  var res = new Map();
  return arr.filter(function (item) {
    return !res.has(item[uniId]) && res.set(item[uniId], 1);
  });
};
var isNumber = function isNumber(param) {
  return typeof param === 'number';
};
/**
 * 安全执行 JSON.parse
 * @param data
 * @returns
 */
function safelyParse(data) {
  if (typeof data !== 'string') {
    return data;
  }
  var result;
  try {
    var tempData = JSON.parse(data);
    // 规避 JSON.parse('12345') 转化为 12345 的情况
    if (_typeof(tempData) === 'object' && tempData) {
      result = tempData;
    } else {
      result = data;
    }
  } catch (error) {
    result = data;
  }
  return result;
}
var formatTime = function formatTime() {
  var timestamp = new Date().getTime();
  var date = new Date(timestamp);
  // const year = date.getFullYear()
  // const month = date.getMonth() + 1
  // const day = date.getDate()
  var hour = date.getHours();
  var minute = date.getMinutes();
  var second = date.getSeconds();
  var millisecond = date.getMilliseconds();
  hour = hour < 10 ? "0".concat(hour) : hour;
  minute = minute < 10 ? "0".concat(minute) : minute;
  second = second < 10 ? "0".concat(second) : second;
  return "".concat(hour, ":").concat(minute, ":").concat(second, ".").concat(millisecond);
};

var LOGLEVEL = {
  LOG: 0,
  INFO: 1,
  DEBUG: 2,
  WARN: 3,
  ERROR: 4,
  NON_LOGGING: 5 // 无日志记录级别，sdk将不打印任何日志
};

var Logger = /*#__PURE__*/function () {
  function Logger(tagName) {
    _classCallCheck(this, Logger);
    this.logLevel = 0;
    this.TAG_NAME = '';
    this.TAG_NAME = tagName || '[TRTCCloud-WX]';
  }
  _createClass(Logger, [{
    key: "setInfo",
    value: function setInfo(params) {
      var sdkAppId = params.sdkAppId,
        userId = params.userId,
        roomId = params.roomId;
      this.sdkAppId = sdkAppId;
      this.userId = userId;
      this.roomId = roomId;
    }
  }, {
    key: "setLogLevel",
    value: function setLogLevel(level) {
      this.logLevel = level;
    }
    // 打印普通日志
  }, {
    key: "log",
    value: function log() {
      if (this.logLevel === LOGLEVEL.LOG) {
        var _console;
        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }
        (_console = console).log.apply(_console, [this.TAG_NAME, formatTime()].concat(args));
      }
    }
  }, {
    key: "info",
    value: function info() {
      if (this.logLevel <= LOGLEVEL.INFO) {
        var _console2;
        for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
          args[_key2] = arguments[_key2];
        }
        (_console2 = console).info.apply(_console2, [this.TAG_NAME, formatTime()].concat(args));
      }
    }
    // 打印告警日志
  }, {
    key: "warn",
    value: function warn() {
      // SDK 上报的相关事件
      if (this.logLevel <= LOGLEVEL.WARN) {
        var _console3;
        for (var _len3 = arguments.length, args = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
          args[_key3] = arguments[_key3];
        }
        (_console3 = console).warn.apply(_console3, [this.TAG_NAME, formatTime()].concat(args));
      }
    }
    // 打印错误日志
  }, {
    key: "error",
    value: function error() {
      // 状态机内部错误信息
      if (this.logLevel <= LOGLEVEL.ERROR) {
        var _console4;
        for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
          args[_key4] = arguments[_key4];
        }
        (_console4 = console).error.apply(_console4, [this.TAG_NAME, formatTime()].concat(args));
      }
    }
  }, {
    key: "debug",
    value: function debug() {
      // 状态机内部错误信息
      if (this.logLevel <= LOGLEVEL.DEBUG) {
        var _console5;
        for (var _len5 = arguments.length, args = new Array(_len5), _key5 = 0; _key5 < _len5; _key5++) {
          args[_key5] = arguments[_key5];
        }
        (_console5 = console).debug.apply(_console5, [this.TAG_NAME, formatTime()].concat(args));
      }
    }
  }]);
  return Logger;
}();
var logger = new Logger();

var name = "@tencentcloud/trtc-cloud-wx";
var version = "1.0.9";
var description = "";
var main = "dist/trtc-cloud-wx.js";
var module$1 = "dist/trtc-cloud-wx.js";
var type = "module";
var scripts = {
	build: "npm run clear && rollup -c",
	dev: "node ./build/chokidar.js",
	clear: "node ./build/clear.js",
	copy: "node ./build/copy.js",
	doc: "npx typedoc --tsconfig typedoc.json",
	"doc:watch": "typedoc --watch",
	"doc:build": "jsdoc -c jsdoc.json",
	publish: "bash ./sdk_publish.bash"
};
var keywords = [
];
var author = "";
var license = "ISC";
var devDependencies = {
	"@babel/core": "^7.21.4",
	"@babel/preset-env": "^7.21.4",
	"@babel/preset-typescript": "^7.21.4",
	"@rollup/plugin-babel": "^6.0.3",
	"@rollup/plugin-json": "^6.0.0",
	"@rollup/plugin-terser": "^0.4.3",
	"@rollup/plugin-typescript": "^11.0.0",
	"@types/node": "^18.15.11",
	"@typescript-eslint/eslint-plugin": "^2.28.0",
	"@typescript-eslint/parser": "^2.28.0",
	"babel-loader": "^9.1.2",
	"better-docs": "^2.7.2",
	chokidar: "^3.5.3",
	"docdash-blue": "^1.1.9",
	eslint: "^5.14.1",
	"eslint-config-airbnb-base": "13.1.0",
	"eslint-loader": "^2.1.2",
	"eslint-plugin-import": "^2.27.5",
	"eslint-plugin-node": "^7.0.1",
	"eslint-plugin-promise": "^3.8.0",
	jsdoc: "^4.0.2",
	rollup: "^3.27.1",
	"rollup-plugin-uglify": "^6.0.4",
	taffydb: "^2.7.3",
	tslib: "^2.5.0",
	typedoc: "^0.24.4",
	"typedoc-theme-hierarchy": "^3.1.0",
	typescript: "^5.0.2"
};
var dependencies = {
	eventemitter3: "^5.0.0",
	"trtc-wx-sdk": "^1.1.14"
};
var packageJson = {
	name: name,
	version: version,
	description: description,
	main: main,
	module: module$1,
	type: type,
	scripts: scripts,
	keywords: keywords,
	author: author,
	license: license,
	devDependencies: devDependencies,
	dependencies: dependencies
};

/**
 * TRTCCloud
 * @interface
 */
var TRTCCloud = /*#__PURE__*/function () {
  // private handleAudioVolumeUpdate: (userVolumes: Array<TRTCVolumeInfo>) => void;
  function TRTCCloud() {
    _classCallCheck(this, TRTCCloud);
    this.version = packageJson.version;
    // 内部使用，用于调用接口时UI测监听，完成剩余逻辑
    this.InterfaceEventEmitter = new EventEmitter();
    // 外部使用，用户监听回调事件
    this.EventEmitter = new EventEmitter();
    this.role = exports.TRTCRoleType.TRTCRoleAnchor;
    this.userId = '';
    this.isEnterRoom = false;
    this.isVideoMuted = false;
    this.isOpenCamera = false;
    this.currentSoundMode = exports.TRTCAudioRoute.TRTC_AUDIO_ROUTE_SPEAKER;
    this.audioVolumeEvaluation = 0;
    this.encsmall = 0;
    this.enableinfiniteanchor = 0;
    this.allTimer = {};
    this.renderMap = new Map();
    this.pusherIsReady = false;
    this.logger = logger;
    this.init();
  }
  /**
   * 获取 TRTCCloud 实例（单例模式）
   * @category Base
   */
  _createClass(TRTCCloud, [{
    key: "createSubCloud",
    value: function createSubCloud() {
      return TRTCCloud.getTRTCShareInstance();
    }
  }, {
    key: "getSDKVersion",
    value: function getSDKVersion() {
      return this.version;
    }
  }, {
    key: "destroy",
    value: function destroy() {
      this.offTRTCEvent();
      this.EventEmitter.removeAllListeners();
      this.InterfaceEventEmitter.removeAllListeners();
      this.trtc.exitRoom();
    }
  }, {
    key: "init",
    value: function init() {
      this.trtc = new TRTC(this);
      this.trtc.setLogLevel(3);
      this.TRTC_EVENT = this.trtc.EVENT;
      this.bindTRTCEvent();
      this.bindComponentEvent();
      this.handleNetworkQuality = this.getHandleNetworkQuality(2000);
    }
  }, {
    key: "reset",
    value: function reset() {
      var _this = this;
      this.role = exports.TRTCRoleType.TRTCRoleAnchor;
      this.userId = '';
      this.isEnterRoom = false;
      this.isVideoMuted = false;
      this.isOpenCamera = false;
      this.currentSoundMode = exports.TRTCAudioRoute.TRTC_AUDIO_ROUTE_SPEAKER;
      this.encsmall = 0;
      this.enableinfiniteanchor = 0;
      taskMachine.reset();
      Object.keys(this.allTimer).forEach(function (key) {
        clearInterval(_this.allTimer[key]);
        _this.allTimer[key] = null;
      });
    }
  }, {
    key: "bindComponentEvent",
    value: function bindComponentEvent() {
      var _this2 = this;
      this.InterfaceEventEmitter.on('pusherDomReady', function (isReady) {
        _this2.pusherIsReady = isReady;
        taskMachine.setPusherDomReady(isReady);
        if (isReady) {
          _this2.trtc.createPusher({});
          taskMachine.send(TaskQueueEvent.SETPROCESS);
        } else {
          if (_this2.isEnterRoom) {
            _this2.exitRoom();
          }
          taskMachine.send(TaskQueueEvent.SETDONE);
        }
      });
      this.InterfaceEventEmitter.on('playerDomReady', function (_ref) {
        var isReady = _ref.isReady,
          view = _ref.view;
        taskMachine.setPlayerDomReady(view, isReady);
        if (isReady) {
          taskMachine.send(TaskQueueEvent.SETPROCESS, view);
        } else {
          taskMachine.send(TaskQueueEvent.SETDONE, view);
        }
      });
    }
  }, {
    key: "bindTRTCEvent",
    value: function bindTRTCEvent() {
      var _this3 = this;
      this.trtc.on(this.TRTC_EVENT.LOCAL_LEAVE, function (event) {
        // todo 第二个参数为进房耗时 此处调用start的时候处理
        // this.emit('onEnterRoom', 0)
      });
      this.trtc.on(this.TRTC_EVENT.PLAYER_WARNING, function (event) {
        var _event$data = event.data,
          code = _event$data.code,
          message = _event$data.message;
        _this3.emit('onWarnning', code, message);
      });
      this.trtc.on(this.TRTC_EVENT.ERROR, function (event) {
        var _event$data2 = event.data,
          code = _event$data2.code,
          message = _event$data2.message;
        _this3.emit('onError', code, message);
      });
      this.trtc.on(this.TRTC_EVENT.REMOTE_USER_JOIN, function (event) {
        var userID = event.data.userID;
        _this3.emit('onRemoteUserEnterRoom', userID);
      });
      // 远端用户退出
      this.trtc.on(this.TRTC_EVENT.REMOTE_USER_LEAVE, function (event) {
        var _event$data3 = event.data,
          userID = _event$data3.userID;
          _event$data3.playerList;
        _this3.InterfaceEventEmitter.emit('onRemoteUserLeaveRoom', userID, 0);
        _this3.emit('onUserVideoAvailable', userID, 0);
        _this3.emit('onUserSubStreamAvailable', userID, 0);
        _this3.emit('onRemoteUserLeaveRoom', userID, 0);
      });
      // 远端用户推送视频
      this.trtc.on(this.TRTC_EVENT.REMOTE_VIDEO_ADD, function (event) {
        var player = event.data.player;
        _this3.emit(player.streamType === 'aux' ? 'onUserSubStreamAvailable' : 'onUserVideoAvailable', player.userID, 1);
      });
      // 远端用户取消推送视频
      this.trtc.on(this.TRTC_EVENT.REMOTE_VIDEO_REMOVE, function (event) {
        var player = event.data.player;
        _this3.emit(player.streamType === 'aux' ? 'onUserSubStreamAvailable' : 'onUserVideoAvailable', player.userID, 0);
      });
      // 远端用户推送音频
      this.trtc.on(this.TRTC_EVENT.REMOTE_AUDIO_ADD, function (event) {
        var player = event.data.player;
        _this3.emit('onUserAudioAvailable', player.userID, 1);
      });
      // 远端用户取消推送音频
      this.trtc.on(this.TRTC_EVENT.REMOTE_AUDIO_REMOVE, function (event) {
        var player = event.data.player;
        _this3.emit('onUserAudioAvailable', player.userID, 0);
      });
      this.trtc.on(this.TRTC_EVENT.REMOTE_AUDIO_VOLUME_UPDATE, function (event) {
        var playerList = event.data.playerList;
        var userVolumes = playerList.map(function (player) {
          return {
            userId: player.userID,
            volume: player.volume
          };
        });
        _this3.handleAudioVolumeUpdate(userVolumes);
      });
      this.trtc.on(this.TRTC_EVENT.LOCAL_AUDIO_VOLUME_UPDATE, function (event) {
        var pusher = event.data.pusher;
        var userVolumes = [{
          userId: pusher.userID,
          volume: pusher.volume
        }];
        _this3.handleAudioVolumeUpdate(userVolumes);
      });
      this.trtc.on(this.TRTC_EVENT.LOCAL_NET_STATE_UPDATE, function (event) {
        var pusher = event.data.pusher;
        _this3.handleNetworkQuality({
          pusher: pusher
        });
      });
      this.trtc.on(this.TRTC_EVENT.REMOTE_NET_STATE_UPDATE, function (event) {
        var playerList = event.data.playerList;
        _this3.handleNetworkQuality({
          playerList: playerList
        });
      });
    }
  }, {
    key: "offTRTCEvent",
    value: function offTRTCEvent() {
      this.trtc.off(this.TRTC_EVENT.LOCAL_LEAVE);
      this.trtc.off(this.TRTC_EVENT.ERROR);
      this.trtc.off(this.TRTC_EVENT.REMOTE_USER_JOIN);
      this.trtc.off(this.TRTC_EVENT.REMOTE_USER_LEAVE);
      this.trtc.off(this.TRTC_EVENT.REMOTE_VIDEO_ADD);
      this.trtc.off(this.TRTC_EVENT.REMOTE_VIDEO_REMOVE);
      this.trtc.off(this.TRTC_EVENT.REMOTE_AUDIO_ADD);
      this.trtc.off(this.TRTC_EVENT.REMOTE_AUDIO_REMOVE);
      this.trtc.off(this.TRTC_EVENT.REMOTE_AUDIO_VOLUME_UPDATE);
      this.trtc.off(this.TRTC_EVENT.REMOTE_NET_STATE_UPDATE);
    }
  }, {
    key: "getHandleAudioVolumeUpdate",
    value: function getHandleAudioVolumeUpdate(interval) {
      var _this4 = this;
      var _a;
      if ((_a = this.allTimer) === null || _a === void 0 ? void 0 : _a.AudioVolume) {
        clearInterval(this.allTimer.AudioVolume);
        this.allTimer.AudioVolume = null;
      }
      if (interval === 0) return function () {};
      var tempUserVolumes = [];
      var filterUselessItem = function filterUselessItem(userId) {
        tempUserVolumes = tempUserVolumes.filter(function (userVolume) {
          return userVolume.userId !== userId;
        });
      };
      this.InterfaceEventEmitter.off('onRemoteUserLeaveRoom'); // 防止重复监听
      this.InterfaceEventEmitter.on('onRemoteUserLeaveRoom', filterUselessItem, this.getHandleAudioVolumeUpdate);
      return function (userVolumes) {
        tempUserVolumes = uniqueFunc([].concat(_toConsumableArray(userVolumes), _toConsumableArray(tempUserVolumes)), 'userId');
        if (_this4.allTimer.AudioVolume) return;
        var timer = setInterval(function () {
          _this4.emit('onUserVoiceVolume', tempUserVolumes, tempUserVolumes.length, 0 // todo 此参数无用，暂时废弃
          );
        }, interval);
        _this4.allTimer.AudioVolume = timer;
      };
    }
  }, {
    key: "handleAudioVolumeUpdate",
    value: function handleAudioVolumeUpdate(userVolumes) {}
  }, {
    key: "getHandleNetworkQuality",
    value: function getHandleNetworkQuality(interval) {
      var _this5 = this;
      var _a;
      if ((_a = this.allTimer) === null || _a === void 0 ? void 0 : _a.networkQuality) {
        clearInterval(this.allTimer.networkQuality);
        this.allTimer.networkQuality = null;
      }
      if (interval === 0) return function () {};
      var resultQuality = {
        localQuality: null,
        remoteQuality: []
      };
      this.on('onRemoteUserLeaveRoom', function (userId) {
        resultQuality.remoteQuality = resultQuality.remoteQuality.filter(function (quality) {
          return quality.userId !== userId;
        });
      }, this);
      return function (data) {
        var pusher = data.pusher,
          playerList = data.playerList;
        if (pusher) resultQuality.localQuality = {
          userId: pusher.userID,
          quality: pusher.netStatus
        };
        if (playerList) {
          resultQuality.remoteQuality = playerList.map(function (player) {
            return {
              userId: player.userID,
              quality: player.netStatus
            };
          });
        }
        if (_this5.allTimer.networkQuality) return;
        var timer = setInterval(function () {
          _this5.emit('onNetworkQuality', resultQuality.localQuality, resultQuality.remoteQuality);
        }, interval);
        _this5.allTimer.networkQuality = timer;
      };
    }
  }, {
    key: "handleNetworkQuality",
    value: function handleNetworkQuality(quality) {}
    /**
     * @category Base
     */
  }, {
    key: "on",
    value: function on(eventName, handler, context) {
      this.EventEmitter.on(eventName, handler, context);
    }
    /**
     * @category Base
     */
  }, {
    key: "off",
    value: function off(eventName, handler, context) {
      this.EventEmitter.off(eventName, handler, context);
    }
    /**
     * @category Base
     */
  }, {
    key: "emit",
    value: function emit(eventName) {
      var _this$EventEmitter;
      for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        args[_key - 1] = arguments[_key];
      }
      (_this$EventEmitter = this.EventEmitter).emit.apply(_this$EventEmitter, [eventName].concat(args));
    }
    /**
     * @category 房间
     */
  }, {
    key: "enterRoom",
    value: function enterRoom(params, scene) {
      return __awaiter(this, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee2() {
        var _this6 = this;
        var startTime, sdkAppId, userId, userSig, roomId, strRoomId, role, privateMapKey;
        return _regeneratorRuntime().wrap(function _callee2$(_context2) {
          while (1) switch (_context2.prev = _context2.next) {
            case 0:
              if (!this.isEnterRoom) {
                _context2.next = 3;
                break;
              }
              logger.warn('You are already in the room, please exit the current room first.');
              return _context2.abrupt("return");
            case 3:
              this.trtc.createPusher({});
              startTime = new Date().getTime();
              sdkAppId = params.sdkAppId, userId = params.userId, userSig = params.userSig, roomId = params.roomId, strRoomId = params.strRoomId, role = params.role, privateMapKey = params.privateMapKey;
              logger.setInfo({
                sdkAppId: sdkAppId,
                userId: userId,
                roomId: strRoomId
              });
              logger.info('enterRoom with options: ', JSON.stringify(params), scene);
              this.userId = userId;
              this.isEnterRoom = true;
              _context2.prev = 10;
              _context2.next = 13;
              return this.setAttributes({
                params: {
                  sdkAppID: sdkAppId,
                  userID: userId,
                  userSig: userSig,
                  roomID: roomId,
                  strRoomID: strRoomId,
                  role: role,
                  privateMapKey: privateMapKey,
                  scene: translateTRTCAppScene(scene),
                  enableMic: false,
                  enableCamera: false,
                  videoPreview: false,
                  encsmall: this.encsmall,
                  enableinfiniteanchor: this.enableinfiniteanchor,
                  recvMode: this.enableinfiniteanchor ? 2 : 1 // 1 自动接收音视频 2 仅自动接收音频
                }
              }, 'enterRoom');
            case 13:
              _context2.next = 20;
              break;
            case 15:
              _context2.prev = 15;
              _context2.t0 = _context2["catch"](10);
              this.isEnterRoom = false;
              logger.info('enterRoom fail');
              this.emit('onEnterRoom', -1);
            case 20:
              this.trtc.getPusherInstance().start({
                success: function success() {
                  return __awaiter(_this6, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee() {
                    var endTime;
                    return _regeneratorRuntime().wrap(function _callee$(_context) {
                      while (1) switch (_context.prev = _context.next) {
                        case 0:
                          logger.info('enterRoom success');
                          this.scene = scene;
                          endTime = new Date().getTime();
                          this.emit('onEnterRoom', endTime - startTime);
                          if (!(this.trtc.getPusherAttributes().videoPreview === true)) {
                            _context.next = 8;
                            break;
                          }
                          _context.next = 7;
                          return this.setAttributes({
                            params: {
                              videoPreview: false,
                              enableCamera: true
                            }
                          }, 'other');
                        case 7:
                          this.emit('onSendFirstLocalVideoFrame', exports.TRTCVideoStreamType.TRTCVideoStreamTypeBig);
                        case 8:
                        case "end":
                          return _context.stop();
                      }
                    }, _callee, this);
                  }));
                },
                fail: function fail() {
                  _this6.isEnterRoom = false;
                  logger.info('enterRoom fail');
                  _this6.emit('onEnterRoom', -1);
                }
              });
            case 21:
            case "end":
              return _context2.stop();
          }
        }, _callee2, this, [[10, 15]]);
      }));
    }
    /**
     * @category 房间
     */
  }, {
    key: "exitRoom",
    value: function exitRoom() {
      var _this7 = this;
      logger.info('exitRoom');
      var _this$trtc$exitRoom = this.trtc.exitRoom(),
        pusher = _this$trtc$exitRoom.pusher;
      this.reset();
      if (!this.pusherIsReady) {
        logger.info('exitRoom success');
        this.emit('onExitRoom', 0);
      } else {
        this.InterfaceEventEmitter.emit('pusherAttributesChange', {
          pusher: pusher,
          callback: function callback() {
            logger.info('exitRoom success');
            _this7.emit('onExitRoom', 0);
          }
        });
      }
    }
    /**
     * @category 房间
     */
  }, {
    key: "switchRoom",
    value: function switchRoom() {}
    /**
     * 切换角色，仅适用于直播场景（TRTCAppSceneLIVE 和 TRTCAppSceneVoiceChatRoom）
     * @category 房间
     */
  }, {
    key: "switchRole",
    value: function switchRole(role) {
      return __awaiter(this, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee3() {
        var tempRole;
        return _regeneratorRuntime().wrap(function _callee3$(_context3) {
          while (1) switch (_context3.prev = _context3.next) {
            case 0:
              logger.info('switchRole with options: ', role);
              tempRole = this.role;
              this.role = role;
              if (!(tempRole === role || role === exports.TRTCRoleType.TRTCRoleAnchor)) {
                _context3.next = 7;
                break;
              }
              logger.info('switchRole success');
              this.emit('onSwitchRole', 0, '');
              return _context3.abrupt("return");
            case 7:
              _context3.next = 9;
              return this.setAttributes({
                params: {
                  enableCamera: false,
                  enableMic: false
                }
              }, 'switchRole');
            case 9:
              logger.info('switchRole success');
              this.emit('onSwitchRole', 0, '');
            case 11:
            case "end":
              return _context3.stop();
          }
        }, _callee3, this);
      }));
    }
  }, {
    key: "connectOtherRoom",
    value: function connectOtherRoom() {}
  }, {
    key: "disconnectOtherRoom",
    value: function disconnectOtherRoom() {}
  }, {
    key: "setDefaultStreamRecvMode",
    value: function setDefaultStreamRecvMode() {}
  }, {
    key: "useVirtualBackground",
    value: function useVirtualBackground() {}
    /**
     * 启动本地摄像头采集和预览
     * @category 视频
     */
  }, {
    key: "startLocalPreview",
    value: function startLocalPreview() {
      var frontCamera = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;
      return __awaiter(this, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee4() {
        var _this8 = this;
        var pusher;
        return _regeneratorRuntime().wrap(function _callee4$(_context4) {
          while (1) switch (_context4.prev = _context4.next) {
            case 0:
              logger.info('startLocalPreview with options: ', frontCamera);
              if (!(this.role !== exports.TRTCRoleType.TRTCRoleAnchor)) {
                _context4.next = 3;
                break;
              }
              return _context4.abrupt("return");
            case 3:
              _context4.next = 5;
              return this.setAttributes({
                params: function params() {
                  return {
                    videoPreview: _this8.isEnterRoom ? _this8.isVideoMuted : true,
                    enableCamera: _this8.isEnterRoom ? !_this8.isVideoMuted : false,
                    frontCamera: frontCamera ? 'front' : 'back'
                  };
                }
              }, 'startLocalPreview');
            case 5:
              pusher = _context4.sent;
              logger.info('startLocalPreview success');
              this.emit('onFirstVideoFrame', '', exports.TRTCVideoStreamType.TRTCVideoStreamTypeBig, pusher.videoWidth, pusher.videoHeight);
              if (this.isEnterRoom) {
                this.emit('onSendFirstLocalVideoFrame', exports.TRTCVideoStreamType.TRTCVideoStreamTypeBig);
              }
              this.isOpenCamera = true;
            case 10:
            case "end":
              return _context4.stop();
          }
        }, _callee4, this);
      }));
    }
    /**
     * 停止本地摄像头采集和预览
     * @category 视频
     */
  }, {
    key: "stopLocalPreview",
    value: function stopLocalPreview() {
      return __awaiter(this, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee5() {
        return _regeneratorRuntime().wrap(function _callee5$(_context5) {
          while (1) switch (_context5.prev = _context5.next) {
            case 0:
              logger.info('stopLocalPreview');
              _context5.next = 3;
              return this.setAttributes({
                params: {
                  videoPreview: false,
                  enableCamera: false
                }
              }, 'stopLocalPreview');
            case 3:
              logger.info('stopLocalPreview success');
              this.isOpenCamera = false;
              this.emit('onUserVideoAvailable', this.userId, 0);
            case 6:
            case "end":
              return _context5.stop();
          }
        }, _callee5, this);
      }));
    }
    /**
     * 修改本地摄像头预览的 HTML 元素，小程序不支持
     * @category 视频
     */
  }, {
    key: "updateLocalView",
    value: function updateLocalView(view) {
      logger.info('updateLocalView with options: ', view);
      if (view !== null) {
        this.startLocalPreview();
        return;
      }
      this.stopLocalPreview();
    }
    /**
     * 暂停/恢复发布本地的视频流
     * @category 视频
     * @param  {boolean} mute true：屏蔽；false：开启，默认值：false
     * @param {TRTCVideoStreamType} streamType 要暂停/恢复的视频流类型, 仅支持 TRTCVideoStreamTypeBig 和 TRTCVideoStreamTypeSub
     */
  }, {
    key: "muteLocalVideo",
    value: function muteLocalVideo(mute, streamType) {
      return __awaiter(this, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee6() {
        return _regeneratorRuntime().wrap(function _callee6$(_context6) {
          while (1) switch (_context6.prev = _context6.next) {
            case 0:
              logger.info('muteLocalVideo called with options: ', mute, streamType);
              if (this.isOpenCamera) {
                _context6.next = 4;
                break;
              }
              logger.info('muteLocalVideo early exit: isOpenCamera is false');
              return _context6.abrupt("return");
            case 4:
              _context6.t0 = streamType;
              _context6.next = _context6.t0 === exports.TRTCVideoStreamType.TRTCVideoStreamTypeBig ? 7 : _context6.t0 === exports.TRTCVideoStreamType.TRTCVideoStreamTypeSub ? 7 : 20;
              break;
            case 7:
              this.isVideoMuted = mute;
              logger.info('muteLocalVideo: isVideoMuted set to ', mute);
              _context6.prev = 9;
              _context6.next = 12;
              return this.setAttributes({
                params: {
                  videoPreview: mute,
                  enableCamera: !mute
                }
              }, 'muteLocalVideo');
            case 12:
              logger.info('muteLocalVideo: setAttributes success');
              _context6.next = 18;
              break;
            case 15:
              _context6.prev = 15;
              _context6.t1 = _context6["catch"](9);
              logger.error('muteLocalVideo: setAttributes failed with error ', _context6.t1);
            case 18:
              logger.info('muteLocalVideo success');
              return _context6.abrupt("break", 21);
            case 20:
              logger.info('muteLocalVideo: streamType not supported ', streamType);
            case 21:
            case "end":
              return _context6.stop();
          }
        }, _callee6, this, [[9, 15]]);
      }));
    }
    /**
     * 开始显示远端视频画面
     * @category 视频
     * @param userId 对方的用户标识
     * @param view 此参数无效，小程序不支持
     * @param streamType 视频流类型
     */
  }, {
    key: "startRemoteView",
    value: function startRemoteView(userId, view, streamType) {
      return __awaiter(this, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee7() {
        var streamId;
        return _regeneratorRuntime().wrap(function _callee7$(_context7) {
          while (1) switch (_context7.prev = _context7.next) {
            case 0:
              logger.info('startRemoteView with options: ', userId, view, streamType);
              streamId = translateTRTCStreamId(userId, streamType); // trtc
              this.renderMap.set(streamId, view);
              _context7.next = 5;
              return this.setAttributes({
                params: {
                  muteVideo: false,
                  stopVideo: false
                },
                streamId: streamId,
                view: view
              }, 'startRemoteView');
            case 5:
              this.updateAudioRoute();
              logger.info('startRemoteView success');
              this.emit('onFirstVideoFrame', userId, streamType, 0, 0);
            case 8:
            case "end":
              return _context7.stop();
          }
        }, _callee7, this);
      }));
    }
    /**
     * 停止显示远端视频画面，同时不再拉取该远端用户的视频数据流
     * @param userId 对方的用户标识
     * @param streamType 视频流类型
     */
  }, {
    key: "stopRemoteView",
    value: function stopRemoteView(userId, streamType) {
      return __awaiter(this, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee8() {
        var streamId;
        return _regeneratorRuntime().wrap(function _callee8$(_context8) {
          while (1) switch (_context8.prev = _context8.next) {
            case 0:
              logger.info('stopRemoteView with options: ', userId, streamType);
              streamId = translateTRTCStreamId(userId, streamType);
              _context8.next = 4;
              return this.setAttributes({
                params: {
                  muteVideo: true,
                  stopVideo: true
                },
                streamId: streamId,
                view: this.renderMap.get(streamId)
              }, 'stopRemoteView');
            case 4:
              logger.info('stopRemoteView success');
            case 5:
            case "end":
              return _context8.stop();
          }
        }, _callee8, this);
      }));
    }
    /**
     * 修改远端视频渲染的 HTML 元素，小程序不支持
     * @param userId 远端视频流的用户 ID
     * @param view
     * 接受远端视频流渲染的 HTML 元素，传入 null 结束远端视频的渲染
     * - 传入的 HTML 元素必须时块元素，例如：div
     * @param streamType
     * @returns
     */
  }, {
    key: "updateRemoteView",
    value: function updateRemoteView(userId, view, streamType) {
      return __awaiter(this, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee9() {
        return _regeneratorRuntime().wrap(function _callee9$(_context9) {
          while (1) switch (_context9.prev = _context9.next) {
            case 0:
              logger.info('updateRemoteView with options: ', userId, view, streamType);
              if (!(view !== null)) {
                _context9.next = 5;
                break;
              }
              _context9.next = 4;
              return this.startRemoteView(userId, view, streamType);
            case 4:
              return _context9.abrupt("return");
            case 5:
              _context9.next = 7;
              return this.stopRemoteView(userId, streamType);
            case 7:
            case "end":
              return _context9.stop();
          }
        }, _callee9, this);
      }));
    }
    // 停止显示所有远端视频画面，同时不再拉取该远端用户的视频数据流
  }, {
    key: "stopAllRemoteView",
    value: function stopAllRemoteView() {
      return __awaiter(this, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee11() {
        var _this9 = this;
        var playerList;
        return _regeneratorRuntime().wrap(function _callee11$(_context11) {
          while (1) switch (_context11.prev = _context11.next) {
            case 0:
              logger.info('stopAllRemoteView');
              playerList = this.trtc.getPlayerList();
              playerList.forEach(function (player) {
                return __awaiter(_this9, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee10() {
                  var streamId;
                  return _regeneratorRuntime().wrap(function _callee10$(_context10) {
                    while (1) switch (_context10.prev = _context10.next) {
                      case 0:
                        streamId = player.streamID;
                        _context10.next = 3;
                        return this.setAttributes({
                          params: {
                            muteVideo: true,
                            stopVideo: true
                          },
                          streamId: streamId,
                          view: this.renderMap.get(streamId)
                        }, 'stopAllRemoteView');
                      case 3:
                      case "end":
                        return _context10.stop();
                    }
                  }, _callee10, this);
                }));
              });
              logger.info('stopAllRemoteView success');
            case 4:
            case "end":
              return _context11.stop();
          }
        }, _callee11, this);
      }));
    }
    // 暂停接收指定的远端视频流
    // 该接口仅停止接收远程用户的视频流，但并不释放显示资源，所以视频画面会冻屏在 mute 前的最后一帧。
  }, {
    key: "muteRemoteVideoStream",
    value: function muteRemoteVideoStream(userId, mute, streamType) {
      return __awaiter(this, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee12() {
        var streamId;
        return _regeneratorRuntime().wrap(function _callee12$(_context12) {
          while (1) switch (_context12.prev = _context12.next) {
            case 0:
              logger.info('muteRemoteVideoStream');
              streamId = translateTRTCStreamId(userId, streamType);
              _context12.next = 4;
              return this.setAttributes({
                params: {
                  muteVideo: mute
                },
                streamId: streamId,
                view: this.renderMap.get(streamId)
              }, 'muteRemoteVideoStream');
            case 4:
              logger.info('muteRemoteVideoStream success');
            case 5:
            case "end":
              return _context12.stop();
          }
        }, _callee12, this);
      }));
    }
  }, {
    key: "muteAllRemoteVideoStreams",
    value: function muteAllRemoteVideoStreams(mute) {
      return __awaiter(this, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee14() {
        var _this10 = this;
        var playerList;
        return _regeneratorRuntime().wrap(function _callee14$(_context14) {
          while (1) switch (_context14.prev = _context14.next) {
            case 0:
              logger.info('muteAllRemoteVideoStreams with options: ', mute);
              playerList = this.trtc.getPlayerList();
              playerList.forEach(function (player) {
                return __awaiter(_this10, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee13() {
                  var streamId;
                  return _regeneratorRuntime().wrap(function _callee13$(_context13) {
                    while (1) switch (_context13.prev = _context13.next) {
                      case 0:
                        streamId = player.streamID;
                        _context13.next = 3;
                        return this.setAttributes({
                          params: {
                            muteVideo: mute
                          },
                          streamId: streamId,
                          view: this.renderMap.get(streamId)
                        }, 'muteAllRemoteVideoStreams');
                      case 3:
                      case "end":
                        return _context13.stop();
                    }
                  }, _callee13, this);
                }));
              });
              logger.info('muteAllRemoteVideoStreams success');
            case 4:
            case "end":
              return _context14.stop();
          }
        }, _callee14, this);
      }));
    }
  }, {
    key: "setTRTCPlayerAttributes",
    value: function setTRTCPlayerAttributes(streamId, options) {
      var _a;
      logger.info('setTRTCPlayerAttributes with options: ', streamId, options);
      this.trtc.setPlayerAttributes(streamId, options);
      return ((_a = this.trtc.getPlayerInstance(streamId)) === null || _a === void 0 ? void 0 : _a.playerAttributes) || {};
    }
  }, {
    key: "setVideoEncoderParam",
    value: function setVideoEncoderParam(params) {
      return __awaiter(this, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee15() {
        var videoResolution, videoFps, minVideoBitrate, _translateTRTCVideoRe, videoWidth, videoHeight;
        return _regeneratorRuntime().wrap(function _callee15$(_context15) {
          while (1) switch (_context15.prev = _context15.next) {
            case 0:
              logger.info('setVideoEncoderParam with options: ', JSON.stringify(params));
              videoResolution = params.videoResolution, params.resMode, videoFps = params.videoFps, params.videoBitrate, minVideoBitrate = params.minVideoBitrate;
              _translateTRTCVideoRe = translateTRTCVideoResolution(videoResolution), videoWidth = _translateTRTCVideoRe.videoWidth, videoHeight = _translateTRTCVideoRe.videoHeight;
              _context15.next = 5;
              return this.setAttributes({
                params: {
                  videoWidth: videoWidth,
                  videoHeight: videoHeight,
                  // videoOrientation,
                  fps: videoFps,
                  minBitrate: minVideoBitrate
                }
              }, 'setVideoEncoderParam');
            case 5:
              logger.info('setVideoEncoderParam success');
            case 6:
            case "end":
              return _context15.stop();
          }
        }, _callee15, this);
      }));
    }
  }, {
    key: "setLocalRenderParams",
    value: function setLocalRenderParams(params) {
      return __awaiter(this, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee16() {
        var rotation, mirrorType, videoOrientation, localMirror;
        return _regeneratorRuntime().wrap(function _callee16$(_context16) {
          while (1) switch (_context16.prev = _context16.next) {
            case 0:
              logger.info('setLocalRenderParams with options: ', JSON.stringify(params));
              rotation = params.rotation, params.fillMode, mirrorType = params.mirrorType;
              videoOrientation = translateTRTCVideoRotation(rotation);
              localMirror = translateTRTCVideoMirrorType(mirrorType);
              _context16.next = 6;
              return this.setAttributes({
                params: {
                  videoOrientation: videoOrientation,
                  localMirror: localMirror
                }
              }, 'setLocalRenderParams');
            case 6:
              logger.info('setLocalRenderParams success');
            case 7:
            case "end":
              return _context16.stop();
          }
        }, _callee16, this);
      }));
    }
    /**
     * 设置远端图像的渲染模式
     * @param {string} userId
     * @param {TRTCVideoStreamType} streamType
     * @param {TRTCRenderParams} params
     */
  }, {
    key: "setRemoteRenderParams",
    value: function setRemoteRenderParams(userId, streamType, params) {
      return __awaiter(this, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee17() {
        var fillMode, rotation, streamId;
        return _regeneratorRuntime().wrap(function _callee17$(_context17) {
          while (1) switch (_context17.prev = _context17.next) {
            case 0:
              logger.info('setRemoteRenderParams with options: ', userId, streamType, JSON.stringify(params));
              fillMode = params.fillMode, rotation = params.rotation, params.mirrorType;
              streamId = translateTRTCStreamId(userId, streamType); // 音频默认都是主流
              _context17.next = 5;
              return this.setAttributes({
                params: {
                  objectFit: translateVideoFillMod(fillMode),
                  orientation: translateTRTCVideoRotation(rotation)
                },
                streamId: streamId,
                view: this.renderMap.get(streamId)
              }, 'setRemoteRenderParams');
            case 5:
              logger.info('setRemoteRenderParams success');
            case 6:
            case "end":
              return _context17.stop();
          }
        }, _callee17, this);
      }));
    }
  }, {
    key: "startLocalAudio",
    value: function startLocalAudio(quality) {
      return __awaiter(this, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee18() {
        var getAudioQuality;
        return _regeneratorRuntime().wrap(function _callee18$(_context18) {
          while (1) switch (_context18.prev = _context18.next) {
            case 0:
              logger.info('startLocalAudio with options: ', quality);
              if (!(this.role !== exports.TRTCRoleType.TRTCRoleAnchor)) {
                _context18.next = 3;
                break;
              }
              throw new Error('Current role is audience, unable to access mic. Call switchRole to become a host.');
            case 3:
              getAudioQuality = function getAudioQuality(quality) {
                if (quality === exports.TRTCAudioQuality.TRTCAudioQualitySpeech) {
                  return 'low';
                }
                return 'high';
              };
              _context18.next = 6;
              return this.setAttributes({
                params: {
                  enableMic: true,
                  audioQuality: getAudioQuality(quality)
                }
              }, 'startLocalAudio');
            case 6:
              logger.info('startLocalAudio success');
              this.emit('onMicDidReady');
              if (this.enterRoom) {
                this.emit('onSendFirstLocalAudioFrame');
              }
            case 9:
            case "end":
              return _context18.stop();
          }
        }, _callee18, this);
      }));
    }
  }, {
    key: "stopLocalAudio",
    value: function stopLocalAudio() {
      return __awaiter(this, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee19() {
        return _regeneratorRuntime().wrap(function _callee19$(_context19) {
          while (1) switch (_context19.prev = _context19.next) {
            case 0:
              logger.info('stopLocalAudio');
              _context19.next = 3;
              return this.setAttributes({
                params: {
                  enableMic: false
                }
              }, 'stopLocalAudio');
            case 3:
              logger.info('stopLocalAudio success');
            case 4:
            case "end":
              return _context19.stop();
          }
        }, _callee19, this);
      }));
    }
  }, {
    key: "muteLocalAudio",
    value: function muteLocalAudio(mute) {
      return __awaiter(this, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee20() {
        return _regeneratorRuntime().wrap(function _callee20$(_context20) {
          while (1) switch (_context20.prev = _context20.next) {
            case 0:
              logger.info('muteLocalAudio called with options: ', mute);
              _context20.prev = 1;
              _context20.next = 4;
              return this.setAttributes({
                params: {
                  muted: mute
                }
              }, 'muteLocalAudio');
            case 4:
              logger.info('setAttributes executed successfully');
              _context20.next = 11;
              break;
            case 7:
              _context20.prev = 7;
              _context20.t0 = _context20["catch"](1);
              logger.error('Error in setAttributes: ', _context20.t0);
              throw _context20.t0;
            case 11:
              _context20.prev = 11;
              this.emit('onUserAudioAvailable', this.userId, mute === true ? 0 : 1);
              logger.info('onUserAudioAvailable event emitted successfully');
              _context20.next = 20;
              break;
            case 16:
              _context20.prev = 16;
              _context20.t1 = _context20["catch"](11);
              logger.error('Error in emitting onUserAudioAvailable event: ', _context20.t1);
              throw _context20.t1;
            case 20:
              logger.info('muteLocalAudio execution finished');
            case 21:
            case "end":
              return _context20.stop();
          }
        }, _callee20, this, [[1, 7], [11, 16]]);
      }));
    }
  }, {
    key: "setAudioRoute",
    value: function setAudioRoute(route) {
      return __awaiter(this, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee21() {
        var soundMode;
        return _regeneratorRuntime().wrap(function _callee21$(_context21) {
          while (1) switch (_context21.prev = _context21.next) {
            case 0:
              logger.info('setAudioRoute with options: ', route);
              this.currentSoundMode = route;
              soundMode = translateTRTCAudioRoute(route);
              _context21.prev = 3;
              _context21.next = 6;
              return this.playerAudioRouteChange({
                soundMode: soundMode
              });
            case 6:
              logger.info('setAudioRoute success');
              _context21.next = 13;
              break;
            case 9:
              _context21.prev = 9;
              _context21.t0 = _context21["catch"](3);
              logger.error('Error in setAttributes: ', _context21.t0);
              throw _context21.t0;
            case 13:
            case "end":
              return _context21.stop();
          }
        }, _callee21, this, [[3, 9]]);
      }));
    }
  }, {
    key: "updateAudioRoute",
    value: function updateAudioRoute() {
      return __awaiter(this, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee22() {
        var soundMode;
        return _regeneratorRuntime().wrap(function _callee22$(_context22) {
          while (1) switch (_context22.prev = _context22.next) {
            case 0:
              logger.info('updateAudioRoute with options: ', this.currentSoundMode);
              soundMode = translateTRTCAudioRoute(this.currentSoundMode);
              _context22.prev = 2;
              _context22.next = 5;
              return this.playerAudioRouteChange({
                soundMode: soundMode
              });
            case 5:
              _context22.next = 11;
              break;
            case 7:
              _context22.prev = 7;
              _context22.t0 = _context22["catch"](2);
              logger.error('Error in setAttributes: ', _context22.t0);
              throw _context22.t0;
            case 11:
            case "end":
              return _context22.stop();
          }
        }, _callee22, this, [[2, 7]]);
      }));
    }
  }, {
    key: "muteRemoteAudio",
    value: function muteRemoteAudio(userId, mute) {
      return __awaiter(this, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee23() {
        var streamId;
        return _regeneratorRuntime().wrap(function _callee23$(_context23) {
          while (1) switch (_context23.prev = _context23.next) {
            case 0:
              logger.info('muteRemoteAudio with options: ', userId, mute);
              streamId = translateTRTCStreamId(userId, exports.TRTCVideoStreamType.TRTCVideoStreamTypeBig); // 音频默认都是主流
              _context23.next = 4;
              return this.setAttributes({
                params: {
                  muteAudio: mute
                },
                streamId: streamId,
                view: this.renderMap.get(streamId)
              }, 'muteRemoteAudio');
            case 4:
              logger.info('muteRemoteAudio success');
            case 5:
            case "end":
              return _context23.stop();
          }
        }, _callee23, this);
      }));
    }
  }, {
    key: "muteAllRemoteAudio",
    value: function muteAllRemoteAudio(mute) {
      return __awaiter(this, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee25() {
        var _this11 = this;
        var playerList;
        return _regeneratorRuntime().wrap(function _callee25$(_context25) {
          while (1) switch (_context25.prev = _context25.next) {
            case 0:
              logger.info('muteAllRemoteAudio with options: ', mute);
              playerList = this.trtc.getPlayerList();
              playerList.forEach(function (player) {
                return __awaiter(_this11, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee24() {
                  var streamId;
                  return _regeneratorRuntime().wrap(function _callee24$(_context24) {
                    while (1) switch (_context24.prev = _context24.next) {
                      case 0:
                        streamId = player.streamID;
                        _context24.next = 3;
                        return this.setAttributes({
                          params: {
                            muteAudio: mute
                          },
                          streamId: streamId,
                          view: this.renderMap.get(streamId)
                        }, 'muteRemoteAudio');
                      case 3:
                      case "end":
                        return _context24.stop();
                    }
                  }, _callee24, this);
                }));
              });
              logger.info('muteAllRemoteAudio success');
            case 4:
            case "end":
              return _context25.stop();
          }
        }, _callee25, this);
      }));
    }
  }, {
    key: "enableAudioVolumeEvaluation",
    value: function enableAudioVolumeEvaluation(interval) {
      logger.info('enableAudioVolumeEvaluation with options: ', interval);
      this.handleAudioVolumeUpdate = this.getHandleAudioVolumeUpdate(interval);
    }
    /**
     * 切换前后摄像头
     */
  }, {
    key: "switchCamera",
    value: function switchCamera(frontCamera) {
      var _this12 = this;
      logger.info('switchCamera with options: ', frontCamera);
      var pusher = this.trtc.getPusherInstance();
      if (frontCamera === (pusher.pusherAttributes.frontCamera === 'front')) return Promise.resolve();
      return new Promise(function (resolve, reject) {
        wx.createLivePusherContext().switchCamera({
          success: function success(event) {
            return __awaiter(_this12, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee26() {
              return _regeneratorRuntime().wrap(function _callee26$(_context26) {
                while (1) switch (_context26.prev = _context26.next) {
                  case 0:
                    _context26.next = 2;
                    return this.setAttributes({
                      params: {
                        frontCamera: frontCamera ? 'front' : 'back'
                      }
                    }, 'switchCamera');
                  case 2:
                    logger.info('switchCamera success');
                    resolve(event);
                  case 4:
                  case "end":
                    return _context26.stop();
                }
              }, _callee26, this);
            }));
          },
          fail: function fail(error) {
            logger.info('switchCamera fail');
            reject(error);
          }
        });
      });
    }
  }, {
    key: "setBeautyStyle",
    value: function setBeautyStyle(style, beauty, white, ruddiness) {
      return __awaiter(this, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee27() {
        return _regeneratorRuntime().wrap(function _callee27$(_context27) {
          while (1) switch (_context27.prev = _context27.next) {
            case 0:
              logger.info('setBeautyStyle with options: ', style, beauty, white, ruddiness);
              _context27.next = 3;
              return this.setAttributes({
                params: {
                  beautyStyle: translateBeautyStyle(style),
                  beautyLevel: beauty,
                  whitenessLevel: white
                }
              }, 'setBeautyStyle');
            case 3:
              logger.info('setBeautyStyle success');
            case 4:
            case "end":
              return _context27.stop();
          }
        }, _callee27, this);
      }));
    }
  }, {
    key: "sendSEIMsg",
    value: function sendSEIMsg(msg) {
      var repeatCount = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1;
      logger.info('sendSEIMsg with options: ', msg, repeatCount);
      return new Promise(function (resolve, reject) {
        wx.createLivePusherContext().sendMessage({
          msg: msg,
          success: function success(event) {
            logger.info('sendSEIMsg success');
            resolve(event);
          },
          fail: function fail(error) {
            logger.info('sendSEIMsg fail');
            reject(error);
          }
        });
      });
    }
  }, {
    key: "startPlayMusic",
    value: function startPlayMusic(musicParam, callbackMap) {
      logger.info('startPlayMusic with options: ', JSON.stringify(musicParam));
      return new Promise(function (resolve, reject) {
        var path = musicParam.path,
          _musicParam$startTime = musicParam.startTimeMS,
          startTimeMS = _musicParam$startTime === void 0 ? 0 : _musicParam$startTime,
          _musicParam$endTimeMS = musicParam.endTimeMS,
          endTimeMS = _musicParam$endTimeMS === void 0 ? 0 : _musicParam$endTimeMS;
        wx.createLivePusherContext().playBGM({
          url: path,
          startTimeMs: startTimeMS,
          endTimeMs: endTimeMS,
          success: function success(event) {
            logger.info('startPlayMusic success');
            resolve(event);
          },
          fail: function fail(error) {
            logger.info('startPlayMusic fail');
            reject(error);
          }
        });
      });
    }
  }, {
    key: "stopPlayMusic",
    value: function stopPlayMusic() {
      logger.info('stopPlayMusic');
      return new Promise(function (resolve, reject) {
        wx.createLivePusherContext().stopBGM({
          success: function success(event) {
            logger.info('stopPlayMusic success');
            resolve(event);
          },
          fail: function fail(error) {
            logger.info('stopPlayMusic fail');
            reject(error);
          }
        });
      });
    }
  }, {
    key: "pausePlayMusic",
    value: function pausePlayMusic() {
      logger.info('pausePlayMusic');
      return new Promise(function (resolve, reject) {
        wx.createLivePusherContext().pauseBGM({
          success: function success(event) {
            logger.info('pausePlayMusic success');
            resolve(event);
          },
          fail: function fail(error) {
            logger.info('pausePlayMusic fail');
            reject(error);
          }
        });
      });
    }
  }, {
    key: "resumePlayMusic",
    value: function resumePlayMusic() {
      logger.info('resumePlayMusic');
      return new Promise(function (resolve, reject) {
        wx.createLivePusherContext().resumeBGM({
          success: function success(event) {
            logger.info('resumePlayMusic success');
            resolve(event);
          },
          fail: function fail(error) {
            logger.info('resumePlayMusic fail');
            reject(error);
          }
        });
      });
    }
    // 设置背景音乐的音量大小，播放背景音乐混音时使用，用来控制背景音音量大小
  }, {
    key: "setAllMusicVolume",
    value: function setAllMusicVolume(volume) {
      logger.info('setAllMusicVolume with options: ', volume);
      return new Promise(function (resolve, reject) {
        var volumeStr = (volume / 200).toString();
        wx.createLivePusherContext().setBGMVolume({
          volume: volumeStr,
          success: function success(event) {
            logger.info('setAllMusicVolume success');
            resolve(event);
          },
          fail: function fail(error) {
            logger.info('setAllMusicVolume fail');
            reject(error);
          }
        });
      });
    }
    // 开启大小画面双路编码模式
  }, {
    key: "enableSmallVideoStream",
    value: function enableSmallVideoStream(enable, params) {
      logger.info('enableSmallVideoStream with options: ', enable, JSON.stringify(params));
      this.encsmall = enable ? 1 : 0;
    }
    /**
     * 调用实验性 API 接口
     *
     * 注意：该接口用于调用一些实验性功能, 目前 web 端空实现
     *
     * @param {String} jsonStr - 接口及参数描述的 JSON 字符串
     */
  }, {
    key: "callExperimentalAPI",
    value: function callExperimentalAPI(jsonStr) {
      logger.info('callExperimentalAPI with options: ', jsonStr);
      var jsonObj = safelyParse(jsonStr);
      if (jsonObj === jsonStr) {
        return;
      }
      var api = jsonObj.api,
        params = jsonObj.params;
      if (!api || !params) {
        return;
      }
      switch (api) {
        case 'setFramework':
          this.handleSetFrameWork(params);
          break;
        case 'enableInfiniteAnchor':
          this.enableinfiniteanchor = (params === null || params === void 0 ? void 0 : params.enable) ? 1 : 0;
          break;
      }
    }
  }, {
    key: "handleSetFrameWork",
    value: function handleSetFrameWork(params) {
      var component = params.component;
      if (isNumber(component)) {
        try {
          if (wx) {
            wx.TUIScene = component;
            wx.setStorageSync('TUIScene', String(component));
          }
        } catch (err) {
          throw err;
        }
      }
    }
  }, {
    key: "pusherAttributesChange",
    value: function pusherAttributesChange(pusher) {
      var _this13 = this;
      return new Promise(function (resolve) {
        _this13.InterfaceEventEmitter.emit('pusherAttributesChange', {
          pusher: pusher,
          callback: function callback() {
            resolve(pusher);
          }
        });
      });
    }
  }, {
    key: "playerAttributesChange",
    value: function playerAttributesChange(params) {
      var _this14 = this;
      var streamId = params.streamId,
        playerAttributes = params.playerAttributes;
      return new Promise(function (resolve) {
        _this14.InterfaceEventEmitter.emit('playerAttributesChange', {
          streamId: streamId,
          view: _this14.renderMap.get(streamId),
          playerAttributes: playerAttributes,
          callback: function callback() {
            resolve(playerAttributes);
          }
        });
      });
    }
  }, {
    key: "playerAudioRouteChange",
    value: function playerAudioRouteChange(params) {
      var _this15 = this;
      var soundMode = params.soundMode;
      return new Promise(function (resolve) {
        _this15.InterfaceEventEmitter.emit('playerAudioRouteChange', {
          soundMode: soundMode,
          callback: function callback() {
            resolve(soundMode);
          }
        });
      });
    }
  }, {
    key: "setAttributes",
    value: function setAttributes(options, funName, handleType) {
      return __awaiter(this, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee30() {
        var _this16 = this,
          _handleMap;
        var params, streamId, handleMap, timeoutDuration, retriesNumber;
        return _regeneratorRuntime().wrap(function _callee30$(_context30) {
          while (1) switch (_context30.prev = _context30.next) {
            case 0:
              params = options.params, streamId = options.streamId;
              handleMap = (_handleMap = {}, _defineProperty(_handleMap, Handletype.setPlayer, function () {
                return __awaiter(_this16, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee28() {
                  var playerAttributes;
                  return _regeneratorRuntime().wrap(function _callee28$(_context28) {
                    while (1) switch (_context28.prev = _context28.next) {
                      case 0:
                        _context28.next = 2;
                        return this.playerAttributesChange({
                          playerAttributes: this.setTRTCPlayerAttributes(streamId, params),
                          streamId: streamId
                        });
                      case 2:
                        playerAttributes = _context28.sent;
                        return _context28.abrupt("return", playerAttributes);
                      case 4:
                      case "end":
                        return _context28.stop();
                    }
                  }, _callee28, this);
                }));
              }), _defineProperty(_handleMap, Handletype.setPusher, function () {
                return __awaiter(_this16, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee29() {
                  var _pusher, pusher;
                  return _regeneratorRuntime().wrap(function _callee29$(_context29) {
                    while (1) switch (_context29.prev = _context29.next) {
                      case 0:
                        if (!(funName === 'enterRoom')) {
                          _context29.next = 5;
                          break;
                        }
                        _context29.next = 3;
                        return this.pusherAttributesChange(this.trtc.enterRoom(params));
                      case 3:
                        _pusher = _context29.sent;
                        return _context29.abrupt("return", _pusher);
                      case 5:
                        _context29.next = 7;
                        return this.pusherAttributesChange(this.trtc.setPusherAttributes(params));
                      case 7:
                        pusher = _context29.sent;
                        return _context29.abrupt("return", pusher);
                      case 9:
                      case "end":
                        return _context29.stop();
                    }
                  }, _callee29, this);
                }));
              }), _handleMap); // 定义一个超时时间（以毫秒为单位）
              timeoutDuration = 2000; // 定义超时重试次数
              retriesNumber = 3;
              return _context30.abrupt("return", this.retryWithTimeout(function () {
                return handleMap[handleType] ? handleMap[handleType]() : Promise.reject(Object.assign(new Error('setAttributes fail'), {
                  errorCode: -1
                }));
              }, timeoutDuration, retriesNumber));
            case 5:
            case "end":
              return _context30.stop();
          }
        }, _callee30, this);
      }));
    }
  }, {
    key: "retryWithTimeout",
    value: function retryWithTimeout(fn, timeout, retries) {
      return __awaiter(this, void 0, void 0, /*#__PURE__*/_regeneratorRuntime().mark(function _callee31() {
        var lastError, i, result;
        return _regeneratorRuntime().wrap(function _callee31$(_context31) {
          while (1) switch (_context31.prev = _context31.next) {
            case 0:
              lastError = null;
              i = 0;
            case 2:
              if (!(i < retries)) {
                _context31.next = 19;
                break;
              }
              _context31.prev = 3;
              logger.info("setAttributes ".concat(i + 1, "st retry"));
              _context31.next = 7;
              return Promise.race([fn(), new Promise(function (resolve, reject) {
                return setTimeout(function () {
                  return reject(new Error('setAttributes timed out'));
                }, timeout);
              })]);
            case 7:
              result = _context31.sent;
              return _context31.abrupt("return", result);
            case 11:
              _context31.prev = 11;
              _context31.t0 = _context31["catch"](3);
              if (!((_context31.t0 === null || _context31.t0 === void 0 ? void 0 : _context31.t0.errorCode) === -1)) {
                _context31.next = 15;
                break;
              }
              return _context31.abrupt("return", _context31.t0);
            case 15:
              lastError = _context31.t0;
            case 16:
              i++;
              _context31.next = 2;
              break;
            case 19:
              throw lastError;
            case 20:
            case "end":
              return _context31.stop();
          }
        }, _callee31, null, [[3, 11]]);
      }));
    }
  }], [{
    key: "getTRTCShareInstance",
    value: function getTRTCShareInstance() {
      if (!TRTCCloud.instance) {
        TRTCCloud.instance = new TRTCCloud();
      }
      return TRTCCloud.instance;
    }
    /**
     * 销毁 TRTCCloud 实例（单例模式）
     * @category Base
     */
  }, {
    key: "destroyTRTCShareInstance",
    value: function destroyTRTCShareInstance() {
      if (!TRTCCloud.instance) return;
      TRTCCloud.instance.destroy();
      TRTCCloud.instance = null;
    }
  }]);
  return TRTCCloud;
}();
__decorate([setHandle], TRTCCloud.prototype, "setAttributes", null);

exports.TRTCCloud = TRTCCloud;
exports.default = TRTCCloud;
exports.translateBeautyStyle = translateBeautyStyle;
exports.translateTRTCAppScene = translateTRTCAppScene;
exports.translateTRTCAudioRoute = translateTRTCAudioRoute;
exports.translateTRTCStreamId = translateTRTCStreamId;
exports.translateTRTCVideoMirrorType = translateTRTCVideoMirrorType;
exports.translateTRTCVideoResolution = translateTRTCVideoResolution;
exports.translateTRTCVideoResolutionMode = translateTRTCVideoResolutionMode;
exports.translateTRTCVideoRotation = translateTRTCVideoRotation;
exports.translateTRTCVideoStreamType = translateTRTCVideoStreamType;
exports.translateVideoFillMod = translateVideoFillMod;

}, function(modId) {var map = {}; return __REQUIRE__(map[modId], modId); })
return __REQUIRE__(1788161987520);
})()
//miniprogram-npm-outsideDeps=["eventemitter3","trtc-wx-sdk"]
//# sourceMappingURL=index.js.map