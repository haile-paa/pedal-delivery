package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/haile-paa/pedal-delivery/internal/models"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type providerVerificationResult struct {
	Verified        bool
	ProviderStatus  string
	VerificationURL string
	ReceiverText    string
	ReceiverDigits  string
	Amount          float64
	RawResponse     map[string]interface{}
}

var amountPattern = regexp.MustCompile(`(?i)(ETB|Birr)[^\d]*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)[^\d]*(ETB|Birr)`)
var receiverDigitsPattern = regexp.MustCompile(`\d{6,}`)

func (s *orderService) VerifyOrderPayment(ctx context.Context, orderID primitive.ObjectID, customerID primitive.ObjectID, req *models.VerifyOrderPaymentRequest) (*models.Order, error) {
	order, err := s.orderRepo.FindByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if order.CustomerID != customerID {
		return nil, errors.New("unauthorized")
	}
	if !paymentMethodMatches(order.PaymentMethod, req.Method) {
		return nil, errors.New("payment method does not match this order")
	}

	transactionReference := strings.ToUpper(strings.TrimSpace(req.TransactionReference))
	if transactionReference == "" {
		return nil, errors.New("transaction reference is required")
	}

	if existing, err := s.orderRepo.FindByTransactionReference(ctx, transactionReference); err == nil && existing.ID != order.ID {
		return nil, errors.New("this transaction reference has already been used")
	}

	payerPhone := strings.TrimSpace(req.PayerPhone)
	if payerPhone == "" {
		if customer, err := s.userRepo.FindByID(ctx, customerID); err == nil {
			payerPhone = customer.Phone
		}
	}

	result, verificationErr := verifyTransferWithProvider(ctx, req.Method, transactionReference)
	if verificationMode() == "mock" {
		result.Amount = req.Amount
		if req.Method == "cbe_transfer" {
			result.ReceiverDigits = firstNonEmpty(result.ReceiverDigits, os.Getenv("CBE_RECEIVER_ACCOUNT_SUFFIX"))
			result.ReceiverText = firstNonEmpty(result.ReceiverText, os.Getenv("CBE_RECEIVER_NAME_HINT"))
		} else {
			result.ReceiverDigits = firstNonEmpty(result.ReceiverDigits, os.Getenv("TELEBIRR_RECEIVER_PHONE_HINT"))
			result.ReceiverText = firstNonEmpty(result.ReceiverText, os.Getenv("TELEBIRR_RECEIVER_HINT"))
		}
	}

	verification := &models.PaymentVerification{
		Method:               req.Method,
		Status:               "failed",
		TransactionReference: transactionReference,
		VerificationURL:      result.VerificationURL,
		ProviderStatus:       result.ProviderStatus,
		ReceiverText:         result.ReceiverText,
		ReceiverDigits:       result.ReceiverDigits,
		PayerPhone:           payerPhone,
		RawResponse:          result.RawResponse,
	}
	now := time.Now()
	verification.CheckedAt = &now

	if verificationErr != nil {
		verification.FailureReason = verificationErr.Error()
		_ = s.orderRepo.UpdatePaymentVerification(ctx, orderID, "pending", verification)
		return nil, verificationErr
	}

	if !amountMatches(result.Amount, req.Amount) {
		verification.FailureReason = fmt.Sprintf("verified amount %.2f did not match order amount %.2f", result.Amount, req.Amount)
		_ = s.orderRepo.UpdatePaymentVerification(ctx, orderID, "pending", verification)
		return nil, errors.New("payment amount does not match the order total")
	}

	if !receiverMatches(req.Method, result) {
		verification.FailureReason = "payment receiver did not match the configured merchant account"
		_ = s.orderRepo.UpdatePaymentVerification(ctx, orderID, "pending", verification)
		return nil, errors.New("payment receiver did not match the merchant account")
	}

	if !result.Verified {
		verification.FailureReason = "provider did not confirm the payment"
		_ = s.orderRepo.UpdatePaymentVerification(ctx, orderID, "pending", verification)
		return nil, errors.New("payment could not be verified")
	}

	verification.Status = "verified"
	verification.ProviderStatus = firstNonEmpty(result.ProviderStatus, "verified")
	verification.VerifiedAt = &now
	if err := s.orderRepo.UpdatePaymentVerification(ctx, orderID, "paid", verification); err != nil {
		return nil, err
	}

	log.Printf("payment verified: order=%s method=%s reference=%s", orderID.Hex(), req.Method, transactionReference)
	return s.orderRepo.FindByID(ctx, orderID)
}

func (s *orderService) SubmitPaymentProof(ctx context.Context, orderID primitive.ObjectID, customerID primitive.ObjectID, req *models.SubmitPaymentProofRequest) (*models.Order, error) {
	order, err := s.orderRepo.FindByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if order.CustomerID != customerID {
		return nil, errors.New("unauthorized")
	}
	if !paymentMethodMatches(order.PaymentMethod, req.Method) {
		return nil, errors.New("payment method does not match this order")
	}

	transactionReference := strings.ToUpper(strings.TrimSpace(req.TransactionReference))
	if transactionReference == "" {
		return nil, errors.New("transaction reference is required")
	}
	if existing, err := s.orderRepo.FindByTransactionReference(ctx, transactionReference); err == nil && existing.ID != order.ID {
		return nil, errors.New("this transaction reference has already been used")
	}
	proofURL := strings.TrimSpace(req.ProofURL)
	if proofURL == "" {
		return nil, errors.New("payment proof screenshot is required")
	}

	payerPhone := strings.TrimSpace(req.PayerPhone)
	if payerPhone == "" {
		if customer, err := s.userRepo.FindByID(ctx, customerID); err == nil {
			payerPhone = customer.Phone
		}
	}

	now := time.Now()
	verification := &models.PaymentVerification{
		Method:               req.Method,
		Status:               "pending_review",
		TransactionReference: transactionReference,
		PayerPhone:           payerPhone,
		ProofURL:             proofURL,
		ProviderStatus:       "manual_review",
		CheckedAt:            &now,
		RawResponse: map[string]interface{}{
			"mode":   "manual_proof",
			"amount": req.Amount,
		},
	}

	if err := s.orderRepo.UpdatePaymentVerification(ctx, orderID, "pending", verification); err != nil {
		return nil, err
	}
	return s.orderRepo.FindByID(ctx, orderID)
}

func (s *orderService) ReviewPaymentProof(ctx context.Context, orderID primitive.ObjectID, adminID primitive.ObjectID, req *models.ReviewPaymentProofRequest) (*models.Order, error) {
	order, err := s.orderRepo.FindByID(ctx, orderID)
	if err != nil {
		return nil, err
	}
	if order.PaymentVerification == nil || order.PaymentVerification.ProofURL == "" {
		return nil, errors.New("payment proof not submitted")
	}
	if order.PaymentVerification.Status != "pending_review" {
		return nil, errors.New("payment proof has already been reviewed")
	}

	now := time.Now()
	verification := *order.PaymentVerification
	verification.ReviewedBy = &adminID
	verification.ReviewedAt = &now
	if req.Approved {
		verification.Status = "verified"
		verification.ProviderStatus = "admin_approved"
		verification.VerifiedAt = &now
		verification.FailureReason = ""
		if err := s.orderRepo.UpdatePaymentVerification(ctx, orderID, "paid", &verification); err != nil {
			return nil, err
		}
	} else {
		verification.Status = "rejected"
		verification.ProviderStatus = "admin_rejected"
		verification.FailureReason = firstNonEmpty(req.Notes, "Payment proof rejected by admin")
		if err := s.orderRepo.UpdatePaymentVerification(ctx, orderID, "failed", &verification); err != nil {
			return nil, err
		}
	}

	return s.orderRepo.FindByID(ctx, orderID)
}

func (s *orderService) GetPaymentVerificationHealth(ctx context.Context) map[string]interface{} {
	return map[string]interface{}{
		"verification_mode":              verificationMode(),
		"verification_timeout_ms":        verificationTimeout().Milliseconds(),
		"verification_amount_tolerance":  verificationAmountTolerance(),
		"cbe_verification_base_url":      cbeVerificationBaseURL(),
		"cbe_receiver_account_suffix":    os.Getenv("CBE_RECEIVER_ACCOUNT_SUFFIX"),
		"cbe_receiver_name_hint":         os.Getenv("CBE_RECEIVER_NAME_HINT"),
		"telebirr_receipt_base_url":      telebirrReceiptBaseURL(),
		"telebirr_receiver_hint":         os.Getenv("TELEBIRR_RECEIVER_HINT"),
		"telebirr_receiver_phone_hint":   os.Getenv("TELEBIRR_RECEIVER_PHONE_HINT"),
		"supported_payment_methods":      []string{"cash", "telebirr", "cbe", "telebirr_transfer", "cbe_transfer"},
		"server_side_payment_check_live": verificationMode() == "live",
	}
}

func paymentMethodMatches(orderMethod, verificationMethod string) bool {
	switch strings.ToLower(strings.TrimSpace(orderMethod)) {
	case "telebirr", "telebirr_transfer":
		return verificationMethod == "telebirr_transfer"
	case "cbe", "cbe_transfer":
		return verificationMethod == "cbe_transfer"
	default:
		return false
	}
}

func verifyTransferWithProvider(ctx context.Context, method, transactionReference string) (providerVerificationResult, error) {
	if verificationMode() == "mock" {
		return mockVerification(method, transactionReference), nil
	}

	switch method {
	case "cbe_transfer":
		return fetchCBEVerification(ctx, transactionReference)
	case "telebirr_transfer":
		return fetchTelebirrVerification(ctx, transactionReference)
	default:
		return providerVerificationResult{}, errors.New("unsupported payment method")
	}
}

func mockVerification(method, transactionReference string) providerVerificationResult {
	now := time.Now().UTC().Format(time.RFC3339)
	switch method {
	case "cbe_transfer":
		url := cbeVerificationBaseURL() + transactionReference + os.Getenv("CBE_RECEIVER_ACCOUNT_SUFFIX")
		return providerVerificationResult{
			Verified:        true,
			ProviderStatus:  "verified",
			VerificationURL: url,
			ReceiverText:    os.Getenv("CBE_RECEIVER_NAME_HINT"),
			ReceiverDigits:  os.Getenv("CBE_RECEIVER_ACCOUNT_SUFFIX"),
			Amount:          250,
			RawResponse: map[string]interface{}{
				"mode":                  "mock",
				"checked_at":            now,
				"transaction_reference": transactionReference,
				"method":                method,
			},
		}
	case "telebirr_transfer":
		url := telebirrReceiptBaseURL() + transactionReference
		return providerVerificationResult{
			Verified:        true,
			ProviderStatus:  "verified",
			VerificationURL: url,
			ReceiverText:    os.Getenv("TELEBIRR_RECEIVER_HINT"),
			ReceiverDigits:  os.Getenv("TELEBIRR_RECEIVER_PHONE_HINT"),
			Amount:          145,
			RawResponse: map[string]interface{}{
				"mode":                  "mock",
				"checked_at":            now,
				"transaction_reference": transactionReference,
				"method":                method,
			},
		}
	default:
		return providerVerificationResult{}
	}
}

func fetchCBEVerification(ctx context.Context, transactionReference string) (providerVerificationResult, error) {
	suffix := strings.TrimSpace(os.Getenv("CBE_RECEIVER_ACCOUNT_SUFFIX"))
	if suffix == "" {
		return providerVerificationResult{}, errors.New("missing CBE receiver account suffix")
	}
	verificationURL := cbeVerificationBaseURL() + transactionReference + suffix
	return fetchVerificationURL(ctx, verificationURL)
}

func fetchTelebirrVerification(ctx context.Context, transactionReference string) (providerVerificationResult, error) {
	verificationURL := telebirrReceiptBaseURL() + transactionReference
	return fetchVerificationURL(ctx, verificationURL)
}

func fetchVerificationURL(ctx context.Context, verificationURL string) (providerVerificationResult, error) {
	httpClient := &http.Client{Timeout: verificationTimeout()}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, verificationURL, nil)
	if err != nil {
		return providerVerificationResult{}, err
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return providerVerificationResult{VerificationURL: verificationURL}, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return providerVerificationResult{VerificationURL: verificationURL}, err
	}

	result := providerVerificationResult{
		VerificationURL: verificationURL,
		ProviderStatus:  strings.ToLower(resp.Status),
		RawResponse: map[string]interface{}{
			"http_status": resp.StatusCode,
			"body":        string(body),
		},
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return result, fmt.Errorf("provider returned %s", resp.Status)
	}

	contentType := strings.ToLower(resp.Header.Get("Content-Type"))
	if strings.Contains(contentType, "application/json") {
		var payload map[string]interface{}
		if err := json.Unmarshal(body, &payload); err == nil {
			result.RawResponse = payload
			result.Verified = boolFromMap(payload, "verified", "success", "status")
			result.ProviderStatus = stringFromMap(payload, "status", "message", "provider_status")
			result.Amount = amountFromMap(payload, "amount", "total", "paid_amount")
			result.ReceiverText = stringFromMap(payload, "receiver", "receiver_name", "merchant", "merchant_name")
			result.ReceiverDigits = stringFromMap(payload, "receiver_digits", "receiver_phone", "receiver_account_suffix")
			return result, nil
		}
	}

	bodyText := string(body)
	result.Verified = htmlLooksVerified(bodyText)
	result.ProviderStatus = firstNonEmpty(result.ProviderStatus, parseProviderStatus(bodyText))
	result.Amount = extractAmount(bodyText)
	result.ReceiverText = extractReceiverText(bodyText)
	result.ReceiverDigits = extractReceiverDigits(bodyText)
	return result, nil
}

func htmlLooksVerified(body string) bool {
	lower := strings.ToLower(body)
	return strings.Contains(lower, "thank you for using telebirr") ||
		strings.Contains(lower, "successful") ||
		strings.Contains(lower, "success") ||
		strings.Contains(lower, "verified")
}

func parseProviderStatus(body string) string {
	lower := strings.ToLower(body)
	switch {
	case strings.Contains(lower, "successful"), strings.Contains(lower, "success"):
		return "verified"
	case strings.Contains(lower, "pending"):
		return "pending"
	case strings.Contains(lower, "failed"):
		return "failed"
	default:
		return ""
	}
}

func extractAmount(body string) float64 {
	match := amountPattern.FindStringSubmatch(body)
	if len(match) == 0 {
		return 0
	}
	for _, candidate := range []string{match[2], match[3]} {
		if candidate == "" {
			continue
		}
		amount, err := strconv.ParseFloat(candidate, 64)
		if err == nil {
			return amount
		}
	}
	return 0
}

func extractReceiverText(body string) string {
	lower := strings.ToLower(body)
	for _, hint := range []string{
		strings.ToLower(strings.TrimSpace(os.Getenv("TELEBIRR_RECEIVER_HINT"))),
		strings.ToLower(strings.TrimSpace(os.Getenv("CBE_RECEIVER_NAME_HINT"))),
	} {
		if hint != "" && strings.Contains(lower, hint) {
			return hint
		}
	}
	return ""
}

func extractReceiverDigits(body string) string {
	lower := strings.ToLower(body)
	for _, hint := range []string{
		strings.TrimSpace(os.Getenv("TELEBIRR_RECEIVER_PHONE_HINT")),
		strings.TrimSpace(os.Getenv("CBE_RECEIVER_ACCOUNT_SUFFIX")),
	} {
		if hint != "" && strings.Contains(lower, strings.ToLower(hint)) {
			return hint
		}
	}
	match := receiverDigitsPattern.FindString(body)
	return match
}

func receiverMatches(method string, result providerVerificationResult) bool {
	switch method {
	case "cbe_transfer":
		expectedSuffix := strings.TrimSpace(os.Getenv("CBE_RECEIVER_ACCOUNT_SUFFIX"))
		expectedName := strings.ToLower(strings.TrimSpace(os.Getenv("CBE_RECEIVER_NAME_HINT")))
		if expectedSuffix != "" && strings.Contains(result.ReceiverDigits, expectedSuffix) {
			return true
		}
		if expectedName != "" && strings.Contains(strings.ToLower(result.ReceiverText), expectedName) {
			return true
		}
		return expectedSuffix == "" && expectedName == ""
	case "telebirr_transfer":
		expectedName := strings.ToLower(strings.TrimSpace(os.Getenv("TELEBIRR_RECEIVER_HINT")))
		expectedPhone := strings.TrimSpace(os.Getenv("TELEBIRR_RECEIVER_PHONE_HINT"))
		if expectedName != "" && strings.Contains(strings.ToLower(result.ReceiverText), expectedName) {
			return true
		}
		if expectedPhone != "" && strings.Contains(result.ReceiverDigits, expectedPhone) {
			return true
		}
		return expectedName == "" && expectedPhone == ""
	default:
		return false
	}
}

func amountMatches(verifiedAmount, expectedAmount float64) bool {
	tolerance := verificationAmountTolerance()
	return verifiedAmount > 0 && expectedAmount > 0 && absFloat(verifiedAmount-expectedAmount) <= tolerance
}

func verificationMode() string {
	mode := strings.ToLower(strings.TrimSpace(os.Getenv("VERIFICATION_MODE")))
	if mode == "" {
		return "mock"
	}
	return mode
}

func verificationTimeout() time.Duration {
	timeoutMs, err := strconv.Atoi(strings.TrimSpace(os.Getenv("VERIFICATION_TIMEOUT_MS")))
	if err != nil || timeoutMs <= 0 {
		timeoutMs = 8000
	}
	return time.Duration(timeoutMs) * time.Millisecond
}

func verificationAmountTolerance() float64 {
	value, err := strconv.ParseFloat(strings.TrimSpace(os.Getenv("VERIFICATION_AMOUNT_TOLERANCE_ETB")), 64)
	if err != nil || value < 0 {
		return 0
	}
	return value
}

func cbeVerificationBaseURL() string {
	baseURL := strings.TrimSpace(os.Getenv("CBE_VERIFICATION_BASE_URL"))
	if baseURL == "" {
		baseURL = "https://apps.cbe.com.et:100/?id="
	}
	return baseURL
}

func telebirrReceiptBaseURL() string {
	baseURL := strings.TrimSpace(os.Getenv("TELEBIRR_RECEIPT_BASE_URL"))
	if baseURL == "" {
		baseURL = "https://transactioninfo.ethiotelecom.et/receipt/"
	}
	return baseURL
}

func boolFromMap(payload map[string]interface{}, keys ...string) bool {
	for _, key := range keys {
		value, ok := payload[key]
		if !ok {
			continue
		}
		switch typed := value.(type) {
		case bool:
			return typed
		case string:
			lower := strings.ToLower(typed)
			if lower == "true" || lower == "verified" || lower == "success" || lower == "successful" {
				return true
			}
		}
	}
	return false
}

func stringFromMap(payload map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		value, ok := payload[key]
		if !ok || value == nil {
			continue
		}
		return fmt.Sprintf("%v", value)
	}
	return ""
}

func amountFromMap(payload map[string]interface{}, keys ...string) float64 {
	for _, key := range keys {
		value, ok := payload[key]
		if !ok || value == nil {
			continue
		}
		switch typed := value.(type) {
		case float64:
			return typed
		case string:
			number, err := strconv.ParseFloat(strings.TrimSpace(typed), 64)
			if err == nil {
				return number
			}
		}
	}
	return 0
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func absFloat(value float64) float64 {
	if value < 0 {
		return -value
	}
	return value
}
