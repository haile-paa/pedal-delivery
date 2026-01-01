package handlers

import (
	"log"
	"math"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/haile-paa/pedal-delivery/internal/models"
	"github.com/haile-paa/pedal-delivery/internal/services"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type RestaurantHandler struct {
	service services.RestaurantService
}

func NewRestaurantHandler(service services.RestaurantService) *RestaurantHandler {
	return &RestaurantHandler{service: service}
}

// Helper function to calculate distance between two points (Haversine formula)
func calculateDistance(point1, point2 models.GeoLocation) float64 {
	if len(point1.Coordinates) != 2 || len(point2.Coordinates) != 2 {
		return 0
	}

	const R = 6371 // Earth's radius in kilometers

	lat1 := point1.Coordinates[1] * math.Pi / 180
	lon1 := point1.Coordinates[0] * math.Pi / 180
	lat2 := point2.Coordinates[1] * math.Pi / 180
	lon2 := point2.Coordinates[0] * math.Pi / 180

	dlat := lat2 - lat1
	dlon := lon2 - lon1

	a := math.Sin(dlat/2)*math.Sin(dlat/2) +
		math.Cos(lat1)*math.Cos(lat2)*math.Sin(dlon/2)*math.Sin(dlon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return R * c
}

// GetRestaurants godoc
// @Summary Get restaurants
// @Description Get list of restaurants with optional filters
// @Tags restaurants
// @Accept json
// @Produce json
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(20)
// @Param category query string false "Filter by category/cuisine type"
// @Param latitude query number false "User latitude for location-based filtering"
// @Param longitude query number false "User longitude for location-based filtering"
// @Param radius query number false "Search radius in meters" default(10000)
// @Param calculate_distance query bool false "Calculate distance to each restaurant" default(false)
// @Success 200 {object} gin.H{"data": []models.RestaurantWithDistance, "pagination": gin.H{"page":1,"limit":20,"total":100}}
// @Router /restaurants [get]
func (h *RestaurantHandler) GetRestaurants(c *gin.Context) {
	var query struct {
		Page              int     `form:"page" default:"1"`
		Limit             int     `form:"limit" default:"20"`
		Category          string  `form:"category"`
		Latitude          float64 `form:"latitude"`
		Longitude         float64 `form:"longitude"`
		Radius            float64 `form:"radius" default:"10000"`
		CalculateDistance bool    `form:"calculate_distance" default:"false"`
	}

	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid query parameters",
			"data":  []interface{}{}, // Always return empty array, not null
		})
		return
	}

	if query.Page < 1 {
		query.Page = 1
	}
	if query.Limit < 1 || query.Limit > 100 {
		query.Limit = 20
	}

	// Get restaurants (with or without location filter)
	restaurants, total, err := h.service.GetRestaurants(c.Request.Context(), models.RestaurantQuery{
		Page:      query.Page,
		Limit:     query.Limit,
		Category:  query.Category,
		Latitude:  query.Latitude,
		Longitude: query.Longitude,
		Radius:    query.Radius,
	})

	if err != nil {
		log.Printf("Error fetching restaurants: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to fetch restaurants",
			"data":  []interface{}{}, // Always return empty array, not null
		})
		return
	}

	// Initialize responseData as empty array (not nil)
	responseData := make([]interface{}, 0)

	// If user wants distance calculated AND has location, calculate distances
	if query.CalculateDistance && query.Latitude != 0 && query.Longitude != 0 {
		userLocation := models.GeoLocation{
			Type:        "Point",
			Coordinates: []float64{query.Longitude, query.Latitude},
		}

		for _, restaurant := range restaurants {
			distance := calculateDistance(userLocation, restaurant.Location)
			restaurantWithDistance := gin.H{
				"restaurant":  restaurant,
				"distance_km": math.Round(distance*100) / 100,
				"distance_m":  math.Round(distance*1000*100) / 100,
			}
			responseData = append(responseData, restaurantWithDistance)
		}
	} else {
		// Return restaurants without distance
		for _, restaurant := range restaurants {
			responseData = append(responseData, restaurant)
		}
	}

	// Calculate total pages
	totalPages := int(math.Ceil(float64(total) / float64(query.Limit)))
	if totalPages < 1 {
		totalPages = 1
	}

	c.JSON(http.StatusOK, gin.H{
		"data": responseData, // This will be [] instead of null
		"pagination": gin.H{
			"page":        query.Page,
			"limit":       query.Limit,
			"total":       total,
			"total_pages": totalPages,
		},
	})
}

// GetRestaurantByID godoc
// @Summary Get restaurant by ID
// @Description Get detailed information about a restaurant
// @Tags restaurants
// @Accept json
// @Produce json
// @Param id path string true "Restaurant ID"
// @Success 200 {object} models.Restaurant
// @Router /restaurants/{id} [get]
func (h *RestaurantHandler) GetRestaurantByID(c *gin.Context) {
	id := c.Param("id")

	restaurant, err := h.service.GetRestaurantByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Restaurant not found"})
		return
	}

	c.JSON(http.StatusOK, restaurant)
}

// GetNearbyRestaurants godoc
// @Summary Get nearby restaurants
// @Description Get restaurants near a specific location
// @Tags restaurants
// @Accept json
// @Produce json
// @Param latitude query number true "Latitude"
// @Param longitude query number true "Longitude"
// @Param radius query number false "Search radius in meters" default(10000)
// @Success 200 {array} models.Restaurant
// @Router /restaurants/nearby [get]
func (h *RestaurantHandler) GetNearbyRestaurants(c *gin.Context) {
	var req struct {
		Latitude  float64 `form:"latitude" binding:"required"`
		Longitude float64 `form:"longitude" binding:"required"`
		Radius    float64 `form:"radius" default:"10000"`
	}

	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid location parameters"})
		return
	}

	location := models.GeoLocation{
		Type:        "Point",
		Coordinates: []float64{req.Longitude, req.Latitude},
	}

	restaurants, err := h.service.FindNearby(c.Request.Context(), location, req.Radius)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to find nearby restaurants"})
		return
	}

	c.JSON(http.StatusOK, restaurants)
}

// SearchRestaurants godoc
// @Summary Search restaurants
// @Description Search restaurants by name, description, or cuisine type
// @Tags restaurants
// @Accept json
// @Produce json
// @Param q query string true "Search query"
// @Param latitude query number false "User latitude for location-based search"
// @Param longitude query number false "User longitude for location-based search"
// @Success 200 {array} models.Restaurant
// @Router /restaurants/search [get]
func (h *RestaurantHandler) SearchRestaurants(c *gin.Context) {
	var req struct {
		Query     string  `form:"q" binding:"required"`
		Latitude  float64 `form:"latitude"`
		Longitude float64 `form:"longitude"`
	}

	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid search parameters"})
		return
	}

	var location *models.GeoLocation
	if req.Latitude != 0 && req.Longitude != 0 {
		location = &models.GeoLocation{
			Type:        "Point",
			Coordinates: []float64{req.Longitude, req.Latitude},
		}
	}

	restaurants, err := h.service.Search(c.Request.Context(), req.Query, location)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search restaurants"})
		return
	}

	c.JSON(http.StatusOK, restaurants)
}

// GetRestaurantMenu godoc
// @Summary Get restaurant menu
// @Description Get menu items for a specific restaurant
// @Tags restaurants
// @Accept json
// @Produce json
// @Param id path string true "Restaurant ID"
// @Success 200 {array} models.MenuItem
// @Router /restaurants/{id}/menu [get]
func (h *RestaurantHandler) GetRestaurantMenu(c *gin.Context) {
	restaurantID := c.Param("id")

	menu, err := h.service.GetMenuItems(c.Request.Context(), restaurantID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Restaurant or menu not found"})
		return
	}

	c.JSON(http.StatusOK, menu)
}

// CreateRestaurant godoc
// @Summary Create a new restaurant
// @Description Create a new restaurant (admin/owner only)
// @Tags restaurants
// @Accept json
// @Produce json
// @Security ApiKeyAuth
// @Param restaurant body models.CreateRestaurantRequest true "Restaurant data"
// @Success 201 {object} models.Restaurant
// @Router /restaurants [post]
func (h *RestaurantHandler) CreateRestaurant(c *gin.Context) {
	var req models.CreateRestaurantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get user ID from context (set by AuthMiddleware)
	userIDInterface, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Convert userID to string (it's stored as primitive.ObjectID in context)
	var userIDStr string
	switch v := userIDInterface.(type) {
	case primitive.ObjectID:
		userIDStr = v.Hex()
	case string:
		userIDStr = v
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user ID format"})
		return
	}

	restaurant, err := h.service.CreateRestaurant(c.Request.Context(), userIDStr, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, restaurant)
}

// UpdateRestaurant godoc
// @Summary Update restaurant
// @Description Update restaurant information (owner/admin only)
// @Tags restaurants
// @Accept json
// @Produce json
// @Security ApiKeyAuth
// @Param id path string true "Restaurant ID"
// @Param restaurant body models.UpdateRestaurantRequest true "Restaurant update data"
// @Success 200 {object} models.Restaurant
// @Router /restaurants/{id} [put]
func (h *RestaurantHandler) UpdateRestaurant(c *gin.Context) {
	var req models.UpdateRestaurantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	restaurantID := c.Param("id")

	restaurant, err := h.service.UpdateRestaurant(c.Request.Context(), restaurantID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, restaurant)
}

// DeleteRestaurant godoc
// @Summary Delete a restaurant
// @Description Delete a restaurant (admin only)
// @Tags restaurants
// @Accept json
// @Produce json
// @Security ApiKeyAuth
// @Param id path string true "Restaurant ID"
// @Success 200 {object} gin.H{"message": "Restaurant deleted successfully"}
// @Router /restaurants/{id} [delete]
func (h *RestaurantHandler) DeleteRestaurant(c *gin.Context) {
	restaurantID := c.Param("id")

	err := h.service.DeleteRestaurant(c.Request.Context(), restaurantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Restaurant deleted successfully"})
}

// AddMenuItem godoc
// @Summary Add menu item to restaurant
// @Description Add a new menu item to restaurant (admin/owner only)
// @Tags restaurants
// @Accept json
// @Produce json
// @Security ApiKeyAuth
// @Param id path string true "Restaurant ID"
// @Param item body models.CreateMenuItemRequest true "Menu item data"
// @Success 201 {object} models.MenuItem
// @Router /restaurants/{id}/menu [post]
func (h *RestaurantHandler) AddMenuItem(c *gin.Context) {
	restaurantID := c.Param("id")

	var req models.CreateMenuItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	menuItem, err := h.service.AddMenuItem(c.Request.Context(), restaurantID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, menuItem)
}

// UpdateMenuItem godoc
// @Summary Update menu item
// @Description Update a menu item (admin/owner only)
// @Tags restaurants
// @Accept json
// @Produce json
// @Security ApiKeyAuth
// @Param id path string true "Restaurant ID"
// @Param itemId path string true "Menu Item ID"
// @Param item body models.UpdateMenuItemRequest true "Menu item update data"
// @Success 200 {object} models.MenuItem
// @Router /restaurants/{id}/menu/{itemId} [put]
func (h *RestaurantHandler) UpdateMenuItem(c *gin.Context) {
	restaurantID := c.Param("id")
	itemID := c.Param("itemId")

	var req models.UpdateMenuItemRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	menuItem, err := h.service.UpdateMenuItem(c.Request.Context(), restaurantID, itemID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, menuItem)
}
