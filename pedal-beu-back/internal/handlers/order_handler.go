package handlers

import (
	"net/http"
	"strconv"

	"github.com/haile-paa/pedal-delivery/internal/models"
	"github.com/haile-paa/pedal-delivery/internal/services"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type OrderHandler struct {
	orderService services.OrderService
}

func NewOrderHandler(orderService services.OrderService) *OrderHandler {
	return &OrderHandler{
		orderService: orderService,
	}
}

// GetAllOrders returns all orders with pagination (admin only)
// @Summary Get all orders
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(20)
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/admin/orders [get]
func (h *OrderHandler) GetAllOrders(c *gin.Context) {
	userRole := c.MustGet("userRole").(string)
	if userRole != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return
	}

	page, _ := strconv.ParseInt(c.DefaultQuery("page", "1"), 10, 64)
	limit, _ := strconv.ParseInt(c.DefaultQuery("limit", "20"), 10, 64)

	orders, total, err := h.orderService.GetAllOrders(c.Request.Context(), page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"orders": orders,
		"pagination": gin.H{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}

// @Summary Create a new order
// @Description Create a new food delivery order
// @Tags orders
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body models.CreateOrderRequest true "Order data"
// @Success 201 {object} models.Order
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Router /api/v1/orders [post]
func (h *OrderHandler) CreateOrder(c *gin.Context) {
	userID := c.MustGet("userID").(primitive.ObjectID)
	userRole := c.MustGet("userRole").(string)

	if userRole != "customer" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only customers can create orders"})
		return
	}

	var req models.CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	order, err := h.orderService.CreateOrder(c.Request.Context(), userID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, order)
}

// @Summary Get order by ID
// @Description Get order details by order ID
// @Tags orders
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Order ID"
// @Success 200 {object} models.Order
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Router /api/v1/orders/{id} [get]
func (h *OrderHandler) GetOrderByID(c *gin.Context) {
	userID := c.MustGet("userID").(primitive.ObjectID)
	userRole := c.MustGet("userRole").(string)

	orderID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order ID"})
		return
	}

	order, err := h.orderService.GetOrderByID(c.Request.Context(), orderID, userID, userRole)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, order)
}

// @Summary Get customer orders
// @Description Get all orders for the current customer
// @Tags orders
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(10)
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Router /api/v1/orders [get]
func (h *OrderHandler) GetCustomerOrders(c *gin.Context) {
	userID := c.MustGet("userID").(primitive.ObjectID)
	userRole := c.MustGet("userRole").(string)

	if userRole != "customer" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only customers can view their orders"})
		return
	}

	page, _ := strconv.ParseInt(c.DefaultQuery("page", "1"), 10, 64)
	limit, _ := strconv.ParseInt(c.DefaultQuery("limit", "10"), 10, 64)

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 10
	}

	orders, total, err := h.orderService.GetCustomerOrders(c.Request.Context(), userID, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	response := gin.H{
		"orders": orders,
		"pagination": gin.H{
			"page":  page,
			"limit": limit,
			"total": total,
			"pages": (total + limit - 1) / limit,
		},
	}

	c.JSON(http.StatusOK, response)
}

// @Summary Cancel order
// @Description Cancel an order
// @Tags orders
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Order ID"
// @Param request body map[string]string true "Cancellation reason"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Router /api/v1/orders/{id}/cancel [post]
func (h *OrderHandler) CancelOrder(c *gin.Context) {
	userID := c.MustGet("userID").(primitive.ObjectID)
	userRole := c.MustGet("userRole").(string)

	orderID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order ID"})
		return
	}

	var req struct {
		Reason string `json:"reason" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err = h.orderService.CancelOrder(c.Request.Context(), orderID, userID, userRole, req.Reason)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Order cancelled successfully"})
}

// @Summary Rate order
// @Description Rate a delivered order
// @Tags orders
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Order ID"
// @Param request body models.OrderRating true "Rating data"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Router /api/v1/orders/{id}/rate [post]
func (h *OrderHandler) RateOrder(c *gin.Context) {
	userID := c.MustGet("userID").(primitive.ObjectID)
	userRole := c.MustGet("userRole").(string)
	_ = userID // Mark as used for now
	if userRole != "customer" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only customers can rate orders"})
		return
	}

	orderID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order ID"})
		return
	}

	var rating models.OrderRating
	if err := c.ShouldBindJSON(&rating); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate ratings (1-5)
	if rating.FoodRating < 1 || rating.FoodRating > 5 ||
		rating.DeliveryRating < 1 || rating.DeliveryRating > 5 ||
		rating.RestaurantRating < 1 || rating.RestaurantRating > 5 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Ratings must be between 1 and 5"})
		return
	}

	err = h.orderService.RateOrder(c.Request.Context(), orderID, &rating)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Order rated successfully"})
}

// @Summary Get available orders for drivers
// @Description Get orders available for pickup by drivers
// @Tags driver
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param lat query number true "Driver latitude"
// @Param lng query number true "Driver longitude"
// @Param radius query number false "Search radius in meters" default(5000)
// @Success 200 {object} []models.Order
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Router /api/v1/driver/orders/available [get]
func (h *OrderHandler) GetAvailableOrders(c *gin.Context) {
	userID := c.MustGet("userID").(primitive.ObjectID)
	userRole := c.MustGet("userRole").(string)

	_ = userID // Mark as used for now

	if userRole != "driver" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only drivers can view available orders"})
		return
	}

	lat, err := strconv.ParseFloat(c.Query("lat"), 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid latitude"})
		return
	}

	lng, err := strconv.ParseFloat(c.Query("lng"), 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid longitude"})
		return
	}

	radius, _ := strconv.ParseFloat(c.DefaultQuery("radius", "5000"), 64)

	location := models.GeoLocation{
		Type:        "Point",
		Coordinates: []float64{lng, lat},
	}

	orders, err := h.orderService.GetAvailableOrders(c.Request.Context(), location, radius)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, orders)
}

// @Summary Accept order by driver
// @Description Driver accepts an available order
// @Tags driver
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Order ID"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Router /api/v1/driver/orders/{id}/accept [post]
func (h *OrderHandler) AcceptOrder(c *gin.Context) {
	driverID := c.MustGet("userID").(primitive.ObjectID)
	userRole := c.MustGet("userRole").(string)

	if userRole != "driver" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only drivers can accept orders"})
		return
	}

	orderID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order ID"})
		return
	}

	err = h.orderService.AssignDriver(c.Request.Context(), orderID, driverID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Order accepted successfully"})
}

// @Summary Update order status
// @Description Update order status (for drivers and restaurants)
// @Tags orders
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Order ID"
// @Param request body map[string]string true "New status"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Router /api/v1/orders/{id}/status [put]
func (h *OrderHandler) UpdateOrderStatus(c *gin.Context) {
	userID := c.MustGet("userID").(primitive.ObjectID)
	userRole := c.MustGet("userRole").(string)

	orderID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid order ID"})
		return
	}

	var req struct {
		Status models.OrderStatus `json:"status" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err = h.orderService.UpdateOrderStatus(c.Request.Context(), orderID, req.Status, userID, userRole)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Order status updated successfully"})
}
