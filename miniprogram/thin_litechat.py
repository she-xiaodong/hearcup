# -*- coding: utf-8 -*-
"""
thin_litechat.py —— 「构建 npm」后裁掉 lite-chat 冗余变体。

为什么需要：@tencentcloud/lite-chat 的 miniprogram 字段指向整个目录，
微信「构建 npm」会把 node.js / professional.js / standard.js / plugins / *.d.ts
等 5.6M 冗余变体全部带进主包，导致主包超 2M 限制。

用法（在微信开发者工具「构建 npm」之后运行一次）：
    python thin_litechat.py
"""
import os, shutil, json

BASE = os.path.dirname(os.path.abspath(__file__))
LITE_CHAT = os.path.join(BASE, 'miniprogram_npm', '@tencentcloud', 'lite-chat')

KEEP = {'basic.js', 'package.json'}  # basic.js 自包含无 require，TUICallKit 只用到它

def main():
    if not os.path.isdir(LITE_CHAT):
        print('未找到', LITE_CHAT)
        print('请先在微信开发者工具执行「工具 → 构建 npm」')
        return 1

    removed = []
    for name in os.listdir(LITE_CHAT):
        if name in KEEP:
            continue
        p = os.path.join(LITE_CHAT, name)
        if os.path.isdir(p):
            shutil.rmtree(p)
        else:
            os.remove(p)
        removed.append(name)

    pkg = os.path.join(LITE_CHAT, 'package.json')
    if os.path.exists(pkg):
        with open(pkg, 'r', encoding='utf-8') as f:
            d = json.load(f)
        d['main'] = 'basic.js'
        d.pop('miniprogram', None)
        with open(pkg, 'w', encoding='utf-8') as f:
            json.dump(d, f, ensure_ascii=False)

    print('已删除', len(removed), '个冗余项:', removed)
    print('package.json main 已指向 basic.js')
    print('瘦身完成。请回到微信开发者工具「重新编译」。')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
