// internal/services/websocket_service.go
package services

import (
	"log"
	
	"github.com/haile-paa/pedal-delivery/internal/models"
	"github.com/haile-paa/pedal-delivery/internal/websocket"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type WebSocketService struct {
	hub *websocket.Hub
}

func NewWebSocketService() *WebSocketService {
	return &WebSocketService{
		hub: websocket.GetHub(),
	}
}

// NotifyOrderStatusChange notifies about order status change
func (s *WebSocketService) NotifyOrderStatusChange(order *models.Order) {
	s.hub.BroadcastOrderUpdate(order)
}

// NotifyDriverAssigned notifies customer about driver assignment
func (s *WebSocketService) NotifyDriverAssigned(order *models.Order, driver *models.Driver) {
	s.hub.SendDriverAssigned(order, driver)
}

// NotifyDriverLocationUpdate notifies about driver location update
func (s *WebSocketService) NotifyDriverLocationUpdate(driverID primitive.ObjectID, location models.GeoLocation, orderID string) {
	s.hub.SendDriverLocation(driverID, location, orderID)
}

// NotifyUser sends notification to specific user
func (s *WebSocketService) NotifyUser(userID primitive.ObjectID, notification *models.Notification) {
	s.hub.SendNotification(userID, notification)
}

// SendChatMessage sends chat message
func (s *WebSocketService) SendChatMessage(message *models.ChatMessage) {
	s.hub.HandleNewMessage(message)
}