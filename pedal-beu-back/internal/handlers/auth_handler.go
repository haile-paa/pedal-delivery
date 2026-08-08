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
	"github.com/haile-paa/pedal-delivery/pkg/email"
	// "github.com/haile-paa/pedal-delivery/pkg/sms" // PHONE VERIFICATION (commented out — switched to email verification)
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
	// smsClient   *sms.Client // PHONE VERIFICATION (commented out — switched to email verification)
	emailClient *email.Client
}

func SetAdminRepository(repo repositories.AdminRepository) {
	adminRepo = repo
}

func NewAuthHandler(authService services.AuthService, emailClient *email.Client) *AuthHandler {
	return &AuthHandler{
		authService: authService,
		emailClient: emailClient,
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

// @Summary Login with phone and password
// @Description Login using phone number and password. Works for customers, drivers, and admins.
// @Tags authentication
// @Accept json
// @Produce json
// @Param request body models.LoginRequest true "Phone and password"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Router /api/v1/auth/login [post]
func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, tokens, err := h.authService.Login(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Login successful",
		"user": gin.H{
			"id":        user.ID,
			"phone":     user.Phone,
			"email":     user.Email,
			"username":  user.Username,
			"firstName": user.Profile.FirstName,
			"role":      user.Role.Type,
		},
		"tokens": gin.H{
			"accessToken":  tokens.AccessToken,
			"refreshToken": tokens.RefreshToken,
		},
	})
}

// @Summary Send OTP
// @Description Send OTP to email address for verification
// @Tags authentication
// @Accept json
// @Produce json
// @Param request body models.SendOTPRequest true "Email and role"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Router /api/v1/auth/send-otp [post]
func (h *AuthHandler) SendOTP(c *gin.Context) {
	var req models.SendOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// PHONE VERIFICATION (commented out — switched to email verification)
	// normalizedPhone := normalizePhone(req.Phone)
	// log.Printf("🔍 SendOTP: Original phone: %s, Normalized: %s", req.Phone, normalizedPhone)

	normalizedEmail := strings.ToLower(strings.TrimSpace(req.Email))
	log.Printf("🔍 SendOTP: Email: %s", normalizedEmail)

	otp := generateOTP()

	// Check if user exists (important for drivers)
	if req.Role == "driver" {
		user, err := userRepo.FindByEmail(c.Request.Context(), normalizedEmail)
		if err != nil || user == nil {
			// PHONE VERIFICATION (commented out — used to also try phone lookup)
			// user, err = userRepo.FindByPhone(c.Request.Context(), req.Phone)
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Driver not registered. Please register first with manager credentials",
			})
			return
		}
	}

	// Store OTP in memory, keyed by email
	otpMutex.Lock()
	otpStore[normalizedEmail] = OTPData{
		Code:      otp,
		ExpiresAt: time.Now().Add(5 * time.Minute),
	}
	otpMutex.Unlock()

	// PHONE VERIFICATION (commented out — used to send OTP via SMS/Twilio)
	// message := fmt.Sprintf("Welcome to Pedal Delivery! Your OTP is: %s. Valid for 5 minutes.", otp)
	// if h.smsClient != nil {
	// 	resp, err := h.smsClient.SendSMS(normalizedPhone, message)
	// 	if err != nil {
	// 		log.Printf("❌ Failed to send SMS: %v", err)
	// 	} else {
	// 		log.Printf("✅ SMS sent successfully, message_id: %s", resp.Response.MessageID)
	// 	}
	// } else {
	// 	log.Println("⚠️ SMS client not configured, OTP not sent via SMS")
	// }

	// Send OTP via email
	if h.emailClient != nil {
		resp, err := h.emailClient.SendOTPEmail(normalizedEmail, otp)
		if err != nil {
			log.Printf("❌ Failed to send verification email: %v", err)
		} else {
			log.Printf("✅ Verification email sent successfully to: %s", resp.To)
		}
	} else {
		log.Println("⚠️ Email client not configured, OTP not sent via email")
	}

	// TEMP: LOG OTP (remove in production)
	log.Println("✅ OTP for", normalizedEmail, "=", otp, "for role:", req.Role)

	c.JSON(http.StatusOK, gin.H{
		"message": "OTP sent successfully",
		"role":    req.Role,
		// "otp": otp, // no longer returned to the client — Brevo actually
		// delivers the email now, so leaking the code in the API response
		// would defeat the point of verification. Still logged server-side above.
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

	// Normalize phone number (still stored on the user record as a contact number)
	normalizedPhone := normalizePhone(req.Phone)
	normalizedEmail := strings.ToLower(strings.TrimSpace(req.Email))

	// Check if phone already registered
	existingUser, _ := userRepo.FindByPhone(c.Request.Context(), normalizedPhone)
	if existingUser != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Phone number already registered",
		})
		return
	}

	// Check if email already registered
	existingByEmail, _ := userRepo.FindByEmail(c.Request.Context(), normalizedEmail)
	if existingByEmail != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Email already registered",
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
		Email:      normalizedEmail,
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

	// Generate OTP for verification, keyed by email
	otp := generateOTP()
	otpMutex.Lock()
	otpStore[normalizedEmail] = OTPData{
		Code:      otp,
		ExpiresAt: time.Now().Add(5 * time.Minute),
	}
	otpMutex.Unlock()

	// PHONE VERIFICATION (commented out — used to send OTP via SMS/Twilio)
	// message := fmt.Sprintf("Welcome to Pedal Delivery! Your OTP is: %s. Valid for 5 minutes.", otp)
	// if h.smsClient != nil {
	// 	resp, err := h.smsClient.SendSMS(normalizedPhone, message)
	// 	if err != nil {
	// 		log.Printf("❌ Failed to send SMS: %v", err)
	// 	} else {
	// 		log.Printf("✅ SMS sent successfully, message_id: %s", resp.Response.MessageID)
	// 	}
	// } else {
	// 	log.Println("⚠️ SMS client not configured, OTP not sent via SMS")
	// }

	// Send OTP via email
	if h.emailClient != nil {
		resp, err := h.emailClient.SendOTPEmail(normalizedEmail, otp)
		if err != nil {
			log.Printf("❌ Failed to send verification email: %v", err)
		} else {
			log.Printf("✅ Verification email sent successfully to: %s", resp.To)
		}
	} else {
		log.Println("⚠️ Email client not configured, OTP not sent via email")
	}

	log.Println("✅ Driver registered. OTP for", normalizedEmail, "=", otp)

	c.JSON(http.StatusCreated, gin.H{
		"message": "Driver registered successfully. OTP sent for verification",
		"user": gin.H{
			"id":       user.ID,
			"phone":    user.Phone,
			"email":    user.Email,
			"username": user.Username,
			"role":     user.Role.Type,
		},
		// "otp": otp, // no longer returned to the client — see SendOTP for why
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
		// Phone string `json:"phone" binding:"required"` // PHONE VERIFICATION (commented out — switched to email verification)
		Phone string `json:"phone,omitempty"`
		Email string `json:"email" binding:"required,email"`
		Code  string `json:"code" binding:"required"`
		Role  string `json:"role" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// PHONE VERIFICATION (commented out — switched to email verification)
	// normalizedPhone := normalizePhone(req.Phone)
	// log.Printf("🔍 VerifyOTPOnly: Original phone: %s, Normalized: %s, Role: %s", req.Phone, normalizedPhone, req.Role)

	normalizedEmail := strings.ToLower(strings.TrimSpace(req.Email))
	log.Printf("🔍 VerifyOTPOnly: Email: %s, Role: %s", normalizedEmail, req.Role)

	// Check OTP from memory store, keyed by email
	var data OTPData
	var exists bool

	otpMutex.Lock()
	data, exists = otpStore[normalizedEmail]
	otpMutex.Unlock()

	log.Printf("🔍 OTP exists: %v", exists)

	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "OTP not found or expired"})
		return
	}

	if time.Now().After(data.ExpiresAt) {
		otpMutex.Lock()
		delete(otpStore, normalizedEmail)
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
	delete(otpStore, normalizedEmail)
	otpMutex.Unlock()

	ctx := c.Request.Context()

	// Handle different roles
	switch req.Role {
	case "admin":
		// Check if admin exists
		admin, err := adminRepo.FindByEmail(ctx, normalizedEmail)
		if err != nil {
			log.Printf("🔍 Admin not found for email: %s", normalizedEmail)
			c.JSON(http.StatusOK, gin.H{
				"message": "OTP verified successfully",
				"exists":  false,
				"role":    req.Role,
			})
			return
		}

		log.Printf("🔍 Admin found: ID=%s, Email=%s, Verified=%v", admin.ID.Hex(), admin.Email, admin.IsVerified)

		// Mark as verified if not already
		if !admin.IsVerified {
			if err := adminRepo.VerifyEmail(ctx, admin.Email); err != nil {
				log.Printf("🔍 Error verifying admin email: %v", err)
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

		user, err = userRepo.FindByEmail(ctx, normalizedEmail)

		if err != nil {
			log.Printf("🔍 User not found: %v", err)

			if req.Role == "driver" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "Driver not found. Please register first"})
				return
			}

			log.Printf("🔍 Returning exists=false for email: %s", normalizedEmail)
			c.JSON(http.StatusOK, gin.H{
				"message": "OTP verified successfully",
				"exists":  false,
				"role":    req.Role,
			})
			return
		}

		log.Printf("🔍 User found: ID=%s, Email=%s, Verified=%v", user.ID.Hex(), user.Email, user.IsVerified)

		// User exists - mark as verified
		if !user.IsVerified {
			log.Printf("🔍 Marking user as verified")
			if err := userRepo.VerifyEmail(ctx, user.Email); err != nil {
				log.Printf("🔍 Error verifying email: %v", err)
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

	// Check if email already registered (email is now the verified/verification channel)
	if req.Email != "" {
		normalizedEmail := strings.ToLower(strings.TrimSpace(req.Email))
		if existingByEmail, _ := userRepo.FindByEmail(c.Request.Context(), normalizedEmail); existingByEmail != nil {
			log.Printf("🔍 User already exists with email: %s", normalizedEmail)
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Email already registered",
			})
			return
		}
		req.Email = normalizedEmail
	}

	// Update the phone in request to normalized version
	req.Phone = normalizedPhone

	user, tokens, err := h.authService.Register(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Admins are verified immediately (see auth_service.go), so they can log
	// straight in with the tokens Register already issued.
	if user.Role.Type == "admin" {
		c.JSON(http.StatusCreated, gin.H{
			"message": "Registration successful",
			"user": gin.H{
				"id":        user.ID,
				"phone":     user.Phone,
				"email":     user.Email,
				"role":      user.Role.Type,
				"firstName": user.Profile.FirstName,
			},
			"tokens": tokens,
		})
		return
	}

	// Customers/drivers are created unverified — send the verification OTP
	// now and let the app finish sign-in via /verify-otp (see
	// EmailVerificationScreen.tsx), instead of handing out tokens here.
	otp := generateOTP()
	otpMutex.Lock()
	otpStore[req.Email] = OTPData{
		Code:      otp,
		ExpiresAt: time.Now().Add(5 * time.Minute),
	}
	otpMutex.Unlock()

	if h.emailClient != nil {
		resp, sendErr := h.emailClient.SendOTPEmail(req.Email, otp)
		if sendErr != nil {
			log.Printf("❌ Failed to send verification email: %v", sendErr)
		} else {
			log.Printf("✅ Verification email sent successfully to: %s", resp.To)
		}
	} else {
		log.Println("⚠️ Email client not configured, OTP not sent via email")
	}

	log.Println("✅ User registered (pending verification). OTP for", req.Email, "=", otp)

	c.JSON(http.StatusCreated, gin.H{
		"message": "Registration successful. We sent a verification code to your email.",
		"user": gin.H{
			"id":        user.ID,
			"phone":     user.Phone,
			"email":     user.Email,
			"role":      user.Role.Type,
			"firstName": user.Profile.FirstName,
		},
		// no "tokens" here on purpose — the app must call /verify-otp first
	})
}

// @Summary Login with OTP
// @Description Login using email address (after OTP verification)
// @Tags authentication
// @Accept json
// @Produce json
// @Param request body models.LoginWithOTPRequest true "Email address"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Router /api/v1/auth/login-otp [post]
func (h *AuthHandler) LoginWithOTP(c *gin.Context) {
	var req models.LoginWithOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// PHONE VERIFICATION (commented out — switched to email verification)
	// normalizedPhone := normalizePhone(req.Phone)
	// user, tokens, err := h.authService.LoginWithOTP(c.Request.Context(), normalizedPhone)
	// if err != nil {
	// 	// Try with original phone if normalized fails
	// 	user, tokens, err = h.authService.LoginWithOTP(c.Request.Context(), req.Phone)
	// 	if err != nil {
	// 		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	// 		return
	// 	}
	// }

	normalizedEmail := strings.ToLower(strings.TrimSpace(req.Email))
	user, tokens, err := h.authService.LoginWithOTPByEmail(c.Request.Context(), normalizedEmail)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
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
// @Description Verify email address with OTP
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

	// PHONE VERIFICATION (commented out — switched to email verification)
	// err := h.authService.VerifyOTP(c.Request.Context(), req.Phone, req.Code)
	err := h.authService.VerifyOTPByEmail(c.Request.Context(), req.Email, req.Code)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Email address verified successfully"})
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
// @Param request body models.ForgotPasswordRequest true "Email address"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]interface{}
// @Router /api/v1/auth/forgot-password [post]
func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req models.ForgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	normalizedEmail := strings.ToLower(strings.TrimSpace(req.Email))

	// PHONE VERIFICATION (commented out — switched to email verification)
	// otp, err := h.authService.ForgotPassword(c.Request.Context(), req.Phone)
	otp, err := h.authService.ForgotPasswordByEmail(c.Request.Context(), normalizedEmail)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if h.emailClient != nil {
		if _, sendErr := h.emailClient.SendOTPEmail(normalizedEmail, otp); sendErr != nil {
			log.Printf("❌ Failed to send password reset email: %v", sendErr)
		}
	}

	// OTP not returned to the client — Brevo actually delivers the email now
	c.JSON(http.StatusOK, gin.H{
		"message": "OTP sent to email",
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

// DriverLogin handles login for drivers created by admin.
// Accepts either username or phone number together with password.
// POST /api/v1/auth/driver-login
func (h *AuthHandler) DriverLogin(c *gin.Context) {
	var req struct {
		// Driver can log in with either their username or phone number
		Login    string `json:"login"    binding:"required"` // username OR phone
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := c.Request.Context()
	login := strings.TrimSpace(req.Login)

	// Try username first, then fall back to phone lookup
	var user *models.User
	var err error

	user, err = userRepo.FindByUsername(ctx, login)
	if err != nil || user == nil {
		// Not found by username — try as phone number
		normalized := normalizePhone(login)
		user, err = userRepo.FindByPhone(ctx, normalized)
		if err != nil || user == nil {
			// Last attempt with original value
			user, err = userRepo.FindByPhone(ctx, login)
		}
	}

	if err != nil || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username/phone or password"})
		return
	}

	if user.Role.Type != "driver" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied. This login is for drivers only."})
		return
	}

	if !auth.CheckPasswordHash(req.Password, user.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid username/phone or password"})
		return
	}

	tokenPair, err := auth.GenerateToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	_ = userRepo.UpdateLastLogin(ctx, user.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": "Login successful",
		"user": gin.H{
			"id":        user.ID,
			"username":  user.Username,
			"phone":     user.Phone,
			"role":      user.Role.Type,
			"firstName": user.Profile.FirstName,
		},
		"tokens": gin.H{
			"accessToken":  tokenPair.AccessToken,
			"refreshToken": tokenPair.RefreshToken,
		},
	})
}