package websocket

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/gorilla/websocket"
	"github.com/haile-paa/pedal-delivery/internal/repositories"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 4096
)

// driverRepo is set once at startup by SetDriverRepository so the WebSocket
// handler can persist online status and location without a full handler object.
var driverRepo repositories.DriverRepository

// SetDriverRepository injects the driver repository into the websocket package.
// Call this from main.go after creating the repository.
func SetDriverRepository(r repositories.DriverRepository) {
	driverRepo = r
}

type Client struct {
	hub    *Hub
	conn   *websocket.Conn
	send   chan []byte
	userID primitive.ObjectID
	role   string
	rooms  map[string]bool
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
				log.Printf("WebSocket read error: %v", err)
			}
			break
		}

		var msg map[string]interface{}
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("Error unmarshaling message: %v", err)
			continue
		}

		c.handleMessage(msg)
	}
}

func (c *Client) handleMessage(msg map[string]interface{}) {
	msgType, ok := msg["type"].(string)
	if !ok {
		return
	}

	data, _ := msg["data"].(map[string]interface{})

	switch msgType {
	case "ping":
		// respond with pong
		c.sendJSON(map[string]string{"type": "pong"})

	case "join:order_room":
		if orderID, ok := data["orderId"].(string); ok && orderID != "" {
			c.hub.JoinRoom(c, "order:"+orderID)
		}

	case "join:driver_room":
		if driverID, ok := data["driverId"].(string); ok && driverID != "" {
			c.hub.JoinRoom(c, "driver:"+driverID)
		}

	case "leave:room":
		if room, ok := data["room"].(string); ok && room != "" {
			c.hub.LeaveRoom(c, room)
		}

	// Driver sends this when they press the online/offline toggle.
	// Persists to DB and broadcasts to the "admin" room so the admin site
	// updates in real-time without a page refresh.
	case "driver_status":
		if c.role == "driver" {
			c.handleDriverStatus(data)
		}

	// Driver sends this periodically while online with their GPS coordinates.
	// Persists location to DB and broadcasts to the "admin" room.
	case "driver_location":
		if c.role == "driver" {
			c.handleDriverLocationUpdate(data)
		}

	case "location_update":
		c.handleLocationUpdate(data)

	case "order_status_update":
		c.handleOrderStatusUpdate(data)

	case "chat_message":
		c.handleChatMessage(data)

	default:
		log.Printf("Unknown message type: %s", msgType)
	}
}

// handleDriverStatus persists online/offline to MongoDB then pushes a
// driver_status_update event to every admin connected to the "admin" room.
func (c *Client) handleDriverStatus(data map[string]interface{}) {
	isOnline, ok := data["is_online"].(bool)
	if !ok {
		return
	}

	ctx := context.Background()

	// Persist to DB
	if driverRepo != nil {
		if err := driverRepo.UpdateOnlineStatus(ctx, c.userID, isOnline); err != nil {
			log.Printf("Failed to update driver online status: %v", err)
		}
	}

	// Broadcast to admin room
	event := WebSocketEvent{
		Type: "driver_status_update",
		Data: map[string]interface{}{
			"driver_id": c.userID.Hex(),
			"is_online": isOnline,
		},
	}
	hub.BroadcastToRoom("admin", event)

	log.Printf("Driver %s is now online=%v", c.userID.Hex(), isOnline)
}

// handleDriverLocationUpdate persists GPS to MongoDB then pushes a
// driver_location_update event to every admin in the "admin" room.
func (c *Client) handleDriverLocationUpdate(data map[string]interface{}) {
	lat, latOK := data["lat"].(float64)
	lng, lngOK := data["lng"].(float64)
	if !latOK || !lngOK {
		return
	}

	ctx := context.Background()

	// Persist to DB
	if driverRepo != nil {
		if err := driverRepo.UpdateLocation(ctx, c.userID, lng, lat); err != nil {
			log.Printf("Failed to update driver location: %v", err)
		}
	}

	// Broadcast to admin room
	event := WebSocketEvent{
		Type: "driver_location_update",
		Data: map[string]interface{}{
			"driver_id": c.userID.Hex(),
			"lat":       lat,
			"lng":       lng,
		},
	}
	hub.BroadcastToRoom("admin", event)
}

// handleLocationUpdate is the existing per-order location relay (customer tracking).
func (c *Client) handleLocationUpdate(data map[string]interface{}) {
	orderID, _ := data["orderId"].(string)
	location, _ := data["location"].(map[string]interface{})
	if orderID != "" && location != nil {
		event := WebSocketEvent{
			Type: "driver_location",
			Data: map[string]interface{}{
				"driver_id": c.userID,
				"location":  location,
				"order_id":  orderID,
			},
		}
		c.hub.BroadcastToRoom("order:"+orderID, event)
	}
}

func (c *Client) handleOrderStatusUpdate(data map[string]interface{}) {
	orderID, _ := data["orderId"].(string)
	if orderID != "" {
		event := WebSocketEvent{
			Type: "order_status_update",
			Data: data,
		}
		c.hub.BroadcastToRoom("order:"+orderID, event)
	}
}

func (c *Client) handleChatMessage(data map[string]interface{}) {
	orderID, _ := data["orderId"].(string)
	if orderID != "" {
		event := WebSocketEvent{
			Type: "chat_message",
			Data: data,
		}
		c.hub.BroadcastToRoom("order:"+orderID, event)
	}
}

func (c *Client) sendJSON(v interface{}) {
	b, err := json.Marshal(v)
	if err != nil {
		return
	}
	select {
	case c.send <- b:
	default:
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

			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
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
