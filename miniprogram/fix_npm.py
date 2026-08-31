# -*- coding: utf-8 -*-
"""
fix_npm.py —— 微信开发者工具「构建 npm」之后的一站式后处理脚本。

作用（缺一不可，否则编译/真机会报错）：
  1. lite-chat 瘦身：@tencentcloud/lite-chat 的 miniprogram 指向整个目录，
     构建后会把 node/professional/standard/plugins 等 5.6M 冗余带进主包导致超 2M，
     这里裁到只剩自包含的 basic.js（约 253K）。
  2. 裸包名 require 改相对路径：微信「构建 npm」只保证 miniprogram_npm 内部的
     模块注册，但不解析 TUICallKit(vendor 源码) 以及 miniprogram_npm 内部包之间的
     require('@trtc/xxx') / require('xxx') 这类裸包名（会退化当成相对路径，报
     "module ... is not defined"）。这里把它们统一改成相对路径直接指向目标文件。

用法（构建 npm 之后、重新编译之前运行一次）：
    python fix_npm.py
幂等：可重复运行，结果一致。
"""
import os, io, json, shutil

BASE = os.path.dirname(os.path.abspath(__file__))


def thin_litechat():
    d = os.path.join(BASE, 'miniprogram_npm', '@tencentcloud', 'lite-chat')
    if not os.path.isdir(d):
        print('[跳过] 未找到 lite-chat')
        return
    removed = []
    for name in os.listdir(d):
        if name in ('basic.js', 'package.json'):
            continue
        p = os.path.join(d, name)
        if os.path.isdir(p):
            shutil.rmtree(p)
        else:
            os.remove(p)
        removed.append(name)
    pkg = os.path.join(d, 'package.json')
    if os.path.exists(pkg):
        # binary 读写，避免 Windows text 模式把 LF 转成 CRLF（会让微信编译器崩溃）
        data = json.load(open(pkg, 'rb'))
        data['main'] = 'basic.js'
        for k in ('miniprogram', 'exports', 'types'):
            data.pop(k, None)
        open(pkg, 'wb').write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
    print('[瘦身] 删除', len(removed), '个冗余项，lite-chat main -> basic.js')


def rewrite(path, pairs):
    if not os.path.exists(path):
        print('  缺失', path)
        return
    # binary 读写：保持原换行符（LF），避免 Windows 下转成 CRLF 导致微信编译器崩溃
    c = open(path, 'rb').read().decode('utf-8')
    changed = 0
    for old, new in pairs:
        n = c.count(old)
        if n:
            c = c.replace(old, new)
            changed += n
    open(path, 'wb').write(c.encode('utf-8'))
    print('  改写', os.path.relpath(path, BASE), '共', changed, '处')


def fix_vendor():
    """TUICallKit vendor 源码里的裸包名 require -> 相对路径"""
    base = os.path.join(BASE, 'TUICallKit', 'TUICallService', 'CallService')
    p = '../../../miniprogram_npm/'
    jobs = {
        'chatCombine.js': [
            ('require("@tencentcloud/tui-core-lite")', 'require("' + p + '@tencentcloud/tui-core-lite/index.js")'),
            ('require("@tencentcloud/lite-chat/basic")', 'require("' + p + '@tencentcloud/lite-chat/basic.js")'),
        ],
        'engineEventHandler.js': [
            ('require("@trtc/call-engine-lite-wx")', 'require("' + p + '@trtc/call-engine-lite-wx/index.js")'),
        ],
        'index.js': [
            ('require("@trtc/call-engine-lite-wx")', 'require("' + p + '@trtc/call-engine-lite-wx/index.js")'),
        ],
    }
    print('[vendor] TUICallKit 内部 require -> 相对路径')
    for fn, pairs in jobs.items():
        rewrite(os.path.join(base, fn), pairs)


def fix_npm_internal():
    """miniprogram_npm 内部包之间的裸包名 require -> 相对路径"""
    jobs = {
        'miniprogram_npm/@tencentcloud/trtc-cloud-wx/index.js': [
            ("require('eventemitter3')", "require('../../eventemitter3/index.js')"),
            ("require('trtc-wx-sdk')", "require('../../trtc-wx-sdk/index.js')"),
        ],
        'miniprogram_npm/@tencentcloud/trtc-component-wx/index.js': [
            ('require("@tencentcloud/trtc-cloud-wx")', 'require("../trtc-cloud-wx/index.js")'),
        ],
        'miniprogram_npm/@tencentcloud/trtc-component-wx/trtc-player.js': [
            ('require("@tencentcloud/trtc-cloud-wx")', 'require("../trtc-cloud-wx/index.js")'),
        ],
        'miniprogram_npm/@tencentcloud/trtc-component-wx/trtc-pusher.js': [
            ('require("@tencentcloud/trtc-cloud-wx")', 'require("../trtc-cloud-wx/index.js")'),
        ],
        'miniprogram_npm/@tencentcloud/tui-core-lite/index.js': [
            ("require('@tencentcloud/lite-chat/basic')", "require('../lite-chat/basic.js')"),
        ],
        'miniprogram_npm/@trtc/call-engine-lite-wx/index.js': [
            ('require("@tencentcloud/lite-chat/basic")', 'require("../../@tencentcloud/lite-chat/basic.js")'),
            ('require("@tencentcloud/trtc-component-wx")', 'require("../../@tencentcloud/trtc-component-wx/index.js")'),
        ],
    }
    print('[npm-internal] miniprogram_npm 包间 require -> 相对路径')
    for path, pairs in jobs.items():
        rewrite(os.path.join(BASE, path), pairs)


def main():
    thin_litechat()
    fix_vendor()
    fix_npm_internal()
    print('fix_npm.py 完成。回到微信开发者工具「重新编译」。')


if __name__ == '__main__':
    main()
