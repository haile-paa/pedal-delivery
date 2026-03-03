package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/haile-paa/pedal-delivery/internal/models"
	"github.com/haile-paa/pedal-delivery/internal/repositories"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type AdminHandler struct {
	orderRepo      repositories.OrderRepository
	restaurantRepo repositories.RestaurantRepository
	driverRepo     repositories.DriverRepository
	adminRepo      repositories.AdminRepository // added
}

func NewAdminHandler(
	orderRepo repositories.OrderRepository,
	restaurantRepo repositories.RestaurantRepository,
	driverRepo repositories.DriverRepository,
	adminRepo repositories.AdminRepository, // added
) *AdminHandler {
	return &AdminHandler{
		orderRepo:      orderRepo,
		restaurantRepo: restaurantRepo,
		driverRepo:     driverRepo,
		adminRepo:      adminRepo,
	}
}

// GetProfile returns the current admin's profile
// @Summary Get admin profile
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Success 200 {object} models.Admin
// @Router /api/v1/admin/profile [get]
func (h *AdminHandler) GetProfile(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	objID, err := primitive.ObjectIDFromHex(userID.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	admin, err := h.adminRepo.FindByID(c.Request.Context(), objID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Admin not found"})
		return
	}

	// Map to frontend-friendly JSON (camelCase)
	c.JSON(http.StatusOK, gin.H{
		"id":         admin.ID.Hex(),
		"phone":      admin.Phone,
		"email":      admin.Email,
		"firstName":  admin.FirstName,
		"lastName":   admin.LastName,
		"isVerified": admin.IsVerified,
		"isActive":   admin.IsActive,
		"lastLogin":  admin.LastLoginAt,
		"createdAt":  admin.CreatedAt,
		"updatedAt":  admin.UpdatedAt,
	})
}

// UpdateProfile updates the current admin's profile
// @Summary Update admin profile
// @Tags admin
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body object {email:"string", firstName:"string", lastName:"string"}
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/admin/profile [put]
func (h *AdminHandler) UpdateProfile(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	objID, err := primitive.ObjectIDFromHex(userID.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var req struct {
		Email     string `json:"email"`
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	update := bson.M{}
	if req.Email != "" {
		update["email"] = req.Email
	}
	if req.FirstName != "" {
		update["first_name"] = req.FirstName
	}
	if req.LastName != "" {
		update["last_name"] = req.LastName
	}

	if len(update) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No fields to update"})
		return
	}

	err = h.adminRepo.Update(c.Request.Context(), objID, update)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Profile updated successfully"})
}

// GetDashboardStats returns aggregated statistics for the admin dashboard.
// @Summary Get dashboard stats
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/admin/dashboard/stats [get]
func (h *AdminHandler) GetDashboardStats(c *gin.Context) {
	ctx := c.Request.Context()

	// Today's date range
	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)

	// Total orders today
	totalOrdersToday, err := h.orderRepo.CountOrders(ctx, bson.M{
		"created_at": bson.M{"$gte": startOfDay, "$lt": endOfDay},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Total revenue today (from delivered orders)
	revenueToday, err := h.orderRepo.SumRevenue(ctx, bson.M{
		"created_at": bson.M{"$gte": startOfDay, "$lt": endOfDay},
		"status":     models.OrderDelivered,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Average delivery time for today's delivered orders
	avgDeliveryTime, err := h.orderRepo.AverageDeliveryTime(ctx, bson.M{
		"created_at": bson.M{"$gte": startOfDay, "$lt": endOfDay},
		"status":     models.OrderDelivered,
	})
	if err != nil {
		avgDeliveryTime = 0
	}

	// Active drivers (online and not on break)
	activeDrivers, err := h.driverRepo.CountActive(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Recent orders (last 10)
	recentOrders, err := h.orderRepo.FindRecent(ctx, 10)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Top restaurants by order count (last 30 days)
	topRestaurants, err := h.restaurantRepo.FindTopByOrders(ctx, 5, 30*24*time.Hour)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Order status distribution for today
	statusCounts, err := h.orderRepo.CountByStatus(ctx, bson.M{
		"created_at": bson.M{"$gte": startOfDay, "$lt": endOfDay},
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Revenue over last 7 days (daily aggregates)
	revenueOverTime, err := h.orderRepo.RevenueByDay(ctx, 7)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Prepare response
	c.JSON(http.StatusOK, gin.H{
		"stats": gin.H{
			"totalOrders":     totalOrdersToday,
			"totalRevenue":    revenueToday,
			"avgDeliveryTime": avgDeliveryTime,
			"activeDrivers":   activeDrivers,
		},
		"recentOrders":    recentOrders,
		"topRestaurants":  topRestaurants,
		"statusCounts":    statusCounts,
		"revenueOverTime": revenueOverTime,
	})
}
