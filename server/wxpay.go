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
		OutTradeNo   string `json:"out_trade_no"`
		TradeState   string `json:"trade_state"`
		TransactionID string `json:"transaction_id"`
	}
	_ = json.Unmarshal([]byte(plain), &tx)
	if tx.TradeState != "SUCCESS" {
		sendOK(w, map[string]interface{}{"code": "SUCCESS", "message": "已接收"})
		return
	}
	store.mu.Lock()
	defer store.mu.Unlock()
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
