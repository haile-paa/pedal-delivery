package shipday

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
    "github.com/haile-paa/pedal-delivery/internal/config"
)

type Client struct {
    apiKey     string
    baseURL    string
    httpClient *http.Client
}

func NewClient(cfg *config.Config) *Client {
    return &Client{
        apiKey:     cfg.Shipday.APIKey,
        baseURL:    cfg.Shipday.BaseURL,
        httpClient: &http.Client{},
    }
}

func (c *Client) doRequest(method, path string, body interface{}) (*http.Response, error) {
    url := c.baseURL + path
    var reqBody []byte
    var err error
    if body != nil {
        reqBody, err = json.Marshal(body)
        if err != nil {
            return nil, err
        }
    }

    req, err := http.NewRequest(method, url, bytes.NewBuffer(reqBody))
    if err != nil {
        return nil, err
    }
    req.SetBasicAuth(c.apiKey, "") // Shipday uses API key as username
    req.Header.Set("Content-Type", "application/json")

    return c.httpClient.Do(req)
}

func (c *Client) CreateOrder(req *CreateOrderRequest) (*CreateOrderResponse, error) {
    resp, err := c.doRequest("POST", "/orders", req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
        var errResp map[string]interface{}
        _ = json.NewDecoder(resp.Body).Decode(&errResp)
        return nil, fmt.Errorf("shipday API error: status %d, body: %v", resp.StatusCode, errResp)
    }

    var result CreateOrderResponse
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }
    return &result, nil
}