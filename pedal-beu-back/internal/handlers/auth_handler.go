package handlers

import (
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/haile-paa/pedal-delivery/internal/models"
	"github.com/haile-paa/pedal-delivery/internal/repositories"
	"github.com/haile-paa/pedal-delivery/internal/services"
	"github.com/haile-paa/pedal-delivery/pkg/auth"
	"github.com/haile-paa/pedal-delivery/pkg/sms"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ===============================
// ✅ IN-MEMORY OTP STORE (for development)
// ===============================

type OTPData struct {
	Code      string
	ExpiresAt time.Time
}

var otpStore = make(map[string]OTPData)
var otpMutex = sync.Mutex{}
var userRepo repositories.UserRepository
var adminRepo repositories.AdminRepository

// ===============================
// ✅ AUTH HANDLER STRUCT
// ===============================

type AuthHandler struct {
	authService services.AuthService
	smsClient   *sms.Client
}

func SetAdminRepository(repo repositories.AdminRepository) {
	adminRepo = repo
}

func NewAuthHandler(authService services.AuthService, smsClient *sms.Client) *AuthHandler {
	return &AuthHandler{
		authService: authService,
		smsClient:   smsClient,
	}
}

// ===============================
// ✅ HELPER FUNCTIONS
// ===============================

// SetUserRepository sets the user repository for OTP handlers
func SetUserRepository(repo repositories.UserRepository) {
	userRepo = repo
}

// generateOTP generates a 6-digit OTP
func generateOTP() string {
	rand.Seed(time.Now().UnixNano())
	return fmt.Sprintf("%06d", rand.Intn(1000000))
}

// normalizePhone normalizes phone number to +251 format
func normalizePhone(phone string) string {
	// Remove any spaces or special characters
	phone = strings.TrimSpace(phone)
	phone = strings.ReplaceAll(phone, " ", "")

	// If phone starts with 0, replace with +251 (Ethiopia)
	if strings.HasPrefix(phone, "0") && len(phone) == 10 {
		return "+251" + phone[1:]
	}

	// If phone starts with 9 and is 9 digits, add +251
	if strings.HasPrefix(phone, "9") && len(phone) == 9 {
		return "+251" + phone
	}

	// If phone doesn't start with +, add it
	if !strings.HasPrefix(phone, "+") {
		phone = "+" + phone
	}

	return phone
}

// ===============================
// ✅ OTP HANDLERS (methods)
// ===============================

// @Summary Send OTP
// @Description Send OTP to phone number for verification
// @Tags authentication
// @Accept json
// @Produce json
// @Param request body models.SendOTPRequest true "Phone and role"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Router /api/v1/auth/send-otp [post]
func (h *AuthHandler) SendOTP(c *gin.Context) {
	var req models.SendOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Normalize phone number
	normalizedPhone := normalizePhone(req.Phone)
	log.Printf("🔍 SendOTP: Original phone: %s, Normalized: %s", req.Phone, normalizedPhone)

	otp := generateOTP()

	// Check if user exists (important for drivers)
	if req.Role == "driver" {
		user, err := userRepo.FindByPhone(c.Request.Context(), normalizedPhone)
		if err != nil || user == nil {
			// Also try with original phone
			user, err = userRepo.FindByPhone(c.Request.Context(), req.Phone)
			if err != nil || user == nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"error": "Driver not registered. Please register first with manager credentials",
				})
				return
			}
		}
	}

	// Store OTP in memory - store with both formats
	otpMutex.Lock()
	otpStore[req.Phone] = OTPData{
		Code:      otp,
		ExpiresAt: time.Now().Add(5 * time.Minute),
	}
	otpStore[normalizedPhone] = OTPData{
		Code:      otp,
		ExpiresAt: time.Now().Add(5 * time.Minute),
	}
	otpMutex.Unlock()

	// Send SMS via provider
	message := fmt.Sprintf("Your verification code is: %s", otp)
	if h.smsClient != nil {
		resp, err := h.smsClient.SendSMS(normalizedPhone, message)
		if err != nil {
			log.Printf("❌ Failed to send SMS: %v", err)
		} else {
			log.Printf("✅ SMS sent successfully, message_id: %s", resp.Response.MessageID)
		}
	} else {
		log.Println("⚠️ SMS client not configured, OTP not sent via SMS")
	}

	// TEMP: LOG OTP (remove in production)
	log.Println("✅ OTP for", req.Phone, "=", otp, "for role:", req.Role)

	c.JSON(http.StatusOK, gin.H{
		"message": "OTP sent successfully",
		"role":    req.Role,
		"otp":     otp, // Remove in production
	})
}

// @Summary Register driver with manager credentials
// @Description Register a new driver with username and password provided by manager
// @Tags authentication
// @Accept json
// @Produce json
// @Param request body models.RegisterDriverRequest true "Driver registration data"
// @Success 201 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Router /api/v1/auth/register-driver [post]
func (h *AuthHandler) RegisterDriver(c *gin.Context) {
	var req models.RegisterDriverRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Normalize phone number
	normalizedPhone := normalizePhone(req.Phone)

	// Check if phone already registered
	existingUser, _ := userRepo.FindByPhone(c.Request.Context(), normalizedPhone)
	if existingUser != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Phone number already registered",
		})
		return
	}

	// Hash password
	hashedPassword, err := auth.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process password"})
		return
	}

	// Create driver user
	user := &models.User{
		Phone:      normalizedPhone,
		Username:   req.Username,
		Password:   hashedPassword,
		IsVerified: false, // Will be verified via OTP
		Role: models.UserRole{
			Type:        "driver",
			Permissions: []string{"order:accept", "order:update", "location:update", "profile:update"},
		},
		Profile: models.UserProfile{
			FirstName: req.Username, // Use username as first name initially
		},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Save user
	if err := userRepo.Create(c.Request.Context(), user); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Generate OTP for verification
	otp := generateOTP()
	otpMutex.Lock()
	otpStore[normalizedPhone] = OTPData{
		Code:      otp,
		ExpiresAt: time.Now().Add(5 * time.Minute),
	}
	otpMutex.Unlock()

	// Send SMS
	message := fmt.Sprintf("Your verification code is: %s", otp)
	if h.smsClient != nil {
		resp, err := h.smsClient.SendSMS(normalizedPhone, message)
		if err != nil {
			log.Printf("❌ Failed to send SMS: %v", err)
		} else {
			log.Printf("✅ SMS sent successfully, message_id: %s", resp.Response.MessageID)
		}
	} else {
		log.Println("⚠️ SMS client not configured, OTP not sent via SMS")
	}

	log.Println("✅ Driver registered. OTP for", normalizedPhone, "=", otp)

	c.JSON(http.StatusCreated, gin.H{
		"message": "Driver registered successfully. OTP sent for verification",
		"user": gin.H{
			"id":       user.ID,
			"phone":    user.Phone,
			"username": user.Username,
			"role":     user.Role.Type,
		},
		"otp": otp, // Remove in production
	})
}

// @Summary Verify OTP and check if user exists
// @Description Verify OTP and return whether user exists or needs registration, includes tokens if user exists
// @Tags authentication
// @Accept json
// @Produce json
// @Param request body models.VerifyOTPRequest true "OTP verification data"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Router /api/v1/auth/verify-otp [post]
func VerifyOTPOnly(c *gin.Context) {
	var req struct {
		Phone string `json:"phone" binding:"required"`
		Code  string `json:"code" binding:"required"`
		Role  string `json:"role" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Normalize phone number
	normalizedPhone := normalizePhone(req.Phone)
	log.Printf("🔍 VerifyOTPOnly: Original phone: %s, Normalized: %s, Role: %s", req.Phone, normalizedPhone, req.Role)

	// Check OTP from memory store - try both formats
	var data OTPData
	var exists bool

	otpMutex.Lock()
	data, exists = otpStore[req.Phone]
	if !exists {
		data, exists = otpStore[normalizedPhone]
	}
	otpMutex.Unlock()

	log.Printf("🔍 OTP exists: %v", exists)

	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "OTP not found or expired"})
		return
	}

	if time.Now().After(data.ExpiresAt) {
		otpMutex.Lock()
		delete(otpStore, req.Phone)
		delete(otpStore, normalizedPhone)
		otpMutex.Unlock()

		c.JSON(http.StatusUnauthorized, gin.H{"error": "OTP expired"})
		return
	}

	if data.Code != req.Code {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid OTP"})
		return
	}

	// ✅ Delete OTP after verification
	otpMutex.Lock()
	delete(otpStore, req.Phone)
	delete(otpStore, normalizedPhone)
	otpMutex.Unlock()

	ctx := c.Request.Context()

	// Handle different roles
	switch req.Role {
	case "admin":
		// Check if admin exists
		admin, err := adminRepo.FindByPhone(ctx, normalizedPhone)
		if err != nil {
			// Try original phone
			admin, err = adminRepo.FindByPhone(ctx, req.Phone)
			if err != nil {
				log.Printf("🔍 Admin not found for phone: %s", req.Phone)
				c.JSON(http.StatusOK, gin.H{
					"message": "OTP verified successfully",
					"exists":  false,
					"role":    req.Role,
				})
				return
			}
		}

		log.Printf("🔍 Admin found: ID=%s, Phone=%s, Verified=%v", admin.ID.Hex(), admin.Phone, admin.IsVerified)

		// Mark as verified if not already
		if !admin.IsVerified {
			if err := adminRepo.VerifyPhone(ctx, admin.Phone); err != nil {
				log.Printf("🔍 Error verifying admin phone: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify admin"})
				return
			}
			admin.IsVerified = true
		}

		// Generate tokens
		user := &models.User{
			ID:    admin.ID,
			Phone: admin.Phone,
			Email: admin.Email,
			Role: models.UserRole{
				Type:        "admin",
				Permissions: []string{"*"},
			},
			Profile: models.UserProfile{
				FirstName: admin.FirstName,
				LastName:  admin.LastName,
			},
		}

		tokenPair, err := auth.GenerateToken(user)
		if err != nil {
			log.Printf("🔍 Error generating tokens: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate tokens"})
			return
		}

		// Update last login
		_ = adminRepo.UpdateLastLogin(ctx, admin.ID)

		log.Printf("🔍 Returning exists=true with tokens for admin: %s", admin.ID.Hex())
		c.JSON(http.StatusOK, gin.H{
			"message": "OTP verified successfully",
			"exists":  true,
			"user": gin.H{
				"id":        admin.ID,
				"phone":     admin.Phone,
				"email":     admin.Email,
				"firstName": admin.FirstName,
				"role":      "admin",
			},
			"tokens": gin.H{
				"accessToken":  tokenPair.AccessToken,
				"refreshToken": tokenPair.RefreshToken,
			},
			"role": req.Role,
		})

	default:
		// Original logic for other roles (customer, driver)
		var user *models.User
		var err error

		// Try normalized phone first
		user, err = userRepo.FindByPhone(ctx, normalizedPhone)
		if err != nil {
			log.Printf("🔍 User not found with normalized phone: %s, trying original...", normalizedPhone)
			// Try original phone
			user, err = userRepo.FindByPhone(ctx, req.Phone)
		}

		if err != nil {
			log.Printf("🔍 User not found: %v", err)

			if req.Role == "driver" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Driver not found. Please register first"})
				return
			}

			log.Printf("🔍 Returning exists=false for phone: %s", req.Phone)
			c.JSON(http.StatusOK, gin.H{
				"message": "OTP verified successfully",
				"exists":  false,
				"role":    req.Role,
			})
			return
		}

		log.Printf("🔍 User found: ID=%s, Phone=%s, Verified=%v", user.ID.Hex(), user.Phone, user.IsVerified)

		// User exists - mark as verified
		if !user.IsVerified {
			log.Printf("🔍 Marking user as verified")
			if err := userRepo.VerifyPhone(ctx, user.Phone); err != nil {
				log.Printf("🔍 Error verifying phone: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify user"})
				return
			}
			user.IsVerified = true
		}

		// Generate tokens
		tokenPair, err := auth.GenerateToken(user)
		if err != nil {
			log.Printf("🔍 Error generating tokens: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate tokens"})
			return
		}

		// Update last login
		_ = userRepo.UpdateLastLogin(ctx, user.ID)

		log.Printf("🔍 Returning exists=true with tokens for user: %s", user.ID.Hex())
		c.JSON(http.StatusOK, gin.H{
			"message": "OTP verified successfully",
			"exists":  true,
			"user": gin.H{
				"id":        user.ID,
				"phone":     user.Phone,
				"username":  user.Username,
				"email":     user.Email,
				"firstName": user.Profile.FirstName,
				"role":      user.Role.Type,
			},
			"tokens": gin.H{
				"accessToken":  tokenPair.AccessToken,
				"refreshToken": tokenPair.RefreshToken,
			},
			"role": req.Role,
		})
	}
}

// ===============================
// ✅ AUTH HANDLER METHODS (unchanged)
// ===============================

// @Summary Register a new user (Simplified)
// @Description Register with phone, first name, and optional email
// @Tags authentication
// @Accept json
// @Produce json
// @Param request body models.RegisterRequest true "Registration data"
// @Success 201 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 500 {object} map[string]interface{}
// @Router /api/v1/auth/register [post]
func (h *AuthHandler) Register(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// TEMP: Allow admin registration for testing
	// Remove this in production
	allowedRoles := []string{"customer", "driver", "admin"}
	validRole := false
	for _, role := range allowedRoles {
		if role == req.Role {
			validRole = true
			break
		}
	}

	if !validRole {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role. Allowed roles: customer, driver, admin"})
		return
	}
	// END TEMP

	// Normalize phone number
	normalizedPhone := normalizePhone(req.Phone)
	log.Printf("🔍 Register: Original phone: %s, Normalized: %s", req.Phone, normalizedPhone)

	// Check if user already exists with normalized phone
	existingUser, _ := userRepo.FindByPhone(c.Request.Context(), normalizedPhone)
	if existingUser != nil {
		log.Printf("🔍 User already exists with normalized phone: %s", normalizedPhone)
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Phone number already registered",
		})
		return
	}

	// Also check with original phone
	if normalizedPhone != req.Phone {
		existingUser, _ = userRepo.FindByPhone(c.Request.Context(), req.Phone)
		if existingUser != nil {
			log.Printf("🔍 User already exists with original phone: %s", req.Phone)
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Phone number already registered",
			})
			return
		}
	}

	// Update the phone in request to normalized version
	req.Phone = normalizedPhone

	user, tokens, err := h.authService.Register(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	response := gin.H{
		"message": "Registration successful",
		"user": gin.H{
			"id":        user.ID,
			"phone":     user.Phone,
			"email":     user.Email,
			"role":      user.Role.Type,
			"firstName": user.Profile.FirstName,
		},
		"tokens": tokens,
	}

	c.JSON(http.StatusCreated, response)
}

// @Summary Login with OTP
// @Description Login using phone number (after OTP verification)
// @Tags authentication
// @Accept json
// @Produce json
// @Param request body models.LoginWithOTPRequest true "Phone number"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Router /api/v1/auth/login-otp [post]
func (h *AuthHandler) LoginWithOTP(c *gin.Context) {
	var req models.LoginWithOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Normalize phone number
	normalizedPhone := normalizePhone(req.Phone)

	user, tokens, err := h.authService.LoginWithOTP(c.Request.Context(), normalizedPhone)
	if err != nil {
		// Try with original phone if normalized fails
		user, tokens, err = h.authService.LoginWithOTP(c.Request.Context(), req.Phone)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	response := gin.H{
		"message": "Login successful",
		"user": gin.H{
			"id":        user.ID,
			"phone":     user.Phone,
			"email":     user.Email,
			"role":      user.Role.Type,
			"firstName": user.Profile.FirstName,
		},
		"tokens": tokens,
	}

	c.JSON(http.StatusOK, response)
}

// @Summary Verify OTP
// @Description Verify phone number with OTP
// @Tags authentication
// @Accept json
// @Produce json
// @Param request body models.VerifyOTPRequest true "OTP verification data"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Router /api/v1/auth/verify-otp [post]
func (h *AuthHandler) VerifyOTP(c *gin.Context) {
	var req models.VerifyOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.authService.VerifyOTP(c.Request.Context(), req.Phone, req.Code)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Phone number verified successfully"})
}

// @Summary Refresh access token
// @Description Get new access token using refresh token
// @Tags authentication
// @Accept json
// @Produce json
// @Param request body models.RefreshTokenRequest true "Refresh token"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Router /api/v1/auth/refresh [post]
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req models.RefreshTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tokens, err := h.authService.RefreshToken(c.Request.Context(), req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"tokens": tokens})
}

// @Summary Get user profile
// @Description Get current user's profile
// @Tags authentication
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} models.User
// @Failure 401 {object} map[string]interface{}
// @Failure 404 {object} map[string]interface{}
// @Router /api/v1/auth/profile [get]
func (h *AuthHandler) GetProfile(c *gin.Context) {
	userID := c.MustGet("userID").(primitive.ObjectID)

	user, err := h.authService.GetProfile(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, user)
}

// @Summary Update user profile
// @Description Update current user's profile
// @Tags authentication
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body models.UpdateProfileRequest true "Profile update data"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Router /api/v1/auth/profile [put]
func (h *AuthHandler) UpdateProfile(c *gin.Context) {
	userID := c.MustGet("userID").(primitive.ObjectID)

	var req models.UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.authService.UpdateProfile(c.Request.Context(), userID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Profile updated successfully"})
}

// @Summary Forgot password
// @Description Request password reset OTP
// @Tags authentication
// @Accept json
// @Produce json
// @Param request body models.ForgotPasswordRequest true "Phone number"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Router /api/v1/auth/forgot-password [post]
func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req models.ForgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	otp, err := h.authService.ForgotPassword(c.Request.Context(), req.Phone)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// In production, don't return OTP in response
	c.JSON(http.StatusOK, gin.H{
		"message": "OTP sent to phone",
		"otp":     otp, // Remove this in production
	})
}

// @Summary Reset password
// @Description Reset password with OTP
// @Tags authentication
// @Accept json
// @Produce json
// @Param request body models.ResetPasswordRequest true "Reset password data"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Router /api/v1/auth/reset-password [post]
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req models.ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.authService.ResetPassword(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password reset successfully"})
}

// @Summary Logout user
// @Description Logout current user
// @Tags authentication
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} map[string]interface{}
// @Router /api/v1/auth/logout [post]
func (h *AuthHandler) Logout(c *gin.Context) {
	userID := c.MustGet("userID").(primitive.ObjectID)

	err := h.authService.Logout(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}

// @Summary Check if phone exists
// @Description Check if a phone number is already registered
// @Tags authentication
// @Accept json
// @Produce json
// @Param phone query string true "Phone number"
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/auth/check-phone [get]
func CheckPhoneExists(c *gin.Context) {
	phone := c.Query("phone")
	if phone == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Phone parameter is required"})
		return
	}

	// Normalize phone
	normalizedPhone := normalizePhone(phone)

	ctx := c.Request.Context()

	// Try normalized phone first
	user, err := userRepo.FindByPhone(ctx, normalizedPhone)
	if err != nil {
		// Try original phone
		user, err = userRepo.FindByPhone(ctx, phone)
	}

	if err != nil {
		c.JSON(http.StatusOK, gin.H{"exists": false})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"exists": true,
		"phone":  user.Phone,
		"user": gin.H{
			"id":         user.ID,
			"role":       user.Role.Type,
			"firstName":  user.Profile.FirstName,
			"isVerified": user.IsVerified,
		},
	})
}
