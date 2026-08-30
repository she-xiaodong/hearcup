package main

import (
	"fmt"
	"testing"
)

// IM 能力探针（只读，无副作用）
//
// 用途一：确认当前 SDKAppID 是否具备「即时通信 IM」能力——TUICallKit 的离线推送
//         依赖 IM 信令通道，纯 TRTC 应用无法承载。
// 用途二：校验自研 UserSig 能否通过腾讯云服务端校验（历史 bug：签名算法与官方
//         规范不一致，服务端返回 70003 UserSig 非法，导致 TRTC 从未真正进房成功）。
//
// 运行：cd server && go test -run 'TestIMProbe|TestUserSigFixed' -v

func TestIMProbe(t *testing.T) {
	loadConfig()
	if appCfg.TRTCAppID == 0 {
		t.Skip("TRTC/IM 未配置")
	}
	admin := imAdmin()
	t.Logf("[PROBE] sdkappid=%d admin=%s", appCfg.TRTCAppID, admin)

	// ① 查询资料：账号不存在会返回明确的业务错误码，ErrorCode=0 即代表 UserSig 校验通过
	m1, e1 := imPost("profile", "portrait_get", map[string]interface{}{
		"To_Account": []string{"hearcup_probe_notexist"},
		"TagList":    []string{"Tag_Profile_IM_Nick"},
	})
	t.Logf("[portrait_get] err=%v resp=%v", e1, m1)
	if err := imOK(m1, e1); err != nil {
		t.Errorf("UserSig 校验未通过（说明签名算法或密钥有问题）: %v", err)
	} else {
		t.Logf("[PROBE] ✅ UserSig 通过腾讯云校验，SDKAppID %d 的 IM 能力可用", appCfg.TRTCAppID)
	}

	// ② 查询在线状态：TUICallKit 判断被叫是否在线的底层能力
	m2, e2 := imPost("openim", "querystate", map[string]interface{}{
		"To_Account": []string{imUserID(1)},
	})
	t.Logf("[querystate] err=%v resp=%v", e2, m2)

	// ③ 开通一个真实账号后复查，验证 account_import → querystate 全链路
	if err := imOK(imPost("im_open_login_svc", "account_import", map[string]interface{}{
		"UserID": imUserID(1), "Nick": "probe",
	})); err != nil {
		t.Logf("[account_import] %v", err)
	}
	if st, err := imQueryOnline([]string{imUserID(1)}); err != nil {
		t.Logf("[querystate-after-import] err=%v", err)
	} else {
		t.Logf("[querystate-after-import] state=%v", st)
	}
}

// TestUserSigFixed 输出「固定时间戳」的 UserSig，供官方 npm 包 tls-sig-api-v2 交叉验证。
// 固定 ts=1700000000、expire=86400，两端参数一致时解压后的明文 JSON 应完全相同。
func TestUserSigFixed(t *testing.T) {
	loadConfig()
	if appCfg.TRTCAppID == 0 {
		t.Skip("TRTC/IM 未配置")
	}
	const ts, expire = int64(1700000000), 86400
	fmt.Println("GO_SIG=" + generateUserSigAt("administrator", ts, expire))
}
