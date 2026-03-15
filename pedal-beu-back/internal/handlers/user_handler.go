package handlers

import (
	"net/http"

	"github.com/haile-paa/pedal-delivery/internal/models"
	"github.com/haile-paa/pedal-delivery/internal/repositories"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type UserHandler struct {
	userRepo repositories.UserRepository
}

func NewUserHandler(userRepo repositories.UserRepository) *UserHandler {
	return &UserHandler{userRepo: userRepo}
}

// AddAddress adds a new address to the user's profile
// POST /api/v1/users/addresses
func (h *UserHandler) AddAddress(c *gin.Context) {
	userID := c.MustGet("userID").(primitive.ObjectID)

	var req models.CreateAddressRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	address := &models.Address{
		Label:   req.Label,
		Address: req.Address,
		Location: models.GeoLocation{
			Type:        "Point",
			Coordinates: []float64{req.Longitude, req.Latitude},
		},
		IsDefault: req.IsDefault,
	}

	err := h.userRepo.AddAddress(c.Request.Context(), userID, address)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add address: " + err.Error()})
		return
	}

	// address.ID and address.CreatedAt are set inside AddAddress
	c.JSON(http.StatusCreated, address)
}

// GetAddresses returns user's saved addresses
// GET /api/v1/users/addresses
func (h *UserHandler) GetAddresses(c *gin.Context) {
	userID := c.MustGet("userID").(primitive.ObjectID)

	addresses, err := h.userRepo.GetAddresses(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get addresses: " + err.Error()})
		return
	}

	if addresses == nil {
		addresses = []models.Address{}
	}

	c.JSON(http.StatusOK, gin.H{"addresses": addresses})
}

// DeleteAddress removes an address from user's profile
// DELETE /api/v1/users/addresses/:addressId
func (h *UserHandler) DeleteAddress(c *gin.Context) {
	userID := c.MustGet("userID").(primitive.ObjectID)

	addressID, err := primitive.ObjectIDFromHex(c.Param("addressId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid address ID"})
		return
	}

	err = h.userRepo.DeleteAddress(c.Request.Context(), userID, addressID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Address deleted successfully"})
}
