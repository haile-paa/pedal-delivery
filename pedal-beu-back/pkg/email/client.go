package email

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client sends transactional emails (verification OTPs, password resets, etc.)
// used as the channel for account verification — see
// internal/handlers/auth_handler.go.
//
// IMPORTANT: this uses Brevo's HTTPS transactional email API (port 443),
// NOT raw SMTP (ports 25/465/587). Render's free web services block all
// outbound SMTP ports as of Sept 2025, so a net/smtp-based client (see the
// commented-out SendEmailSMTP below) will time out in production even with
// correct credentials. The HTTP API path works because it's a normal HTTPS
// request, same as any other outbound API call.
type Client struct {
	apiKey    string
	fromEmail string
	fromName  string
	// host/port/username/password are kept for the commented-out SMTP path
	// below, in case this ever runs somewhere that doesn't block SMTP ports.
	host     string
	port     string
	username string
	password string
}

// SendEmailResponse mirrors the shape of sms.SendSMSResponse so callers can
// log/handle it the same way the old SMS response was handled.
type SendEmailResponse struct {
	Success bool   `json:"success"`
	To      string `json:"to"`
	Message string `json:"message"`
}

// NewClient creates a new Brevo API-backed email client.
// apiKey is your Brevo "API Key" (Settings -> SMTP & API -> API Keys),
// NOT your SMTP password. fromEmail must be a verified sender in Brevo.
func NewClient(apiKey, fromEmail, fromName string) *Client {
	return &Client{
		apiKey:    apiKey,
		fromEmail: fromEmail,
		fromName:  fromName,
	}
}

// NewSMTPClient (commented-out path preserved for reference/revert) — used
// to build a client that sends over raw SMTP. Left here in case this is
// ever deployed somewhere that doesn't block outbound SMTP ports.
// func NewSMTPClient(host, port, username, password, from string) *Client {
// 	return &Client{host: host, port: port, username: username, password: password, fromEmail: from}
// }

var brevoEndpoint = "https://api.brevo.com/v3/smtp/email"

type brevoRecipient struct {
	Email string `json:"email"`
}

type brevoSender struct {
	Name  string `json:"name,omitempty"`
	Email string `json:"email"`
}

type brevoEmailPayload struct {
	Sender      brevoSender      `json:"sender"`
	To          []brevoRecipient `json:"to"`
	Subject     string           `json:"subject"`
	TextContent string           `json:"textContent"`
}

// SendEmail sends a plain-text email to a single recipient via Brevo's HTTP API.
func (c *Client) SendEmail(to, subject, body string) (*SendEmailResponse, error) {
	if c == nil || c.apiKey == "" {
		return nil, fmt.Errorf("email client not configured")
	}

	payload := brevoEmailPayload{
		Sender:      brevoSender{Name: c.fromName, Email: c.fromEmail},
		To:          []brevoRecipient{{Email: to}},
		Subject:     subject,
		TextContent: body,
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to encode email payload: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, brevoEndpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("api-key", c.apiKey)

	httpClient := &http.Client{Timeout: 15 * time.Second}
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("brevo api error: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("brevo api returned %d: %s", resp.StatusCode, string(respBody))
	}

	return &SendEmailResponse{
		Success: true,
		To:      to,
		Message: "sent",
	}, nil
}

// SendEmailSMTP (commented out — kept for reference/revert). This is the
// original raw-SMTP implementation. It will time out on Render's free tier
// (SMTP ports 25/465/587 are blocked), so SendEmail above uses Brevo's HTTP
// API instead. Restore this only if deploying somewhere SMTP isn't blocked.
//
// func (c *Client) SendEmailSMTP(to, subject, body string) (*SendEmailResponse, error) {
// 	msg := []byte(fmt.Sprintf(
// 		"From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=\"utf-8\"\r\n\r\n%s\r\n",
// 		c.fromEmail, to, subject, body,
// 	))
// 	addr := fmt.Sprintf("%s:%s", c.host, c.port)
// 	auth := smtp.PlainAuth("", c.username, c.password, c.host)
// 	if err := smtp.SendMail(addr, auth, c.fromEmail, []string{to}, msg); err != nil {
// 		return nil, fmt.Errorf("smtp error: %w", err)
// 	}
// 	return &SendEmailResponse{Success: true, To: to, Message: "sent"}, nil
// }

// SendOTPEmail sends a formatted verification-code email. This is the direct
// replacement for the old "Welcome to Pedal Delivery! Your OTP is: %s" SMS
// message that used to be sent via Twilio.
func (c *Client) SendOTPEmail(to, otp string) (*SendEmailResponse, error) {
	subject := "Your Pedal Delivery verification code"
	body := fmt.Sprintf(
		"Welcome to Pedal Delivery!\n\nYour verification code is: %s\n\nThis code is valid for 5 minutes. If you did not request this, you can safely ignore this email.",
		otp,
	)
	return c.SendEmail(to, subject, body)
}