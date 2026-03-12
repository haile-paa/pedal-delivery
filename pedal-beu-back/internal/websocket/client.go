package websocket

import (
	"encoding/json"
	"log"
	"time"

	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 512
)

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
	case "join:order_room":
		if orderID, ok := data["orderId"].(string); ok && orderID != "" {
			c.hub.JoinRoom(c, "order:"+orderID) // ✅ fixed: JoinRoom (capital J)
		}
	case "join:driver_room":
		if driverID, ok := data["driverId"].(string); ok && driverID != "" {
			c.hub.JoinRoom(c, "driver:"+driverID) // ✅ fixed
		}
	case "leave:room":
		if room, ok := data["room"].(string); ok && room != "" {
			c.hub.LeaveRoom(c, room) // ✅ fixed: LeaveRoom (capital L)
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
