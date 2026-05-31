package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/haile-paa/pedal-delivery/internal/models"
	"github.com/haile-paa/pedal-delivery/internal/repositories"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type DriverHandler struct {
	driverRepo repositories.DriverRepository
	userRepo   repositories.UserRepository
}

func NewDriverHandler(driverRepo repositories.DriverRepository, userRepo repositories.UserRepository) *DriverHandler {
	return &DriverHandler{
		driverRepo: driverRepo,
		userRepo:   userRepo,
	}
}

// userDisplayName returns "FirstName LastName" trimmed, falling back to phone.
func userDisplayName(u *models.User) string {
	name := strings.TrimSpace(u.Profile.FirstName + " " + u.Profile.LastName)
	if name == "" {
		return u.Phone
	}
	return name
}

// hasLocation returns true when the GeoLocation struct holds real coordinates.
func hasLocation(loc models.GeoLocation) bool {
	return len(loc.Coordinates) == 2 &&
		(loc.Coordinates[0] != 0 || loc.Coordinates[1] != 0)
}

// GetAllDrivers returns all drivers with joined user info.
// GET /api/v1/admin/drivers
func (h *DriverHandler) GetAllDrivers(c *gin.Context) {
	ctx := c.Request.Context()

	drivers, err := h.driverRepo.FindAll(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch drivers"})
		return
	}

	result := make([]gin.H, 0, len(drivers))
	for _, d := range drivers {
		var userName, userPhone string
		if d.UserID != primitive.NilObjectID {
			user, err := h.userRepo.FindByID(ctx, d.UserID)
			if err == nil && user != nil {
				userName = userDisplayName(user)
				userPhone = user.Phone
			}
		}

		var locationPayload interface{}
		if hasLocation(d.Location) {
			locationPayload = d.Location
		}

		result = append(result, gin.H{
			"id":          d.ID.Hex(),
			"user_id":     d.UserID.Hex(),
			"status":      d.Status,
			"vehicle":     d.Vehicle,
			"rating":      d.Rating,
			"total_trips": d.TotalTrips,
			"is_online":   d.IsOnline,
			"location":    locationPayload,
			"user": gin.H{
				"name":  userName,
				"phone": userPhone,
			},
		})
	}

	c.JSON(http.StatusOK, result)
}

// GetDriverByID returns a single driver.
// GET /api/v1/admin/drivers/:id
func (h *DriverHandler) GetDriverByID(c *gin.Context) {
	ctx := c.Request.Context()

	objID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid driver ID"})
		return
	}

	d, err := h.driverRepo.FindByID(ctx, objID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Driver not found"})
		return
	}

	var userName, userPhone string
	if d.UserID != primitive.NilObjectID {
		user, err := h.userRepo.FindByID(ctx, d.UserID)
		if err == nil && user != nil {
			userName = userDisplayName(user)
			userPhone = user.Phone
		}
	}

	var locationPayload interface{}
	if hasLocation(d.Location) {
		locationPayload = d.Location
	}

	c.JSON(http.StatusOK, gin.H{
		"id":          d.ID.Hex(),
		"user_id":     d.UserID.Hex(),
		"status":      d.Status,
		"vehicle":     d.Vehicle,
		"rating":      d.Rating,
		"total_trips": d.TotalTrips,
		"is_online":   d.IsOnline,
		"location":    locationPayload,
		"user": gin.H{
			"name":  userName,
			"phone": userPhone,
		},
	})
}

// CreateDriver creates a new driver record linked to an existing or new user.
// POST /api/v1/admin/drivers
func (h *DriverHandler) CreateDriver(c *gin.Context) {
	ctx := c.Request.Context()

	var req struct {
		Phone        string `json:"phone"        binding:"required"`
		Name         string `json:"name"         binding:"required"`
		VehicleType  string `json:"vehicleType"  binding:"required"`
		VehicleModel string `json:"vehicleModel"`
		VehicleColor string `json:"vehicleColor"`
		LicensePlate string `json:"licensePlate"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Split name into first / last for the UserProfile struct.
	parts := strings.SplitN(strings.TrimSpace(req.Name), " ", 2)
	firstName := parts[0]
	lastName := ""
	if len(parts) == 2 {
		lastName = parts[1]
	}

	// Find or create user by phone.
	user, err := h.userRepo.FindByPhone(ctx, req.Phone)
	if err != nil {
		// User not found – create one.
		newUser := &models.User{
			Phone: req.Phone,
			Role: models.UserRole{
				Type:        "driver",
				Permissions: []string{},
			},
			Profile: models.UserProfile{
				FirstName: firstName,
				LastName:  lastName,
			},
		}
		if createErr := h.userRepo.Create(ctx, newUser); createErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user: " + createErr.Error()})
			return
		}
		// Re-fetch so we have the generated _id.
		user, err = h.userRepo.FindByPhone(ctx, req.Phone)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve created user"})
			return
		}
	}

	// Guard: driver profile must not already exist.
	existing, _ := h.driverRepo.FindByUserID(ctx, user.ID)
	if existing != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "A driver profile already exists for this phone number"})
		return
	}

	// Create driver profile.
	driver := &models.Driver{
		UserID: user.ID,
		Status: models.DriverApproved,
		Vehicle: models.Vehicle{
			Type:  req.VehicleType,
			Model: req.VehicleModel,
			Color: req.VehicleColor,
			Plate: req.LicensePlate,
		},
		Rating:     5.0,
		TotalTrips: 0,
		IsOnline:   false,
		IsActive:   true,
	}

	created, err := h.driverRepo.Create(ctx, driver)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create driver: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":          created.ID.Hex(),
		"user_id":     user.ID.Hex(),
		"status":      created.Status,
		"vehicle":     created.Vehicle,
		"rating":      created.Rating,
		"total_trips": created.TotalTrips,
		"is_online":   created.IsOnline,
		"user": gin.H{
			"name":  userDisplayName(user),
			"phone": user.Phone,
		},
	})
}

// UpdateDriverStatus updates the approval status of a driver.
// PUT /api/v1/admin/drivers/:id/status
func (h *DriverHandler) UpdateDriverStatus(c *gin.Context) {
	ctx := c.Request.Context()

	objID, err := primitive.ObjectIDFromHex(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid driver ID"})
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	validStatuses := map[string]bool{
		string(models.DriverPending):   true,
		string(models.DriverApproved):  true,
		string(models.DriverRejected):  true,
		string(models.DriverSuspended): true,
	}
	if !validStatuses[req.Status] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid status. Must be: pending, approved, rejected, suspended"})
		return
	}

	if err := h.driverRepo.UpdateStatus(ctx, objID, req.Status); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Driver status updated"})
}
