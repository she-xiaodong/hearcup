package main

import (
	"crypto"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"math"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// ---- 微信支付 v3：密钥 / 签名 / 解密 ----

func randomNonce() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// rsaSign：用商户私钥对报文做 SHA256-RSA2048 签名（微信支付 v3 要求）
func rsaSign(privateKeyPEM, msg string) (string, error) {
	block, _ := pem.Decode([]byte(privateKeyPEM))
	if block == nil {
		return "", fmt.Errorf("私钥 PEM 解析失败")
	}
	var key *rsa.PrivateKey
	if k, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
		key = k.(*rsa.PrivateKey)
	} else if k1, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		key = k1
	} else {
		return "", fmt.Errorf("私钥格式不支持（需 PKCS#1 或 PKCS#8）")
	}
	h := sha256.New()
	h.Write([]byte(msg))
	digest := h.Sum(nil)
	sig, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, digest)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(sig), nil
}

// aesGCMDecrypt：用 APIv3 密钥对回调密文做 AES-256-GCM 解密
func aesGCMDecrypt(key, nonce, ciphertext, aad string) (string, error) {
	block, err := aes.NewCipher([]byte(key))
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	ct, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", err
	}
	plain, err := gcm.Open(nil, []byte(nonce), ct, []byte(aad))
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

// createWxPayOrder：调用微信支付 v3 JSAPI 下单，返回小程序 wx.requestPayment 所需参数
func createWxPayOrder(openid, outTradeNo string, amount float64) (map[string]interface{}, error) {
	if appCfg.WXPayMchID == "" || appCfg.WXPaySerial == "" || appCfg.WXPayPrivateKey == "" || appCfg.WXAppID == "" {
		return nil, fmt.Errorf("微信支付配置缺失")
	}
	total := int64(amount * 100) // 单位：分
	nonce := randomNonce()
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	notify := appCfg.WXPayNotifyURL
	if notify == "" {
		notify = "http://localhost:8099/api/v1/pay/callback"
	}
	body := map[string]interface{}{
		"mchid":        appCfg.WXPayMchID,
		"appid":        appCfg.WXAppID,
		"description":  "Hearcup 账户充值",
		"out_trade_no": outTradeNo,
		"notify_url":   notify,
		"amount":       map[string]interface{}{"total": total, "currency": "CNY"},
		"payer":        map[string]interface{}{"openid": openid},
	}
	bodyBytes, _ := json.Marshal(body)

	reqURL := "https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi"
	httpPath := "/v3/pay/transactions/jsapi"
	// 签名串：METHOD\nURL\nTIMESTAMP\nNONCE\nBODY\n
	msg := strings.Join([]string{"POST", httpPath, timestamp, nonce, string(bodyBytes)}, "\n") + "\n"
	sig, err := rsaSign(appCfg.WXPayPrivateKey, msg)
	if err != nil {
		return nil, err
	}
	auth := fmt.Sprintf(`WECHATPAY2-SHA256-RSA2048 mchid="%s",nonce_str="%s",signature="%s",timestamp="%s",serial_no="%s"`,
		appCfg.WXPayMchID, nonce, sig, timestamp, appCfg.WXPaySerial)

	req, _ := http.NewRequest("POST", reqURL, strings.NewReader(string(bodyBytes)))
	req.Header.Set("Authorization", auth)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Hearcup/1.0")
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("微信下单返回 %d: %s", resp.StatusCode, string(b))
	}
	var rm struct {
		PrepayID string `json:"prepay_id"`
	}
	_ = json.Unmarshal(b, &rm)
	if rm.PrepayID == "" {
		return nil, fmt.Errorf("未返回 prepay_id: %s", string(b))
	}
	// 小程序支付参数（二次签名）
	payNonce := randomNonce()
	payTs := strconv.FormatInt(time.Now().Unix(), 10)
	pkg := "prepay_id=" + rm.PrepayID
	payMsg := strings.Join([]string{appCfg.WXAppID, payTs, payNonce, pkg}, "\n") + "\n"
	paySign, _ := rsaSign(appCfg.WXPayPrivateKey, payMsg)
	return map[string]interface{}{
		"appId":     appCfg.WXAppID,
		"timeStamp": payTs,
		"nonceStr":  payNonce,
		"package":   pkg,
		"signType":  "RSA",
		"paySign":   paySign,
	}, nil
}

// hWxPayCallback：微信支付结果通知（v3）。解密资源 → 标记订单已支付 → 余额入账。
// 注意：生产环境应再用平台证书对 Wechatpay-Signature 验签（需商户平台下载证书），
// MVP 此处完成 AES-GCM 解密与业务落库，验签环节留 TODO。
func hWxPayCallback(w http.ResponseWriter, r *http.Request) {
	b, _ := io.ReadAll(r.Body)
	var notif struct {
		ResourceType string `json:"resource_type"`
		Resource     struct {
			Algorithm      string `json:"algorithm"`
			Ciphertext     string `json:"ciphertext"`
			Nonce          string `json:"nonce"`
			AssociatedData string `json:"associated_data"`
		} `json:"resource"`
	}
	_ = json.Unmarshal(b, &notif)
	if appCfg.WXPayAPIv3Key == "" {
		fail(w, "APIv3 密钥未配置")
		return
	}
	plain, err := aesGCMDecrypt(appCfg.WXPayAPIv3Key, notif.Resource.Nonce, notif.Resource.Ciphertext, notif.Resource.AssociatedData)
	if err != nil {
		fail(w, "解密失败: "+err.Error())
		return
	}
	var tx struct {
		OutTradeNo    string `json:"out_trade_no"`
		TradeState    string `json:"trade_state"`
		TransactionID string `json:"transaction_id"`
	}
	_ = json.Unmarshal([]byte(plain), &tx)
	fmt.Println("[pay] 回调收到 trade_state=", tx.TradeState, " out_trade_no=", tx.OutTradeNo)
	if tx.TradeState != "SUCCESS" {
		sendOK(w, map[string]interface{}{"code": "SUCCESS", "message": "已接收"})
		return
	}
	store.mu.Lock()
	defer store.mu.Unlock()
	// ① 通话套餐订单（CO 前缀）：只标记已支付，不入账余额（金额用于结算给倾听师）
	if strings.HasPrefix(tx.OutTradeNo, "CO") {
		for _, c := range store.db.Calls {
			if c.OrderNo == tx.OutTradeNo {
				if c.PayStatus != 1 {
					c.PayStatus = 1
					c.PayTime = now()
					c.UpdatedAt = now()
					store.save()
				}
				fmt.Println("[pay] 通话订单已支付 call_id=", c.ID, " order=", c.OrderNo)
				break
			}
		}
		sendOK(w, map[string]interface{}{"code": "SUCCESS", "message": "成功"})
		return
	}
	// ② 充值订单（RC 前缀）：标记已支付并入账余额
	var order *RechargeOrder
	for _, o := range store.db.Recharges {
		if o.OrderNo == tx.OutTradeNo {
			order = o
			break
		}
	}
	if order != nil && order.PayStatus != 1 {
		order.PayStatus = 1
		order.TransactionID = tx.TransactionID
		order.PayTime = now()
		u := store.db.Users[order.UserID]
		if u != nil {
			if u.Balance < 0 {
				owe := -u.Balance
				if order.Amount >= owe {
					u.Balance = order.Amount - owe
				} else {
					u.Balance = -(owe - order.Amount)
				}
			} else {
				u.Balance += order.Amount
			}
		}
		store.save()
	}
	sendOK(w, map[string]interface{}{"code": "SUCCESS", "message": "成功"})
}

// 占位：生成大随机数（保留备用）
func bigRand() int64 {
	n, err := rand.Int(rand.Reader, big.NewInt(1<<62))
	if err != nil {
		return time.Now().UnixNano()
	}
	return n.Int64()
}

// ---- 微信支付 v3：商家转账到零钱（分佣打款给倾听者）----

// wxTransferSceneInfos：转账场景报备信息（按商户平台开通的场景填写）。
// 优先取 .env 的 HEARCUP_WXPAY_TRANSFER_SCENE_INFOS（JSON 数组），缺失时用默认（分销佣金场景）。
func wxTransferSceneInfos() []map[string]string {
	if appCfg.WXPayTransferSceneInfos != "" {
		var arr []map[string]string
		if err := json.Unmarshal([]byte(appCfg.WXPayTransferSceneInfos), &arr); err == nil && len(arr) > 0 {
			return arr
		}
	}
	return []map[string]string{
		{"info_type": "岗位类型", "info_content": "心理咨询倾听者"},
		{"info_type": "报酬说明", "info_content": "倾听服务分佣"},
	}
}

// createWxTransferToBalance：调用微信支付 v3「商家转账到零钱」(transfer-bills) 给指定 openid 打款。
// outBillNo 为商户单号（须全局唯一、仅含数字字母）；amount 单位元；remark 为转账备注（用户可见，≤32字）。
// 返回微信原始响应字段（含 out_bill_no / transfer_bill_no / state）。
// state 说明：ACCEPTED 受理成功、PROCESSING 处理中、FINISHED 成功、FAIL 失败、CANCELING/CANCELLED 撤销。
func createWxTransferToBalance(openid, outBillNo string, amount float64, remark string) (map[string]interface{}, error) {
	if appCfg.WXPayMchID == "" || appCfg.WXPaySerial == "" || appCfg.WXPayPrivateKey == "" || appCfg.WXAppID == "" {
		return nil, fmt.Errorf("微信支付商户配置缺失，无法打款")
	}
	sceneID := appCfg.WXPayTransferSceneID
	if sceneID == "" {
		sceneID = "1001" // 默认：分销/佣金场景
	}
	total := int64(math.Round(amount * 100)) // 单位：分
	if total <= 0 {
		return nil, fmt.Errorf("打款金额无效")
	}
	body := map[string]interface{}{
		"appid":                     appCfg.WXAppID,
		"out_bill_no":               outBillNo,
		"transfer_scene_id":         sceneID,
		"openid":                    openid,
		"transfer_amount":           total,
		"transfer_remark":           remark,
		"transfer_scene_report_infos": wxTransferSceneInfos(),
	}
	if n := appCfg.WXPayTransferNotifyURL; n != "" {
		body["notify_url"] = n
	}
	bodyBytes, _ := json.Marshal(body)

	reqURL := "https://api.mch.weixin.qq.com/v3/fund-app/mch-transfer/transfer-bills"
	httpPath := "/v3/fund-app/mch-transfer/transfer-bills"
	nonce := randomNonce()
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	msg := strings.Join([]string{"POST", httpPath, timestamp, nonce, string(bodyBytes)}, "\n") + "\n"
	sig, err := rsaSign(appCfg.WXPayPrivateKey, msg)
	if err != nil {
		return nil, err
	}
	auth := fmt.Sprintf(`WECHATPAY2-SHA256-RSA2048 mchid="%s",nonce_str="%s",signature="%s",timestamp="%s",serial_no="%s"`,
		appCfg.WXPayMchID, nonce, sig, timestamp, appCfg.WXPaySerial)
	req, _ := http.NewRequest("POST", reqURL, strings.NewReader(string(bodyBytes)))
	req.Header.Set("Authorization", auth)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Hearcup/1.0")
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("微信转账返回 %d: %s", resp.StatusCode, string(b))
	}
	var rm map[string]interface{}
	_ = json.Unmarshal(b, &rm)
	return rm, nil
}

// queryWxTransfer：按商户单号查询转账单据状态（结果异步，受理成功后可轮询）。
func queryWxTransfer(outBillNo string) (map[string]interface{}, error) {
	if appCfg.WXPayMchID == "" || appCfg.WXPaySerial == "" || appCfg.WXPayPrivateKey == "" {
		return nil, fmt.Errorf("微信支付商户配置缺失")
	}
	reqURL := "https://api.mch.weixin.qq.com/v3/fund-app/mch-transfer/transfer-bills/out-bill-no/" + outBillNo
	httpPath := "/v3/fund-app/mch-transfer/transfer-bills/out-bill-no/" + outBillNo
	nonce := randomNonce()
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	msg := strings.Join([]string{"GET", httpPath, timestamp, nonce, ""}, "\n") + "\n"
	sig, err := rsaSign(appCfg.WXPayPrivateKey, msg)
	if err != nil {
		return nil, err
	}
	auth := fmt.Sprintf(`WECHATPAY2-SHA256-RSA2048 mchid="%s",nonce_str="%s",signature="%s",timestamp="%s",serial_no="%s"`,
		appCfg.WXPayMchID, nonce, sig, timestamp, appCfg.WXPaySerial)
	req, _ := http.NewRequest("GET", reqURL, nil)
	req.Header.Set("Authorization", auth)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "Hearcup/1.0")
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("微信查询转账返回 %d: %s", resp.StatusCode, string(b))
	}
	var rm map[string]interface{}
	_ = json.Unmarshal(b, &rm)
	return rm, nil
}

// hWxTransferCallback：商家转账到零钱 结果异步通知（v3）。解密资源 → 更新转账记录与提现单状态。
func hWxTransferCallback(w http.ResponseWriter, r *http.Request) {
	b, _ := io.ReadAll(r.Body)
	var notif struct {
		Resource struct {
			Algorithm      string `json:"algorithm"`
			Ciphertext     string `json:"ciphertext"`
			Nonce          string `json:"nonce"`
			AssociatedData string `json:"associated_data"`
		} `json:"resource"`
	}
	_ = json.Unmarshal(b, &notif)
	if appCfg.WXPayAPIv3Key == "" {
		fail(w, "APIv3 密钥未配置")
		return
	}
	plain, err := aesGCMDecrypt(appCfg.WXPayAPIv3Key, notif.Resource.Nonce, notif.Resource.Ciphertext, notif.Resource.AssociatedData)
	if err != nil {
		fail(w, "解密失败: "+err.Error())
		return
	}
	var tx struct {
		OutBillNo      string `json:"out_bill_no"`
		State          string `json:"state"`
		TransferBillNo string `json:"transfer_bill_no"`
	}
	_ = json.Unmarshal([]byte(plain), &tx)
	fmt.Println("[transfer] 回调 out_bill_no=", tx.OutBillNo, " state=", tx.State)
	store.mu.Lock()
	defer store.mu.Unlock()
	for _, tr := range store.db.Transfers {
		if tr.OutBillNo == tx.OutBillNo {
			tr.State = tx.State
			if tx.TransferBillNo != "" {
				tr.WxBillNo = tx.TransferBillNo
			}
			tr.UpdatedAt = now()
			if tx.State == "FINISHED" {
				tr.Status = 1
			} else if tx.State == "FAIL" {
				tr.Status = 2
			}
			if wd, ok := store.db.Withdraws[tr.WithdrawID]; ok {
				wd.TransferState = tx.State
			}
			store.save()
			break
		}
	}
	sendOK(w, map[string]interface{}{"code": "SUCCESS", "message": "成功"})
}
