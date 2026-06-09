package websocket

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

var hub *Hub

func init() {
	hub = NewHub()
	go hub.Run()
	GlobalHub = hub
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

// DriversWebSocketHandler is for admins only.
// The admin joins the "admin" room so it receives driver_status_update
// and driver_location_update events broadcast by the driver's client.
func DriversWebSocketHandler(c *gin.Context) {
	userRole, _ := c.Get("userRole")
	if userRole != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return
	}
	wsHandler(c, "admin")
}

func wsHandler(c *gin.Context, channel string) {
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
		rooms:  make(map[string]bool), // must be initialized before any JoinRoom call
	}

	client.hub.register <- client

	switch client.role {
	case "driver":
		hub.JoinRoom(client, "drivers")
		hub.JoinRoom(client, "driver:"+client.userID.Hex())
	case "customer":
		hub.JoinRoom(client, "customers")
		hub.JoinRoom(client, "user:"+client.userID.Hex())
	case "admin":
		hub.JoinRoom(client, "admin")
	}

	go client.writePump()
	go client.readPump()
}