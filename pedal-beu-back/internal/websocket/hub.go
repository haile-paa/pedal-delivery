package websocket

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/haile-paa/pedal-delivery/internal/models"
	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 512
)

var (
	newline = []byte{'\n'}
	space   = []byte{' '}
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins for development
		return true
	},
}

// Client represents a WebSocket client
type Client struct {
	hub    *Hub
	conn   *websocket.Conn
	send   chan []byte
	userID primitive.ObjectID
	role   string
	rooms  map[string]bool // Track which rooms the client has joined
}

// WebSocketEvent represents a WebSocket message
type WebSocketEvent struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

// Hub manages WebSocket clients
type Hub struct {
	clients    map[*Client]bool
	broadcast  chan WebSocketEvent
	register   chan *Client
	unregister chan *Client
	rooms      map[string]map[*Client]bool // Room name -> Clients in room
	mu         sync.RWMutex
}

// NewHub creates a new WebSocket hub
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan WebSocketEvent),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		rooms:      make(map[string]map[*Client]bool),
	}
}

// Run starts the hub
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				// Remove client from all rooms
				for roomName := range client.rooms {
					h.leaveRoom(client, roomName)
				}
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()

		case event := <-h.broadcast:
			h.broadcastEvent(event)
		}
	}
}

// joinRoom adds a client to a room
func (h *Hub) joinRoom(client *Client, roomName string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, exists := h.rooms[roomName]; !exists {
		h.rooms[roomName] = make(map[*Client]bool)
	}
	h.rooms[roomName][client] = true
	client.rooms[roomName] = true

	log.Printf("Client %s joined room: %s", client.userID.Hex(), roomName)
}

// leaveRoom removes a client from a room
func (h *Hub) leaveRoom(client *Client, roomName string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if room, exists := h.rooms[roomName]; exists {
		delete(room, client)
		if len(room) == 0 {
			delete(h.rooms, roomName)
		}
	}
	delete(client.rooms, roomName)
}

// broadcastEvent sends an event to all clients in the hub
func (h *Hub) broadcastEvent(event WebSocketEvent) {
	data, _ := json.Marshal(event)
	h.mu.RLock()
	for client := range h.clients {
		select {
		case client.send <- data:
		default:
			close(client.send)
			delete(h.clients, client)
		}
	}
	h.mu.RUnlock()
}

// sendToRoom sends an event to all clients in a specific room
func (h *Hub) sendToRoom(roomName string, event WebSocketEvent) {
	data, _ := json.Marshal(event)
	h.mu.RLock()
	if room, exists := h.rooms[roomName]; exists {
		for client := range room {
			select {
			case client.send <- data:
			default:
				close(client.send)
				delete(h.clients, client)
			}
		}
	}
	h.mu.RUnlock()
}

// sendToUser sends an event to a specific user
func (h *Hub) sendToUser(userID primitive.ObjectID, event WebSocketEvent) {
	data, _ := json.Marshal(event)
	h.mu.RLock()
	for client := range h.clients {
		if client.userID == userID {
			select {
			case client.send <- data:
			default:
				close(client.send)
				delete(h.clients, client)
			}
			break
		}
	}
	h.mu.RUnlock()
}

// BroadcastOrderUpdate broadcasts an order update to relevant clients
func (h *Hub) BroadcastOrderUpdate(order *models.Order) {
	event := WebSocketEvent{
		Type: "order:status_update",
		Data: map[string]interface{}{
			"orderId": order.ID.Hex(),
			"status":  order.Status,
			"message": getStatusMessage(order.Status),
		},
	}

	// Send to order room
	h.sendToRoom("order:"+order.ID.Hex(), event)

	// Send to customer
	h.sendToUser(order.CustomerID, event)

	// Send to driver if assigned
	if order.DriverID != nil && !order.DriverID.IsZero() {
		h.sendToUser(*order.DriverID, event)
	}

	log.Printf("📦 Order update broadcasted: %s - %s", order.ID.Hex(), order.Status)
}

// SendDriverAssigned sends driver assignment notification
func (h *Hub) SendDriverAssigned(order *models.Order, driver *models.Driver) {
	event := WebSocketEvent{
		Type: "driver:assigned",
		Data: map[string]interface{}{
			"orderId": order.ID.Hex(),
			"driver": map[string]interface{}{
				"id":                   driver.ID.Hex(),
				"name":                 driver.Name,
				"phone":                driver.Phone,
				"profile_picture":      driver.ProfilePicture,
				"rating":               driver.Rating,
				"vehicle_type":         driver.VehicleType,
				"license_plate":        driver.LicensePlate,
				"completed_deliveries": driver.CompletedDeliveries,
			},
		},
	}

	// Send to order room
	h.sendToRoom("order:"+order.ID.Hex(), event)

	// Send to customer
	h.sendToUser(order.CustomerID, event)

	log.Printf("🚗 Driver assigned: %s to order: %s", driver.ID.Hex(), order.ID.Hex())
}

// SendDriverLocation sends driver location update
func (h *Hub) SendDriverLocation(driverID primitive.ObjectID, location models.GeoLocation, orderID string) {
	event := WebSocketEvent{
		Type: "driver:location_update",
		Data: map[string]interface{}{
			"driverId": driverID.Hex(),
			"orderId":  orderID,
			"location": map[string]interface{}{
				"type":        "Point",
				"coordinates": []float64{location.Longitude, location.Latitude},
			},
		},
	}

	// Send to order room
	h.sendToRoom("order:"+orderID, event)

	log.Printf("📍 Driver location update: %s for order: %s", driverID.Hex(), orderID)
}

// SendNotification sends a notification to a user
func (h *Hub) SendNotification(userID primitive.ObjectID, notification *models.Notification) {
	event := WebSocketEvent{
		Type: "notification",
		Data: notification,
	}

	h.sendToUser(userID, event)
}

// HandleNewMessage handles chat messages
func (h *Hub) HandleNewMessage(message *models.ChatMessage) {
	event := WebSocketEvent{
		Type: "chat_message",
		Data: message,
	}

	// Send to both sender and receiver
	h.sendToUser(message.SenderID, event)
	h.sendToUser(message.ReceiverID, event)
}

// Helper function to get status message
func getStatusMessage(status string) string {
	switch status {
	case "pending":
		return "Your order has been placed and is awaiting confirmation."
	case "accepted":
		return "Restaurant has accepted your order."
	case "preparing":
		return "Restaurant is preparing your food."
	case "ready":
		return "Your order is ready for pickup."
	case "picked_up":
		return "Driver has picked up your order and is on the way."
	case "delivered":
		return "Your order has been delivered. Enjoy your meal!"
	case "cancelled":
		return "Your order has been cancelled."
	default:
		return "Order status updated."
	}
}

// Client handlers
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket read error: %v", err)
			}
			break
		}

		c.handleMessage(message)
	}
}

func (c *Client) handleMessage(message []byte) {
	var msg map[string]interface{}
	if err := json.Unmarshal(message, &msg); err != nil {
		log.Printf("Error unmarshaling message: %v", err)
		return
	}

	msgType, ok := msg["type"].(string)
	if !ok {
		return
	}

	switch msgType {
	case "ping":
		// Handle ping (keep-alive)
		c.sendPong()
	case "join:order_room":
		c.handleJoinOrderRoom(msg)
	case "driver:location_update":
		c.handleDriverLocationUpdate(msg)
	default:
		log.Printf("Unhandled message type: %s", msgType)
	}
}

func (c *Client) handleJoinOrderRoom(msg map[string]interface{}) {
	data, ok := msg["data"].(map[string]interface{})
	if !ok {
		return
	}

	orderId, ok := data["orderId"].(string)
	if !ok {
		return
	}

	// Join the order room
	c.hub.joinRoom(c, "order:"+orderId)
	log.Printf("Client %s joined order room: %s", c.userID.Hex(), orderId)

	// Send confirmation
	event := WebSocketEvent{
		Type: "room_joined",
		Data: map[string]interface{}{
			"room":    "order:" + orderId,
			"success": true,
		},
	}
	c.sendEvent(event)
}

func (c *Client) handleDriverLocationUpdate(msg map[string]interface{}) {
	data, ok := msg["data"].(map[string]interface{})
	if !ok {
		return
	}

	// Parse location data
	locationData, ok := data["location"].(map[string]interface{})
	if !ok {
		return
	}

	orderId, ok := data["orderId"].(string)
	if !ok {
		return
	}

	// Extract coordinates
	var lat, lng float64
	if coords, ok := locationData["coordinates"].([]interface{}); ok && len(coords) >= 2 {
		if lngVal, ok := coords[0].(float64); ok {
			lng = lngVal
		}
		if latVal, ok := coords[1].(float64); ok {
			lat = latVal
		}
	} else if latVal, ok := locationData["lat"].(float64); ok {
		lat = latVal
		if lngVal, ok := locationData["lng"].(float64); ok {
			lng = lngVal
		}
	}

	// Broadcast location update
	if lat != 0 && lng != 0 {
		location := models.GeoLocation{
			Type:        "Point",
			Coordinates: []float64{lng, lat},
		}
		c.hub.SendDriverLocation(c.userID, location, orderId)
	}
}

func (c *Client) sendPong() {
	event := WebSocketEvent{
		Type: "pong",
		Data: map[string]interface{}{
			"timestamp": time.Now().Unix(),
		},
	}
	c.sendEvent(event)
}

func (c *Client) sendEvent(event WebSocketEvent) {
	data, _ := json.Marshal(event)
	select {
	case c.send <- data:
	default:
		close(c.send)
		delete(c.hub.clients, c)
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Write queued messages
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write(newline)
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}