package services

import (
	"context"
	"errors"
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/haile-paa/pedal-delivery/internal/models"
	"github.com/haile-paa/pedal-delivery/internal/repositories"
	"github.com/haile-paa/pedal-delivery/pkg/auth"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type AuthService interface {
	Register(ctx context.Context, req *models.RegisterRequest) (*models.User, *auth.TokenPair, error)
	Login(ctx context.Context, req *models.LoginRequest) (*models.User, *auth.TokenPair, error)
	LoginWithOTP(ctx context.Context, phone string) (*models.User, *auth.TokenPair, error) // Changed back to 2 params
	VerifyOTP(ctx context.Context, phone, code string) error
	GenerateOTP(ctx context.Context, phone string) (string, error)
	RefreshToken(ctx context.Context, refreshToken string) (*auth.TokenPair, error)
	GetProfile(ctx context.Context, userID primitive.ObjectID) (*models.User, error)
	UpdateProfile(ctx context.Context, userID primitive.ObjectID, req *models.UpdateProfileRequest) error
	SwitchRole(ctx context.Context, userID primitive.ObjectID, newRole string) error
	ForgotPassword(ctx context.Context, phone string) (string, error)
	ResetPassword(ctx context.Context, req *models.ResetPasswordRequest) error
	Logout(ctx context.Context, userID primitive.ObjectID) error
	RegisterDriver(ctx context.Context, req *models.RegisterDriverRequest) (*models.User, error)
	VerifyOTPWithRole(ctx context.Context, phone, code, role string) error
}

type authService struct {
	userRepo  repositories.UserRepository
	adminRepo repositories.AdminRepository
}

func NewAuthService(userRepo repositories.UserRepository, adminRepo repositories.AdminRepository) AuthService {
	return &authService{
		userRepo:  userRepo,
		adminRepo: adminRepo,
	}
}

// normalizePhone helper function to ensure consistent phone format
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

func (s *authService) Register(ctx context.Context, req *models.RegisterRequest) (*models.User, *auth.TokenPair, error) {
	// Normalize phone number
	normalizedPhone := normalizePhone(req.Phone)

	// Check if role is admin
	if req.Role == "admin" {
		// Check if admin already exists
		existingAdmin, _ := s.adminRepo.FindByPhone(ctx, normalizedPhone)
		if existingAdmin != nil {
			return nil, nil, errors.New("phone number already registered as admin")
		}

		// Also check in users collection to avoid duplication
		existingUser, _ := s.userRepo.FindByPhone(ctx, normalizedPhone)
		if existingUser != nil {
			return nil, nil, errors.New("phone number already registered as user")
		}
		firstName := req.FirstName
		if firstName == "" {
			firstName = "Admin User" // Default name
		}
		// Determine password - auto-generate if not provided
		password := req.Password
		if password == "" {
			password = generateSecurePassword()
		}

		// Hash password
		hashedPassword, err := auth.HashPassword(password)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to hash password: %v", err)
		}

		// Create admin
		admin := &models.Admin{
			Phone:      normalizedPhone,
			Email:      req.Email,
			FirstName:  req.FirstName,
			LastName:   "", // LastName not available in RegisterRequest
			Password:   hashedPassword,
			IsVerified: true, // Admins are verified immediately
			IsActive:   true,
			CreatedAt:  time.Now(),
			UpdatedAt:  time.Now(),
		}

		// Save admin
		if err := s.adminRepo.Create(ctx, admin); err != nil {
			return nil, nil, err
		}

		// Create user object for token generation
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
			IsVerified: admin.IsVerified,
			CreatedAt:  admin.CreatedAt,
			UpdatedAt:  admin.UpdatedAt,
		}

		// Generate JWT tokens
		tokenPair, err := auth.GenerateToken(user)
		if err != nil {
			return nil, nil, err
		}

		// Update last login
		_ = s.adminRepo.UpdateLastLogin(ctx, admin.ID)

		return user, tokenPair, nil
	} else {
		// For non-admin roles (customer, driver)
		// Check if user already exists in users collection
		existingUser, _ := s.userRepo.FindByPhone(ctx, normalizedPhone)
		if existingUser != nil {
			return nil, nil, errors.New("phone number already registered")
		}

		// Also check in admins collection to avoid duplication
		existingAdmin, _ := s.adminRepo.FindByPhone(ctx, normalizedPhone)
		if existingAdmin != nil {
			return nil, nil, errors.New("phone number already registered as admin")
		}

		// Determine password - auto-generate for drivers if not provided
		password := req.Password
		if password == "" {
			if req.Role == "driver" {
				password = generateSecurePassword()
			} else {
				// For customers using OTP-only, create a placeholder
				password = "otp_only_auth_" + normalizedPhone
			}
		}

		// Hash password
		hashedPassword, err := auth.HashPassword(password)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to hash password: %v", err)
		}

		// Set permissions based on role
		var permissions []string
		if req.Role == "customer" {
			permissions = []string{"order:create", "order:read", "profile:update"}
		} else if req.Role == "driver" {
			permissions = []string{"order:accept", "order:update", "location:update", "profile:update"}
		}

		// Create user
		user := &models.User{
			Phone:      normalizedPhone,
			Email:      req.Email,
			Password:   hashedPassword,
			IsVerified: true, // Verified via OTP
			Role: models.UserRole{
				Type:        req.Role,
				Permissions: permissions,
			},
			Profile: models.UserProfile{
				FirstName: req.FirstName,
				LastName:  "", // LastName not available in RegisterRequest
			},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}

		// Save user
		if err := s.userRepo.Create(ctx, user); err != nil {
			return nil, nil, err
		}

		// Generate JWT tokens
		tokenPair, err := auth.GenerateToken(user)
		if err != nil {
			return nil, nil, err
		}

		// Update last login
		_ = s.userRepo.UpdateLastLogin(ctx, user.ID)

		return user, tokenPair, nil
	}
}

// Login method (password-based login - for traditional login)
func (s *authService) Login(ctx context.Context, req *models.LoginRequest) (*models.User, *auth.TokenPair, error) {
	// Normalize phone number
	normalizedPhone := normalizePhone(req.Phone)

	// Try to find user first
	user, err := s.userRepo.FindByPhone(ctx, normalizedPhone)
	if err != nil {
		// If not found in users, try admins
		admin, adminErr := s.adminRepo.FindByPhone(ctx, normalizedPhone)
		if adminErr != nil {
			return nil, nil, errors.New("invalid credentials")
		}

		// Verify admin password
		if !auth.CheckPasswordHash(req.Password, admin.Password) {
			return nil, nil, errors.New("invalid credentials")
		}

		// Check if admin is active
		if !admin.IsActive {
			return nil, nil, errors.New("admin account is deactivated")
		}

		// Check if admin is verified
		if !admin.IsVerified {
			return nil, nil, errors.New("admin account not verified")
		}

		// Create user object for token generation
		userObj := &models.User{
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
			IsVerified: admin.IsVerified,
			CreatedAt:  admin.CreatedAt,
			UpdatedAt:  admin.UpdatedAt,
		}

		// Generate tokens
		tokenPair, err := auth.GenerateToken(userObj)
		if err != nil {
			return nil, nil, err
		}

		// Update last login
		_ = s.adminRepo.UpdateLastLogin(ctx, admin.ID)

		return userObj, tokenPair, nil
	}

	// If user found, verify password
	if !auth.CheckPasswordHash(req.Password, user.Password) {
		return nil, nil, errors.New("invalid credentials")
	}

	// Check if user is verified
	if !user.IsVerified {
		return nil, nil, errors.New("account not verified. Please verify your phone number")
	}

	// Generate tokens
	tokenPair, err := auth.GenerateToken(user)
	if err != nil {
		return nil, nil, err
	}

	// Update last login
	_ = s.userRepo.UpdateLastLogin(ctx, user.ID)

	return user, tokenPair, nil
}

// LoginWithOTP method (OTP-based login - for your new flow) - Changed back to 2 params
func (s *authService) LoginWithOTP(ctx context.Context, phone string) (*models.User, *auth.TokenPair, error) {
	// Normalize phone number
	normalizedPhone := normalizePhone(phone)

	// Try to find user first
	user, err := s.userRepo.FindByPhone(ctx, normalizedPhone)
	if err == nil {
		// User found
		// Check if user is verified
		if !user.IsVerified {
			return nil, nil, errors.New("account not verified")
		}

		// Generate tokens
		tokenPair, err := auth.GenerateToken(user)
		if err != nil {
			return nil, nil, err
		}

		// Update last login
		_ = s.userRepo.UpdateLastLogin(ctx, user.ID)

		return user, tokenPair, nil
	}

	// If not found as user, try admin
	admin, adminErr := s.adminRepo.FindByPhone(ctx, normalizedPhone)
	if adminErr != nil {
		return nil, nil, errors.New("user not found")
	}

	// Admin found
	// Check if admin is active
	if !admin.IsActive {
		return nil, nil, errors.New("admin account is deactivated")
	}

	// Check if admin is verified
	if !admin.IsVerified {
		return nil, nil, errors.New("admin account not verified")
	}

	// Create user object for token generation
	userObj := &models.User{
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
		IsVerified: admin.IsVerified,
		CreatedAt:  admin.CreatedAt,
		UpdatedAt:  admin.UpdatedAt,
	}

	// Generate tokens
	tokenPair, err := auth.GenerateToken(userObj)
	if err != nil {
		return nil, nil, err
	}

	// Update last login
	_ = s.adminRepo.UpdateLastLogin(ctx, admin.ID)

	return userObj, tokenPair, nil
}

// Generate secure password
func generateSecurePassword() string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
	rand.Seed(time.Now().UnixNano())
	password := make([]byte, 12)
	for i := range password {
		password[i] = charset[rand.Intn(len(charset))]
	}
	return string(password)
}

func (s *authService) VerifyOTP(ctx context.Context, phone, code string) error {
	// Normalize phone number
	normalizedPhone := normalizePhone(phone)

	// Try to find user first
	user, err := s.userRepo.FindByPhone(ctx, normalizedPhone)
	if err != nil {
		// If not found in users, try admins
		_, adminErr := s.adminRepo.FindByPhone(ctx, normalizedPhone)
		if adminErr != nil {
			return errors.New("user not found")
		}

		// Admin OTP verification logic (if needed)
		// For now, we'll just check if admin exists
		// In production, implement proper OTP verification for admins

		return nil
	}

	// User OTP verification
	if user.OTP == nil {
		return errors.New("no OTP requested")
	}

	if user.OTP.Code != code {
		// Increment failed attempts
		user.OTP.Attempts++
		if user.OTP.Attempts >= 3 {
			// Clear OTP after 3 failed attempts
			_ = s.userRepo.Update(ctx, user.ID, bson.M{"otp": nil})
			return errors.New("too many failed attempts. Please request a new OTP")
		}
		_ = s.userRepo.Update(ctx, user.ID, bson.M{"otp": user.OTP})
		return errors.New("invalid OTP code")
	}

	if user.OTP.ExpiresAt.Before(time.Now()) {
		return errors.New("OTP expired")
	}

	// Verify user
	if err := s.userRepo.VerifyPhone(ctx, phone); err != nil {
		return err
	}

	return nil
}

func (s *authService) GenerateOTP(ctx context.Context, phone string) (string, error) {
	// Generate 6-digit OTP
	otpCode := fmt.Sprintf("%06d", rand.Intn(1000000))

	// Try to find user first
	_, err := s.userRepo.FindByPhone(ctx, phone)
	if err != nil {
		// If not found in users, try admins
		_, adminErr := s.adminRepo.FindByPhone(ctx, phone)
		if adminErr != nil {
			return "", errors.New("user not found")
		}

		// For admin, we might handle OTP differently
		// For now, return the OTP without storing in DB (using in-memory store)
		return otpCode, nil
	}

	// Save OTP to user
	if err := s.userRepo.UpdateOTP(ctx, phone, otpCode); err != nil {
		return "", err
	}

	return otpCode, nil
}

func (s *authService) RefreshToken(ctx context.Context, refreshToken string) (*auth.TokenPair, error) {
	tokenPair, err := auth.RefreshToken(refreshToken)
	if err != nil {
		return nil, errors.New("invalid refresh token")
	}
	return tokenPair, nil
}

func (s *authService) GetProfile(ctx context.Context, userID primitive.ObjectID) (*models.User, error) {
	// Try to get user first
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		// If not found in users, try admins
		admin, adminErr := s.adminRepo.FindByID(ctx, userID)
		if adminErr != nil {
			return nil, errors.New("user not found")
		}

		// Create user object from admin
		userObj := &models.User{
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
			IsVerified: admin.IsVerified,
			CreatedAt:  admin.CreatedAt,
			UpdatedAt:  admin.UpdatedAt,
		}

		return userObj, nil
	}

	// Clear sensitive data
	user.Password = ""
	user.OTP = nil
	user.FCMToken = ""

	return user, nil
}

func (s *authService) UpdateProfile(ctx context.Context, userID primitive.ObjectID, req *models.UpdateProfileRequest) error {
	// Try to update user first
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		// If not found in users, try admins
		admin, adminErr := s.adminRepo.FindByID(ctx, userID)
		if adminErr != nil {
			return errors.New("user not found")
		}

		// Update admin profile
		updateFields := bson.M{}
		if req.FirstName != "" {
			updateFields["first_name"] = req.FirstName
		}
		if req.LastName != "" {
			updateFields["last_name"] = req.LastName
		}
		if req.Email != "" {
			updateFields["email"] = req.Email
		}

		if len(updateFields) == 0 {
			return nil
		}

		return s.adminRepo.Update(ctx, admin.ID, updateFields)
	}

	// Update user profile
	updateFields := bson.M{}
	if req.FirstName != "" {
		updateFields["profile.first_name"] = req.FirstName
	}
	if req.LastName != "" {
		updateFields["profile.last_name"] = req.LastName
	}
	if req.Email != "" {
		updateFields["email"] = req.Email
	}
	if req.Avatar != "" {
		updateFields["profile.avatar"] = req.Avatar
	}

	if len(updateFields) == 0 {
		return nil
	}

	return s.userRepo.Update(ctx, user.ID, updateFields)
}

func (s *authService) SwitchRole(ctx context.Context, userID primitive.ObjectID, newRole string) error {
	// This should only work for users, not admins
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		return errors.New("user not found")
	}

	validRoles := map[string][]string{
		"customer": {"order:create", "order:read", "profile:update"},
		"driver":   {"order:accept", "order:update", "location:update", "profile:update"},
	}

	permissions, exists := validRoles[newRole]
	if !exists {
		return fmt.Errorf("invalid role: %s. Allowed roles: customer, driver", newRole)
	}

	update := bson.M{
		"role": models.UserRole{
			Type:        newRole,
			Permissions: permissions,
		},
	}

	return s.userRepo.Update(ctx, user.ID, update)
}

func (s *authService) ForgotPassword(ctx context.Context, phone string) (string, error) {
	// Normalize phone number
	normalizedPhone := normalizePhone(phone)

	// Try to find user first
	user, err := s.userRepo.FindByPhone(ctx, normalizedPhone)
	if err != nil {
		// If not found in users, try admins
		_, adminErr := s.adminRepo.FindByPhone(ctx, normalizedPhone)
		if adminErr != nil {
			return "", errors.New("user not found")
		}

		// Generate OTP for admin
		return s.GenerateOTP(ctx, normalizedPhone)
	}

	if !user.IsVerified {
		return "", errors.New("account not verified")
	}

	otp, err := s.GenerateOTP(ctx, normalizedPhone)
	if err != nil {
		return "", err
	}

	return otp, nil
}

func (s *authService) ResetPassword(ctx context.Context, req *models.ResetPasswordRequest) error {
	// Normalize phone number
	normalizedPhone := normalizePhone(req.Phone)

	// Verify OTP first
	if err := s.VerifyOTP(ctx, normalizedPhone, req.OTP); err != nil {
		return errors.New("invalid OTP")
	}

	// Try to find user first
	user, err := s.userRepo.FindByPhone(ctx, normalizedPhone)
	if err != nil {
		// If not found in users, try admins
		admin, adminErr := s.adminRepo.FindByPhone(ctx, normalizedPhone)
		if adminErr != nil {
			return errors.New("user not found")
		}

		hashedPassword, err := auth.HashPassword(req.NewPassword)
		if err != nil {
			return fmt.Errorf("failed to hash password: %v", err)
		}

		return s.adminRepo.Update(ctx, admin.ID, bson.M{"password": hashedPassword})
	}

	hashedPassword, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		return fmt.Errorf("failed to hash password: %v", err)
	}

	return s.userRepo.Update(ctx, user.ID, bson.M{"password": hashedPassword})
}

func (s *authService) Logout(ctx context.Context, userID primitive.ObjectID) error {
	// Try to clear FCM token for user first
	user, err := s.userRepo.FindByID(ctx, userID)
	if err != nil {
		// If not found in users, try admins
		_, adminErr := s.adminRepo.FindByID(ctx, userID)
		if adminErr != nil {
			return errors.New("user not found")
		}

		// For admin, we don't have FCM token in the model
		// We could add it if needed
		return nil
	}

	// Clear FCM token for user
	if err := s.userRepo.UpdateFCMToken(ctx, user.ID, ""); err != nil {
		return err
	}

	return nil
}

// RegisterDriver registers a driver with manager credentials
func (s *authService) RegisterDriver(ctx context.Context, req *models.RegisterDriverRequest) (*models.User, error) {
	// Normalize phone number
	normalizedPhone := normalizePhone(req.Phone)

	// Check if user already exists
	existingUser, _ := s.userRepo.FindByPhone(ctx, normalizedPhone)
	if existingUser != nil {
		return nil, errors.New("phone number already registered")
	}

	// Hash password
	hashedPassword, err := auth.HashPassword(req.Password)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %v", err)
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
			LastName:  "",
		},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Save user
	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, err
	}

	// Generate OTP
	otp, err := s.GenerateOTP(ctx, normalizedPhone)
	if err != nil {
		// User is created, but OTP sending failed
		// Could log this error
		return user, nil
	}

	// In production, send OTP via SMS
	_ = otp // Use OTP

	return user, nil
}

// VerifyOTPWithRole verifies OTP and checks if user exists
func (s *authService) VerifyOTPWithRole(ctx context.Context, phone, code, role string) error {
	// Normalize phone number
	normalizedPhone := normalizePhone(phone)

	if role == "admin" {
		// Find admin by phone
		_, err := s.adminRepo.FindByPhone(ctx, normalizedPhone)
		if err != nil {
			return errors.New("admin not registered")
		}
	} else {
		// Find user by phone
		_, err := s.userRepo.FindByPhone(ctx, normalizedPhone)
		if err != nil {
			if role == "driver" {
				return errors.New("driver not registered")
			}
			// For customers, might be new registration
			return nil
		}
	}

	// Verify OTP logic here
	// For development, accept any 6-digit code
	if len(code) != 6 {
		return errors.New("invalid OTP code")
	}

	// For users, verify phone
	if role != "admin" {
		if err := s.userRepo.VerifyPhone(ctx, normalizedPhone); err != nil {
			return err
		}
	}

	return nil
}
