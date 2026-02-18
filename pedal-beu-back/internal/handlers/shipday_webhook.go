package handlers

import (
    "encoding/json"
    "io/ioutil"
    "log"
    "net/http"
    "github.com/gin-gonic/gin"
    "github.com/haile-paa/pedal-delivery/internal/models"
    "github.com/haile-paa/pedal-delivery/internal/services"
    "github.com/haile-paa/pedal-delivery/internal/shipday"
    "go.mongodb.org/mongo-driver/bson/primitive"
)

type ShipdayWebhookHandler struct {
    orderService services.OrderService
    wsService    services.WebSocketService
}

func NewShipdayWebhookHandler(orderService services.OrderService, wsService services.WebSocketService) *ShipdayWebhookHandler {
    return &ShipdayWebhookHandler{
        orderService: orderService,
        wsService:    wsService,
    }
}

// Handle processes incoming Shipday webhooks
func (h *ShipdayWebhookHandler) Handle(c *gin.Context) {
    body, err := ioutil.ReadAll(c.Request.Body)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read body"})
        return
    }
    defer c.Request.Body.Close()

    // Optional: Verify signature if Shipday provides one (check their docs)
    // For now, we'll just parse the event

    var event shipday.WebhookPayload
    if err := json.Unmarshal(body, &event); err != nil {
        log.Printf("Invalid webhook payload: %v", err)
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
        return
    }

    // Find order by Shipday order ID
    order, err := h.orderService.FindByShipdayID(c.Request.Context(), event.OrderID)
    if err != nil {
        log.Printf("Order not found for Shipday ID %s: %v", event.OrderID, err)
        // Still return 200 to avoid retries
        c.Status(http.StatusOK)
        return
    }

    // Map Shipday event to internal order status
    newStatus := mapShipdayEvent(event.EventType)
    if newStatus == "" {
        log.Printf("Unhandled Shipday event type: %s", event.EventType)
        c.Status(http.StatusOK)
        return
    }

    // Update order status (this will also push via WebSocket via service)
    // You need a method in orderService to update status from webhook
    err = h.orderService.UpdateOrderStatusFromWebhook(c.Request.Context(), order.ID, newStatus)
    if err != nil {
        log.Printf("Failed to update order status: %v", err)
        // Still return 200
    }

    c.Status(http.StatusOK)
}

// mapShipdayEvent converts Shipday event type to internal OrderStatus
func mapShipdayEvent(eventType string) models.OrderStatus {
    switch eventType {
    case "order.accepted":
        return models.OrderAccepted
    case "order.picked_up":
        return models.OrderPickedUp
    case "order.delivered":
        return models.OrderDelivered
    case "order.cancelled":
        return models.OrderCancelled
    // Add other mappings as per Shipday documentation
    default:
        return ""
    }
}