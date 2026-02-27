package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/haile-paa/pedal-delivery/internal/models"
	"github.com/haile-paa/pedal-delivery/internal/repositories"
	"go.mongodb.org/mongo-driver/bson"
)

type AdminHandler struct {
	orderRepo      repositories.OrderRepository
	restaurantRepo repositories.RestaurantRepository
	driverRepo     repositories.DriverRepository
}

func NewAdminHandler(
	orderRepo repositories.OrderRepository,
	restaurantRepo repositories.RestaurantRepository,
	driverRepo repositories.DriverRepository,
) *AdminHandler {
	return &AdminHandler{
		orderRepo:      orderRepo,
		restaurantRepo: restaurantRepo,
		driverRepo:     driverRepo,
	}
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
		// If no delivered orders, set to 0
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
