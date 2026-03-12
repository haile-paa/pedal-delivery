package websocket

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins in development; restrict in production.
		return true
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

var hub *Hub

func init() {
	hub = NewHub()
	go hub.Run()
	GlobalHub = hub // 👈 Export the hub for other packages
}

func GetHub() *Hub {
	return hub
}

func OrderWebSocketHandler(c *gin.Context) {
	wsHandler(c, "orders")
}

func LocationWebSocketHandler(c *gin.Context) {
	wsHandler(c, "location")
}

func NotificationWebSocketHandler(c *gin.Context) {
	wsHandler(c, "notifications")
}

func ChatWebSocketHandler(c *gin.Context) {
	wsHandler(c, "chat")
}

func wsHandler(c *gin.Context, channel string) {
	// Get user from context (set by AuthMiddleware)
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	userRole, _ := c.Get("userRole")

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to upgrade connection"})
		return
	}

	client := &Client{
		hub:    hub,
		conn:   conn,
		send:   make(chan []byte, 256),
		userID: userID.(primitive.ObjectID),
		role:   userRole.(string),
	}

	client.hub.register <- client

	// 👇 AUTOMATIC ROOM JOINING BASED ON ROLE
	if client.role == "driver" {
		hub.JoinRoom(client, "drivers")                     // all drivers
		hub.JoinRoom(client, "driver:"+client.userID.Hex()) // personal room
	} else if client.role == "customer" {
		hub.JoinRoom(client, "customers")                 // all customers (optional)
		hub.JoinRoom(client, "user:"+client.userID.Hex()) // personal room
	}

	go client.writePump()
	go client.readPump()
}
