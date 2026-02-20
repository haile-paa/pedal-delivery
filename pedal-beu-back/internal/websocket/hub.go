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
}

type Client struct {
	hub    *Hub
	conn   *websocket.Conn
	send   chan []byte
	userID primitive.ObjectID
	role   string
}

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
				log.Printf("error: %v", err)
			}
			break
		}

		var msg map[string]interface{}
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("error unmarshaling message: %v", err)
			continue
		}

		// Handle different message types
		c.handleMessage(msg)
	}
}

func (c *Client) handleMessage(msg map[string]interface{}) {
	msgType, ok := msg["type"].(string)
	if !ok {
		return
	}

	switch msgType {
	case "location_update":
		c.handleLocationUpdate(msg)
	case "order_status_update":
		c.handleOrderStatusUpdate(msg)
	case "chat_message":
		c.handleChatMessage(msg)
	}
}

func (c *Client) handleLocationUpdate(msg map[string]interface{}) {
	// Broadcast location to relevant clients
	event := WebSocketEvent{
		Type: "location_update",
		Data: msg["data"],
	}

	c.hub.broadcast <- event
}

func (c *Client) handleOrderStatusUpdate(msg map[string]interface{}) {
	event := WebSocketEvent{
		Type: "order_status_update",
		Data: msg["data"],
	}

	c.hub.broadcast <- event
}

func (c *Client) handleChatMessage(msg map[string]interface{}) {
	event := WebSocketEvent{
		Type: "chat_message",
		Data: msg["data"],
	}

	c.hub.broadcast <- event
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

type WebSocketEvent struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

type Hub struct {
	clients    map[*Client]bool
	broadcast  chan WebSocketEvent
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
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
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()

		case event := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- h.serializeEvent(event):
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) serializeEvent(event WebSocketEvent) []byte {
	data, _ := json.Marshal(event)
	return data
}

func (h *Hub) BroadcastOrderUpdate(order *models.Order) {
	event := WebSocketEvent{
		Type: "order_update",
		Data: order,
	}
	h.broadcast <- event
}

func (h *Hub) SendDriverLocation(driverID primitive.ObjectID, location models.GeoLocation) {
	event := WebSocketEvent{
		Type: "driver_location",
		Data: map[string]interface{}{
			"driver_id": driverID,
			"location":  location,
		},
	}
	h.broadcast <- event
}

func (h *Hub) SendNotification(userID primitive.ObjectID, notification *models.Notification) {
	event := WebSocketEvent{
		Type: "notification",
		Data: notification,
	}

	// Send to specific user
	h.mu.RLock()
	for client := range h.clients {
		if client.userID == userID {
			select {
			case client.send <- h.serializeEvent(event):
			default:
				close(client.send)
				delete(h.clients, client)
			}
		}
	}
	h.mu.RUnlock()
}

func (h *Hub) HandleNewMessage(message *models.ChatMessage) {
	event := WebSocketEvent{
		Type: "chat_message",
		Data: message,
	}

	// Send to both sender and receiver
	h.mu.RLock()
	for client := range h.clients {
		if client.userID == message.SenderID || client.userID == message.ReceiverID {
			select {
			case client.send <- h.serializeEvent(event):
			default:
				close(client.send)
				delete(h.clients, client)
			}
		}
	}
	h.mu.RUnlock()
}
