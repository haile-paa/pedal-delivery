package websocket

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/haile-paa/pedal-delivery/internal/models"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// GlobalHub is the singleton hub instance accessible from other packages.
var GlobalHub *Hub

type WebSocketEvent struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

// internalBroadcast pairs an event with its target room for routing inside
// Run(), without mutating the event's own Data field. Previously,
// BroadcastToRoom smuggled the room name into event.Data itself — which
// silently double-wrapped any non-map payload (e.g. *models.Order,
// *models.Notification, *models.ChatMessage — i.e. almost everything) into
// {"data": <real payload>, "room": "..."} before it was ever sent to
// clients. The frontend never knew to unwrap that extra layer, so
// order:new, order_update, notification, and chat_message all silently
// delivered wrong-shaped, effectively unusable payloads.
type internalBroadcast struct {
	room  string // empty = broadcast to all connected clients
	event WebSocketEvent
}

type Hub struct {
	clients    map[*Client]bool
	rooms      map[string]map[*Client]bool // room name -> set of clients
	broadcast  chan internalBroadcast
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		rooms:      make(map[string]map[*Client]bool),
		broadcast:  make(chan internalBroadcast),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		h.runOnce()
	}
}

// runOnce processes exactly one hub event (register/unregister/broadcast)
// with panic recovery, so a bug handling one client/event can never crash
// the whole server — it just logs and the loop continues. Without this,
// an unrecovered panic here kills the entire Go process, since this
// goroutine isn't covered by gin's HTTP-level Recovery middleware.
func (h *Hub) runOnce() {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("recovered from panic in websocket hub: %v", r)
		}
	}()

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
			client.markClosed()
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

	case msg := <-h.broadcast:
		payload := h.serializeEvent(msg.event)
		h.mu.RLock()
		if msg.room != "" {
			// Send to a specific room only
			if clients, exists := h.rooms[msg.room]; exists {
				for client := range clients {
					if !client.safeSend(payload) {
						go h.unregisterClient(client)
					}
				}
			}
		} else {
			// Broadcast to all connected clients
			for client := range h.clients {
				if !client.safeSend(payload) {
					go h.unregisterClient(client)
				}
			}
		}
		h.mu.RUnlock()
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
func (h *Hub) JoinRoom(client *Client, room string) {
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
func (h *Hub) LeaveRoom(client *Client, room string) {
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
	h.broadcast <- internalBroadcast{room: room, event: event}
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

// SetupWebSocketRoutes registers WebSocket endpoints.
// The Hub itself is created once in handler.go's init() (as `hub`/GlobalHub);
// this must NOT create a second Hub, or broadcasts via GlobalHub (e.g. new
// order notifications in order_handler.go) end up in an empty hub that no
// real client is registered with. See handler.go.
func SetupWebSocketRoutes(router *gin.RouterGroup, authMiddleware gin.HandlerFunc) {
	ws := router.Group("/ws")
	ws.Use(authMiddleware)
	{
		ws.GET("/orders", OrderWebSocketHandler)
		ws.GET("/location", LocationWebSocketHandler)
		ws.GET("/notifications", NotificationWebSocketHandler)
		ws.GET("/chat", ChatWebSocketHandler)
		ws.GET("/drivers", DriversWebSocketHandler) // admin live driver monitoring
	}
}