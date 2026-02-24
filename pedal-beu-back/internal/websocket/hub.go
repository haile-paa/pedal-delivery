package websocket

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gin-gonic/gin"

	"github.com/haile-paa/pedal-delivery/internal/models"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type WebSocketEvent struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

type Hub struct {
	clients    map[*Client]bool
	rooms      map[string]map[*Client]bool // room name -> set of clients
	broadcast  chan WebSocketEvent
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		rooms:      make(map[string]map[*Client]bool),
		broadcast:  make(chan WebSocketEvent),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			client.rooms = make(map[string]bool)
			log.Printf("Client registered: userID=%s, role=%s", client.userID.Hex(), client.role)
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				// Remove client from all rooms
				for room := range client.rooms {
					delete(h.rooms[room], client)
					if len(h.rooms[room]) == 0 {
						delete(h.rooms, room)
					}
				}
				log.Printf("Client unregistered: userID=%s", client.userID.Hex())
			}
			h.mu.Unlock()

		case event := <-h.broadcast:
			h.mu.RLock()
			// If event contains a "room" field in Data, send only to that room
			if dataMap, ok := event.Data.(map[string]interface{}); ok {
				if roomVal, exists := dataMap["room"]; exists {
					roomName, ok := roomVal.(string)
					if ok && roomName != "" {
						// Send to specific room
						if clients, exists := h.rooms[roomName]; exists {
							for client := range clients {
								select {
								case client.send <- h.serializeEvent(event):
								default:
									// Client's send buffer is full; disconnect client
									go h.unregisterClient(client)
								}
							}
						}
						h.mu.RUnlock()
						continue
					}
				}
			}
			// Broadcast to all clients (fallback)
			for client := range h.clients {
				select {
				case client.send <- h.serializeEvent(event):
				default:
					go h.unregisterClient(client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) unregisterClient(client *Client) {
	h.unregister <- client
}

func (h *Hub) serializeEvent(event WebSocketEvent) []byte {
	data, err := json.Marshal(event)
	if err != nil {
		log.Printf("Error marshaling event: %v", err)
		return []byte{}
	}
	return data
}

// Add client to a room
func (h *Hub) joinRoom(client *Client, room string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.rooms[room]; !ok {
		h.rooms[room] = make(map[*Client]bool)
	}
	h.rooms[room][client] = true
	client.rooms[room] = true
	log.Printf("Client %s joined room %s", client.userID.Hex(), room)
}

// Remove client from a room
func (h *Hub) leaveRoom(client *Client, room string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if clients, ok := h.rooms[room]; ok {
		delete(clients, client)
		if len(clients) == 0 {
			delete(h.rooms, room)
		}
	}
	delete(client.rooms, room)
	log.Printf("Client %s left room %s", client.userID.Hex(), room)
}

// Broadcast event to a specific room
func (h *Hub) BroadcastToRoom(room string, event WebSocketEvent) {
	// Add room to event data so the Run loop can route it
	if dataMap, ok := event.Data.(map[string]interface{}); ok {
		dataMap["room"] = room
	} else {
		// If Data is not a map, wrap it
		event.Data = map[string]interface{}{
			"data": event.Data,
			"room": room,
		}
	}
	h.broadcast <- event
}

// BroadcastOrderUpdate sends order updates to the order room and optionally driver room
func (h *Hub) BroadcastOrderUpdate(order *models.Order) {
	event := WebSocketEvent{
		Type: "order_update",
		Data: order,
	}
	// Send to order room
	h.BroadcastToRoom("order:"+order.ID.Hex(), event)

	// If driver assigned, also send to driver's room
	if order.DriverID != nil {
		h.BroadcastToRoom("driver:"+order.DriverID.Hex(), event)
	}
}

// SendDriverLocation broadcasts location to driver's room (usually only the customer in that order)
func (h *Hub) SendDriverLocation(driverID primitive.ObjectID, location models.GeoLocation, orderID primitive.ObjectID) {
	event := WebSocketEvent{
		Type: "driver_location",
		Data: map[string]interface{}{
			"driver_id": driverID,
			"location":  location,
			"order_id":  orderID,
		},
	}
	// Send to the order room (customer and driver)
	h.BroadcastToRoom("order:"+orderID.Hex(), event)
}

// SendNotification sends a notification to a specific user's room
func (h *Hub) SendNotification(userID primitive.ObjectID, notification *models.Notification) {
	event := WebSocketEvent{
		Type: "notification",
		Data: notification,
	}
	h.BroadcastToRoom("user:"+userID.Hex(), event)
}

// HandleNewMessage sends chat messages to both participants
func (h *Hub) HandleNewMessage(message *models.ChatMessage) {
	event := WebSocketEvent{
		Type: "chat_message",
		Data: message,
	}
	// Send to order room so both customer and driver receive it
	h.BroadcastToRoom("order:"+message.OrderID.Hex(), event)
}
func SetupWebSocketRoutes(router *gin.RouterGroup, authMiddleware gin.HandlerFunc) {
	ws := router.Group("/ws")
	ws.Use(authMiddleware)
	{
		ws.GET("/orders", OrderWebSocketHandler)
		ws.GET("/location", LocationWebSocketHandler)
		ws.GET("/notifications", NotificationWebSocketHandler)
		ws.GET("/chat", ChatWebSocketHandler)
	}
}
