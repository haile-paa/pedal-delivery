package shipday

type Address struct {
    Street  string `json:"street"`
    City    string `json:"city"`
    State   string `json:"state"`
    Zip     string `json:"zip"`
    Country string `json:"country"`
}

type Customer struct {
    Name        string  `json:"name"`
    PhoneNumber string  `json:"phoneNumber"`
    Email       string  `json:"email"`
    Address     Address `json:"address"`
}

type Pickup struct {
    Name        string  `json:"name"`
    PhoneNumber string  `json:"phoneNumber"`
    Address     Address `json:"address"`
}

type OrderItem struct {
    Name      string  `json:"name"`
    Quantity  int     `json:"quantity"`
    UnitPrice float64 `json:"unitPrice"`
}

type CreateOrderRequest struct {
    OrderNumber string      `json:"orderNumber"`
    Customer    Customer    `json:"customer"`
    Pickup      Pickup      `json:"pickup"`
    OrderItems  []OrderItem `json:"orderItems"`
}

type CreateOrderResponse struct {
    ID          string `json:"id"`
    OrderNumber string `json:"orderNumber"`
    Status      string `json:"status"`
}

type WebhookPayload struct {
    EventType string `json:"eventType"`
    OrderID   string `json:"orderId"`
    // Add other fields as needed from Shipday docs
}