package websocket

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

var hub *Hub

func init() {
	hub = NewHub()
	go hub.Run()
}

func GetHub() *Hub {
	return hub
}

// wsHandler handles WebSocket connections
func wsHandler(c *gin.Context, channel string) {
	// Get user from context (requires AuthMiddleware before this handler)
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	userRoleVal, _ := c.Get("userRole")
	
	// Convert userID to primitive.ObjectID
	var userID primitive.ObjectID
	switch v := userIDVal.(type) {
	case primitive.ObjectID:
		userID = v
	case string:
		var err error
		userID, err = primitive.ObjectIDFromHex(v)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
			return
		}
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID type"})
		return
	}

	userRole, _ := userRoleVal.(string)

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade WebSocket connection: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to upgrade connection"})
		return
	}

	client := &Client{
		hub:    hub,
		conn:   conn,
		send:   make(chan []byte, 256),
		userID: userID,
		role:   userRole,
		rooms:  make(map[string]bool),
	}

	// Register client
	client.hub.register <- client

	log.Printf("New WebSocket connection: UserID=%s, Role=%s", userID.Hex(), userRole)

	// Start read and write pumps
	go client.writePump()
	go client.readPump()
}

// OrderWebSocketHandler handles order-related WebSocket connections
func OrderWebSocketHandler(c *gin.Context) {
	wsHandler(c, "orders")
}

// LocationWebSocketHandler handles location WebSocket connections
func LocationWebSocketHandler(c *gin.Context) {
	wsHandler(c, "location")
}

// NotificationWebSocketHandler handles notification WebSocket connections
func NotificationWebSocketHandler(c *gin.Context) {
	wsHandler(c, "notifications")
}

// ChatWebSocketHandler handles chat WebSocket connections
func ChatWebSocketHandler(c *gin.Context) {
	wsHandler(c, "chat")
}

// SetupWebSocketRoutes sets up WebSocket routes
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

// WebSocket health check endpoint
func WebSocketHealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":      "ok",
		"clients":     len(hub.clients),
		"rooms":       len(hub.rooms),
		"server_time": time.Now().Unix(),
	})
}