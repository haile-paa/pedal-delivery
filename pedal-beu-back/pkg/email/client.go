package email

import (
	"fmt"
	"net/smtp"
)

// Client sends transactional emails (verification OTPs, password resets, etc.)
// over SMTP. This replaces pkg/sms.Client as the channel used for account
// verification — see internal/handlers/auth_handler.go.
type Client struct {
	host     string
	port     string
	username string
	password string
	from     string
}

// SendEmailResponse mirrors the shape of sms.SendSMSResponse so callers can
// log/handle it the same way the old SMS response was handled.
type SendEmailResponse struct {
	Success bool   `json:"success"`
	To      string `json:"to"`
	Message string `json:"message"`
}

// NewClient creates a new SMTP-backed email client.
func NewClient(host, port, username, password, from string) *Client {
	return &Client{
		host:     host,
		port:     port,
		username: username,
		password: password,
		from:     from,
	}
}

// SendEmail sends a plain-text email to a single recipient.
func (c *Client) SendEmail(to, subject, body string) (*SendEmailResponse, error) {
	if c == nil {
		return nil, fmt.Errorf("email client not configured")
	}

	msg := []byte(fmt.Sprintf(
		"From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=\"utf-8\"\r\n\r\n%s\r\n",
		c.from, to, subject, body,
	))

	addr := fmt.Sprintf("%s:%s", c.host, c.port)
	auth := smtp.PlainAuth("", c.username, c.password, c.host)

	if err := smtp.SendMail(addr, auth, c.from, []string{to}, msg); err != nil {
		return nil, fmt.Errorf("smtp error: %w", err)
	}

	return &SendEmailResponse{
		Success: true,
		To:      to,
		Message: "sent",
	}, nil
}

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