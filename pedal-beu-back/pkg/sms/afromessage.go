package sms

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type Client struct {
	apiToken string
	from     string
	sender   string
	apiBase  string
	http     *http.Client
}

func NewClient(apiToken, from, sender, apiBase string) *Client {
	if apiBase == "" {
		apiBase = "https://api.afromessage.com/api"
	}
	return &Client{
		apiToken: apiToken,
		from:     from,
		sender:   sender,
		apiBase:  apiBase,
		http:     &http.Client{Timeout: 10 * time.Second},
	}
}

type SendSMSRequest struct {
	From    string `json:"from,omitempty"`
	Sender  string `json:"sender,omitempty"`
	To      string `json:"to"`
	Message string `json:"message"`
}

type SendSMSResponse struct {
	Acknowledge string `json:"acknowledge"`
	Response    struct {
		Status    string `json:"status"`
		MessageID string `json:"message_id"`
		Message   string `json:"message"`
		To        string `json:"to"`
	} `json:"response"`
}

func (c *Client) SendSMS(to, message string) (*SendSMSResponse, error) {
	url := c.apiBase + "/send"
	reqBody := SendSMSRequest{
		From:    c.from,
		Sender:  c.sender,
		To:      to,
		Message: message,
	}
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiToken)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)

	var result SendSMSResponse
	if err := json.Unmarshal(bodyBytes, &result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %v, body: %s", err, string(bodyBytes))
	}

	if result.Acknowledge != "success" {
		// Include the raw response body to see the actual error
		return nil, fmt.Errorf("afromessage error: %s - raw response: %s", result.Acknowledge, string(bodyBytes))
	}

	return &result, nil
}
