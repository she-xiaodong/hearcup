import json, urllib.request, urllib.error, time

BASE = "http://localhost:8099"
TS = str(int(time.time()))  # 每次运行用唯一用户码，避免状态污染

def req(method, path, body=None, token=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", "Bearer " + token)
    try:
        resp = urllib.request.urlopen(r, timeout=5)
        return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")
    except Exception as e:
        return 0, {"error": str(e)}

def line(t): print("\n=== " + t + " ===")

results = []
def check(name, cond, detail=""):
    results.append((name, cond))
    print(("✅" if cond else "❌") + " " + name + (("  → " + detail) if detail else ""))

# 1. 登录（普通用户：小耳朵，余额 50）
line("1. 用户登录 auth/login")
s, d = req("POST", "/api/v1/auth/login", {"code": "openid_user_demo"})
UT = d.get("data", {}).get("token")
check("登录返回 token", bool(UT), str(d)[:80])
print("   用户:", d.get("data", {}).get("user", {}).get("nickname"), "余额", d.get("data", {}).get("user", {}).get("balance"))

# 2. 在线服务者列表
line("2. 在线服务者 providers/online")
s, d = req("GET", "/api/v1/providers/online")
lst = d.get("data", {}).get("list", [])
check("在线服务者数=2", d.get("data", {}).get("total") == 2, "total=%s" % d.get("data", {}).get("total"))
for p in lst:
    print("   -", p["real_name"], "角色", p["role"], "单价", p["price_per_minute"], "评分", p["rating"], "在线", p["is_online"])

# 3. 发起呼叫（倾听师 Lily id=1）
line("3. 发起呼叫 call/invite (provider_id=1, 语音)")
s, d = req("POST", "/api/v1/call/invite", {"provider_id": 1, "call_type": 1}, UT)
ROOM = d.get("data", {}).get("room_id")
check("返回 room_id", bool(ROOM), str(d.get("data", {}))[:60])
check("返回 user_sig/provider_sig", bool(d.get("data", {}).get("user_sig")) and bool(d.get("data", {}).get("provider_sig")))
# 余额应被冻结 3 元 → 47
s, d = req("GET", "/api/v1/user/balance", token=UT)
print("   冻结后余额:", d.get("data"))

# 4. 结束呼叫并计费
line("4. 结束呼叫 call/end (计费)")
s, d = req("POST", "/api/v1/call/end", {"room_id": ROOM}, UT)
print("   计费结果:", d.get("data"))
check("计费返回 amount", "amount" in d.get("data", {}), str(d.get("data")))

# 5. 评价
line("5. 评价 call/rating")
s, d = req("POST", "/api/v1/call/rating", {"room_id": ROOM, "rating": 5, "comment": "很治愈"}, UT)
check("评价成功", d.get("code") == 0, str(d))

# 6. 充值
line("6. 充值 recharge/create")
s, d = req("POST", "/api/v1/recharge/create", {"amount": 100}, UT)
check("充值成功", d.get("code") == 0, str(d.get("data", {}).get("order_no")))
s, d = req("GET", "/api/v1/user/balance", token=UT)
print("   充值后余额:", d.get("data"))

# 7. 服务者登录 + 状态（Lily）
line("7. 服务者状态 provider/status (Lily)")
s, d = req("POST", "/api/v1/auth/login", {"code": "openid_listener_lily"})
LT = d.get("data", {}).get("token")
s, d = req("GET", "/api/v1/provider/status", token=LT)
print("   Lily 状态:", d.get("data", {}).get("status"), "在线", d.get("data", {}).get("is_online"))
check("Lily 已通过审核(status=1)", d.get("data", {}).get("status") == 1)
# 收益明细（刚那通由 Lily 接听）
s, d = req("GET", "/api/v1/provider/earnings", token=LT)
print("   Lily 收益:", d.get("data", {}).get("total_earnings"), "可提现", d.get("data", {}).get("withdrawable"), "今日", d.get("data", {}).get("today_income"))

# 8. 新用户入驻申请（倾听师）
line("8. 入驻申请 provider/apply (新用户)")
s, d = req("POST", "/api/v1/auth/login", {"code": "openid_e2e_tester_" + TS})
NT = d.get("data", {}).get("token")
s, d = req("POST", "/api/v1/provider/apply", {
    "role": 1, "real_name": "测试员A" + TS, "phone": "13900000009",
    "intro": "我想成为一名倾听师，帮助更多人走出情绪低谷。",
    "expertise": "1,2,3", "certificates": "cert_a.jpg"
}, NT)
check("入驻提交成功(status=0待审核)", d.get("data", {}).get("status") == 0, str(d))
# 咨询师缺字段应失败
s, d = req("POST", "/api/v1/auth/login", {"code": "openid_e2e_counselor_" + TS})
CT = d.get("data", {}).get("token")
s, d = req("POST", "/api/v1/provider/apply", {
    "role": 2, "real_name": "咨询师B" + TS, "phone": "13900000010",
    "intro": "国家二级心理咨询师。", "expertise": "2,3"
}, CT)
check("咨询师缺证书字段被拒", d.get("code") == 1, str(d.get("msg")))

# 9. 管理员登录 + 看板
line("9. 管理员 admin/login + dashboard")
s, d = req("POST", "/api/v1/admin/login", {"username": "admin", "password": "admin123"})
AT = d.get("data", {}).get("token")
check("管理员登录", bool(AT), str(d.get("msg", "")))
s, d = req("GET", "/api/v1/admin/dashboard", token=AT)
print("   看板:", d.get("data"))
check("看板含今日通话/收入/在线数", "today_calls" in d.get("data", {}))

# 10. 审核入驻申请
line("10. 入驻审核 admin/providers/applications")
s, d = req("GET", "/api/v1/admin/providers/applications", token=AT)
apps = d.get("data", [])
print("   待审核数:", len(apps))
check("待审核含新 tester", any(a.get("real_name") == "测试员A" + TS for a in apps), str([a.get("real_name") for a in apps]))
new_id = next((a["id"] for a in apps if a.get("real_name") == "测试员A" + TS), None)
if new_id:
    s, d = req("PUT", "/api/v1/admin/providers/%d/approve" % new_id, {"approve": True}, AT)
    check("审核通过", d.get("data", {}).get("status") == 1, str(d))
    # 验证该用户现在 status=1
    s2, d2 = req("GET", "/api/v1/provider/status", token=NT)
    check("入驻者状态变为已通过", d2.get("data", {}).get("status") == 1, str(d2.get("data", {}).get("status")))

# 11. 费率配置
line("11. 费率配置 admin/config")
s, d = req("GET", "/api/v1/admin/config", token=AT)
print("   配置:", d.get("data"))

# 汇总
line("测试汇总")
passed = sum(1 for _, c in results if c)
print("通过 %d / %d" % (passed, len(results)))
for n, c in results:
    print(("  ✅ " if c else "  ❌ ") + n)
