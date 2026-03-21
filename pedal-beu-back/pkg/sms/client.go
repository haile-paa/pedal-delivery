package sms

import (
	"fmt"

	"github.com/twilio/twilio-go"
	api "github.com/twilio/twilio-go/rest/api/v2010"
)

type Client struct {
	client    *twilio.RestClient
	fromPhone string
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

func NewClient(accountSID, authToken, fromPhone string) *Client {
	client := twilio.NewRestClientWithParams(twilio.ClientParams{
		Username: accountSID,
		Password: authToken,
	})
	return &Client{
		client:    client,
		fromPhone: fromPhone,
	}
}

func (c *Client) SendSMS(to, message string) (*SendSMSResponse, error) {
	params := &api.CreateMessageParams{}
	params.SetTo(to)
	params.SetFrom(c.fromPhone)
	params.SetBody(message)

	resp, err := c.client.Api.CreateMessage(params)
	if err != nil {
		return nil, fmt.Errorf("twilio error: %w", err)
	}

	result := &SendSMSResponse{
		Acknowledge: "success",
	}
	if resp.Status != nil {
		result.Response.Status = *resp.Status
	}
	if resp.Sid != nil {
		result.Response.MessageID = *resp.Sid
	}
	if resp.Body != nil {
		result.Response.Message = *resp.Body
	}
	if resp.To != nil {
		result.Response.To = *resp.To
	}
	return result, nil
}
