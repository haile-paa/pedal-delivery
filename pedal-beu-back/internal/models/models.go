package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// Common types used across models
type GeoLocation struct {
	Type        string    `bson:"type" json:"type"`               // "Point"
	Coordinates []float64 `bson:"coordinates" json:"coordinates"` // [longitude, latitude]
}

type Address struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Label     string             `bson:"label" json:"label"` // "Home", "Work", etc.
	Address   string             `bson:"address" json:"address"`
	Location  GeoLocation        `bson:"location" json:"location"`
	IsDefault bool               `bson:"is_default" json:"is_default"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
}

type Document struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Type       string             `bson:"type" json:"type"` // "license", "insurance", "registration"
	URL        string             `bson:"url" json:"url"`
	Status     string             `bson:"status" json:"status"` // "pending", "approved", "rejected"
	VerifiedAt *time.Time         `bson:"verified_at,omitempty" json:"verified_at,omitempty"`
	CreatedAt  time.Time          `bson:"created_at" json:"created_at"`
}

type OpeningHours struct {
	Monday    []TimeSlot `bson:"monday" json:"monday"`
	Tuesday   []TimeSlot `bson:"tuesday" json:"tuesday"`
	Wednesday []TimeSlot `bson:"wednesday" json:"wednesday"`
	Thursday  []TimeSlot `bson:"thursday" json:"thursday"`
	Friday    []TimeSlot `bson:"friday" json:"friday"`
	Saturday  []TimeSlot `bson:"saturday" json:"saturday"`
	Sunday    []TimeSlot `bson:"sunday" json:"sunday"`
}

type TimeSlot struct {
	Open  string `bson:"open" json:"open"`   // "09:00"
	Close string `bson:"close" json:"close"` // "22:00"
}

type Notification struct {
	ID        primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID    primitive.ObjectID `bson:"user_id" json:"user_id"`
	Title     string             `bson:"title" json:"title"`
	Message   string             `bson:"message" json:"message"`
	Type      string             `bson:"type" json:"type"` // "order", "system", "promotion"
	Data      interface{}        `bson:"data,omitempty" json:"data,omitempty"`
	IsRead    bool               `bson:"is_read" json:"is_read"`
	CreatedAt time.Time          `bson:"created_at" json:"created_at"`
}

type ChatMessage struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	OrderID    primitive.ObjectID `bson:"order_id" json:"order_id"`
	SenderID   primitive.ObjectID `bson:"sender_id" json:"sender_id"`
	ReceiverID primitive.ObjectID `bson:"receiver_id" json:"receiver_id"`
	Message    string             `bson:"message" json:"message"`
	IsRead     bool               `bson:"is_read" json:"is_read"`
	CreatedAt  time.Time          `bson:"created_at" json:"created_at"`
}

// User models
type UserRole struct {
	Type        string   `bson:"type" json:"type"` // "customer", "driver", "admin"
	Permissions []string `bson:"permissions" json:"permissions"`
}

type UserProfile struct {
	FirstName string    `bson:"first_name" json:"first_name"`
	LastName  string    `bson:"last_name" json:"last_name"`
	Avatar    string    `bson:"avatar,omitempty" json:"avatar,omitempty"`
	Addresses []Address `bson:"addresses,omitempty" json:"addresses,omitempty"`
}

type User struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Phone       string             `bson:"phone" json:"phone"`
	Email       string             `bson:"email,omitempty" json:"email,omitempty"`
	Username    string             `bson:"username,omitempty" json:"username,omitempty"` // Added for driver registration
	Password    string             `bson:"password,omitempty" json:"-"`
	Role        UserRole           `bson:"role" json:"role"`
	Profile     UserProfile        `bson:"profile" json:"profile"`
	IsVerified  bool               `bson:"is_verified" json:"is_verified"`
	OTP         *OTP               `bson:"otp,omitempty" json:"-"`
	FCMToken    string             `bson:"fcm_token,omitempty" json:"-"`
	LastLoginAt *time.Time         `bson:"last_login_at,omitempty" json:"last_login_at,omitempty"`
	CreatedAt   time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt   time.Time          `bson:"updated_at" json:"updated_at"`
}
type Admin struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Phone       string             `bson:"phone" json:"phone"`
	Email       string             `bson:"email,omitempty" json:"email,omitempty"`
	FirstName   string             `bson:"first_name" json:"firstName"`
	LastName    string             `bson:"last_name,omitempty" json:"lastName,omitempty"`
	Password    string             `bson:"password" json:"-"`
	IsVerified  bool               `bson:"is_verified" json:"isVerified"`
	IsActive    bool               `bson:"is_active" json:"isActive"`
	LastLoginAt time.Time          `bson:"last_login_at,omitempty" json:"lastLoginAt,omitempty"`
	CreatedAt   time.Time          `bson:"created_at" json:"createdAt"`
	UpdatedAt   time.Time          `bson:"updated_at" json:"updatedAt"`
}

type OTP struct {
	Code      string    `bson:"code" json:"code"`
	ExpiresAt time.Time `bson:"expires_at" json:"expires_at"`
	Attempts  int       `bson:"attempts" json:"attempts"`
}

// Driver models
type DriverStatus string

const (
	DriverPending   DriverStatus = "pending"
	DriverApproved  DriverStatus = "approved"
	DriverRejected  DriverStatus = "rejected"
	DriverSuspended DriverStatus = "suspended"
)

type Vehicle struct {
	Type  string `bson:"type" json:"type"` // "bicycle", "motorcycle", "car"
	Model string `bson:"model,omitempty" json:"model,omitempty"`
	Color string `bson:"color,omitempty" json:"color,omitempty"`
	Plate string `bson:"plate,omitempty" json:"plate,omitempty"`
	Year  int    `bson:"year,omitempty" json:"year,omitempty"`
}

type DriverEarnings struct {
	Today        float64    `bson:"today" json:"today"`
	ThisWeek     float64    `bson:"this_week" json:"this_week"`
	ThisMonth    float64    `bson:"this_month" json:"this_month"`
	Total        float64    `bson:"total" json:"total"`
	Pending      float64    `bson:"pending" json:"pending"`
	LastPayoutAt *time.Time `bson:"last_payout_at,omitempty" json:"last_payout_at,omitempty"`
}

type Driver struct {
	ID              primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID          primitive.ObjectID `bson:"user_id" json:"user_id"`
	Status          DriverStatus       `bson:"status" json:"status"`
	Documents       []Document         `bson:"documents" json:"documents"`
	Vehicle         Vehicle            `bson:"vehicle" json:"vehicle"`
	IsOnline        bool               `bson:"is_online" json:"is_online"`
	Location        GeoLocation        `bson:"location" json:"location"`
	Rating          float64            `bson:"rating" json:"rating"`
	TotalTrips      int                `bson:"total_trips" json:"total_trips"`
	Earnings        DriverEarnings     `bson:"earnings" json:"earnings"`
	RejectionReason string             `bson:"rejection_reason,omitempty" json:"rejection_reason,omitempty"`
	IsActive        bool               `bson:"is_active" json:"is_active"`
	CreatedAt       time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt       time.Time          `bson:"updated_at" json:"updated_at"`
}

// Restaurant models
type MenuItem struct {
	ID              primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name            string             `bson:"name" json:"name"`
	Description     string             `bson:"description" json:"description"`
	Price           float64            `bson:"price" json:"price"`
	Image           string             `bson:"image,omitempty" json:"image,omitempty"`
	Category        string             `bson:"category" json:"category"`
	IsAvailable     bool               `bson:"is_available" json:"is_available"`
	Ingredients     []string           `bson:"ingredients,omitempty" json:"ingredients,omitempty"`
	Addons          []Addon            `bson:"addons,omitempty" json:"addons,omitempty"`
	PreparationTime int                `bson:"preparation_time" json:"preparation_time"` // in minutes
	CreatedAt       time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt       time.Time          `bson:"updated_at" json:"updated_at"`
}

type Addon struct {
	ID       primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name     string             `bson:"name" json:"name"`
	Price    float64            `bson:"price" json:"price"`
	IsActive bool               `bson:"is_active" json:"is_active"`
}

type Restaurant struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	OwnerID      primitive.ObjectID `bson:"owner_id" json:"owner_id"`
	Name         string             `bson:"name" json:"name"`
	Description  string             `bson:"description" json:"description"`
	CuisineType  []string           `bson:"cuisine_type" json:"cuisine_type"`
	Location     GeoLocation        `bson:"location" json:"location"`
	Address      string             `bson:"address" json:"address"`
	Phone        string             `bson:"phone" json:"phone"`
	Email        string             `bson:"email,omitempty" json:"email,omitempty"`
	Images       []string           `bson:"images" json:"images"`
	Menu         []MenuItem         `bson:"menu" json:"menu"`
	IsActive     bool               `bson:"is_active" json:"is_active"`
	IsVerified   bool               `bson:"is_verified" json:"is_verified"`
	Rating       float64            `bson:"rating" json:"rating"`
	TotalReviews int                `bson:"total_reviews" json:"total_reviews"`
	OpeningHours OpeningHours       `bson:"opening_hours" json:"opening_hours"`
	DeliveryFee  float64            `bson:"delivery_fee" json:"delivery_fee"`
	MinOrder     float64            `bson:"min_order" json:"min_order"`
	DeliveryTime int                `bson:"delivery_time" json:"delivery_time"` // in minutes
	CreatedAt    time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt    time.Time          `bson:"updated_at" json:"updated_at"`
}

// Order models
type OrderStatus string

const (
	OrderPending   OrderStatus = "pending"
	OrderAccepted  OrderStatus = "accepted"
	OrderPreparing OrderStatus = "preparing"
	OrderReady     OrderStatus = "ready"
	OrderPickedUp  OrderStatus = "picked_up"
	OrderOnTheWay  OrderStatus = "on_the_way"
	OrderDelivered OrderStatus = "delivered"
	OrderCancelled OrderStatus = "cancelled"
	OrderRejected  OrderStatus = "rejected"
)

type OrderItem struct {
	MenuItemID primitive.ObjectID `bson:"menu_item_id" json:"menu_item_id"`
	Name       string             `bson:"name" json:"name"`
	Quantity   int                `bson:"quantity" json:"quantity"`
	Price      float64            `bson:"price" json:"price"`
	Addons     []OrderItemAddon   `bson:"addons,omitempty" json:"addons,omitempty"`
	Total      float64            `bson:"total" json:"total"`
	Notes      string             `bson:"notes,omitempty" json:"notes,omitempty"`
}

type OrderItemAddon struct {
	AddonID primitive.ObjectID `bson:"addon_id" json:"addon_id"`
	Name    string             `bson:"name" json:"name"`
	Price   float64            `bson:"price" json:"price"`
}

type OrderAmount struct {
	Subtotal      float64 `bson:"subtotal" json:"subtotal"`
	DeliveryFee   float64 `bson:"delivery_fee" json:"delivery_fee"`
	ServiceCharge float64 `bson:"service_charge" json:"service_charge"`
	Discount      float64 `bson:"discount" json:"discount"`
	Tax           float64 `bson:"tax" json:"tax"`
	Total         float64 `bson:"total" json:"total"`
}

type DeliveryInfo struct {
	Address           Address    `bson:"address" json:"address"`
	Notes             string     `bson:"notes,omitempty" json:"notes,omitempty"`
	ContactName       string     `bson:"contact_name" json:"contact_name"`
	ContactPhone      string     `bson:"contact_phone" json:"contact_phone"`
	EstimatedDelivery time.Time  `bson:"estimated_delivery" json:"estimated_delivery"`
	ActualDelivery    *time.Time `bson:"actual_delivery,omitempty" json:"actual_delivery,omitempty"`
}

type OrderEvent struct {
	Status    OrderStatus        `bson:"status" json:"status"`
	Timestamp time.Time          `bson:"timestamp" json:"timestamp"`
	ActorID   primitive.ObjectID `bson:"actor_id,omitempty" json:"actor_id,omitempty"`
	ActorType string             `bson:"actor_type,omitempty" json:"actor_type,omitempty"` // "customer", "driver", "restaurant", "system"
	Notes     string             `bson:"notes,omitempty" json:"notes,omitempty"`
}

type Order struct {
	ID            primitive.ObjectID  `bson:"_id,omitempty" json:"id"`
	OrderNumber   string              `bson:"order_number" json:"order_number"`
	CustomerID    primitive.ObjectID  `bson:"customer_id" json:"customer_id"`
	DriverID      *primitive.ObjectID `bson:"driver_id,omitempty" json:"driver_id,omitempty"`
	RestaurantID  primitive.ObjectID  `bson:"restaurant_id" json:"restaurant_id"`
	Items         []OrderItem         `bson:"items" json:"items"`
	Status        OrderStatus         `bson:"status" json:"status"`
	TotalAmount   OrderAmount         `bson:"total_amount" json:"total_amount"`
	DeliveryInfo  DeliveryInfo        `bson:"delivery_info" json:"delivery_info"`
	Timeline      []OrderEvent        `bson:"timeline" json:"timeline"`
	PaymentMethod string              `bson:"payment_method" json:"payment_method"`
	PaymentStatus string              `bson:"payment_status" json:"payment_status"` // "pending", "paid", "failed", "refunded"
	Rating        *OrderRating        `bson:"rating,omitempty" json:"rating,omitempty"`
	IsScheduled   bool                `bson:"is_scheduled" json:"is_scheduled"`
	ScheduledFor  *time.Time          `bson:"scheduled_for,omitempty" json:"scheduled_for,omitempty"`
	Cancellation  *CancellationInfo   `bson:"cancellation,omitempty" json:"cancellation,omitempty"`
	CreatedAt     time.Time           `bson:"created_at" json:"created_at"`
	UpdatedAt     time.Time           `bson:"updated_at" json:"updated_at"`
}

type OrderRating struct {
	FoodRating       int       `bson:"food_rating" json:"food_rating"`
	DeliveryRating   int       `bson:"delivery_rating" json:"delivery_rating"`
	RestaurantRating int       `bson:"restaurant_rating" json:"restaurant_rating"`
	Comment          string    `bson:"comment,omitempty" json:"comment,omitempty"`
	RatedAt          time.Time `bson:"rated_at" json:"rated_at"`
}

type CancellationInfo struct {
	Reason       string             `bson:"reason" json:"reason"`
	CancelledBy  primitive.ObjectID `bson:"cancelled_by" json:"cancelled_by"`
	Role         string             `bson:"role" json:"role"`
	Timestamp    time.Time          `bson:"timestamp" json:"timestamp"`
	RefundAmount float64            `bson:"refund_amount,omitempty" json:"refund_amount,omitempty"`
}

// Request/Response DTOs
type RegisterRequest struct {
	Phone     string `json:"phone" binding:"required"`
	Email     string `json:"email,omitempty" binding:"omitempty,email"`
	FirstName string `json:"first_name"`
	Role      string `json:"role" binding:"required,oneof=customer driver admin"` // Added admin
	Password  string `json:"password,omitempty"`                                  // Optional, will be auto-generated for drivers
}

type LoginRequest struct {
	Phone    string `json:"phone" binding:"required"`
	Password string `json:"password" binding:"required"`
	OTP      string `json:"otp,omitempty"`
}
type LoginWithOTPRequest struct {
	Phone string `json:"phone" binding:"required"`
}

type VerifyOTPRequest struct {
	Phone string `json:"phone" binding:"required"`
	Code  string `json:"code" binding:"required"`
	Role  string `json:"role" binding:"required,oneof=customer driver admin"` // Added admin
}

type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

type ForgotPasswordRequest struct {
	Phone string `json:"phone" binding:"required"`
}

type ResetPasswordRequest struct {
	Phone       string `json:"phone" binding:"required"`
	OTP         string `json:"otp" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=6"`
}

type UpdateProfileRequest struct {
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Email     string `json:"email" binding:"omitempty,email"`
	Avatar    string `json:"avatar"`
}

type CreateAddressRequest struct {
	Label     string  `json:"label" binding:"required"`
	Address   string  `json:"address" binding:"required"`
	Latitude  float64 `json:"latitude" binding:"required"`
	Longitude float64 `json:"longitude" binding:"required"`
	IsDefault bool    `json:"is_default"`
}

type CreateOrderRequest struct {
	RestaurantID  string             `json:"restaurant_id" binding:"required"`
	Items         []OrderItemRequest `json:"items" binding:"required,min=1"`
	AddressID     string             `json:"address_id" binding:"required"`
	Notes         string             `json:"notes"`
	PaymentMethod string             `json:"payment_method" binding:"required"`
}

type OrderItemRequest struct {
	MenuItemID string                  `json:"menu_item_id" binding:"required"`
	Quantity   int                     `json:"quantity" binding:"required,min=1"`
	Addons     []OrderItemAddonRequest `json:"addons"`
	Notes      string                  `json:"notes"`
}

type OrderItemAddonRequest struct {
	AddonID string `json:"addon_id" binding:"required"`
}

type CreateRestaurantRequest struct {
	Name         string                  `json:"name" binding:"required"`
	Description  string                  `json:"description"`
	CuisineType  []string                `json:"cuisine_type"`
	Address      string                  `json:"address" binding:"required"`
	Latitude     float64                 `json:"latitude" binding:"required"`
	Longitude    float64                 `json:"longitude" binding:"required"`
	Phone        string                  `json:"phone" binding:"required"`
	Email        string                  `json:"email" binding:"omitempty,email"`
	DeliveryFee  float64                 `json:"delivery_fee"`
	MinOrder     float64                 `json:"min_order"`
	DeliveryTime int                     `json:"delivery_time"`
	Images       []string                `json:"images"` // Add this field too
	Menu         []CreateMenuItemRequest `json:"menu"`   // Add this field
}

type DriverApplicationRequest struct {
	VehicleType  string `json:"vehicle_type" binding:"required"`
	VehicleModel string `json:"vehicle_model"`
	VehicleColor string `json:"vehicle_color"`
	VehiclePlate string `json:"vehicle_plate"`
	VehicleYear  int    `json:"vehicle_year"`
}

// RegisterDriverRequest for driver registration with manager credentials
type RegisterDriverRequest struct {
	Phone    string `json:"phone" binding:"required"`
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required,min=6"`
}

// SendOTPRequest for sending OTP with role
type SendOTPRequest struct {
	Phone string `json:"phone" binding:"required"`
	Role  string `json:"role" binding:"required,oneof=customer driver admin"` // Added admin
}

// internal/models/requests.go - Add these types
type RestaurantQuery struct {
	Page      int     `form:"page" default:"1"`
	Limit     int     `form:"limit" default:"20"`
	Category  string  `form:"category"`
	Latitude  float64 `form:"latitude"`
	Longitude float64 `form:"longitude"`
	Radius    float64 `form:"radius" default:"10000"`
}

type UpdateRestaurantRequest struct {
	Name         string                  `json:"name"`
	Description  string                  `json:"description"`
	CuisineType  []string                `json:"cuisine_type"`
	Address      string                  `json:"address"`
	Phone        string                  `json:"phone"`
	Email        string                  `json:"email" binding:"omitempty,email"`
	DeliveryFee  float64                 `json:"delivery_fee"`
	MinOrder     float64                 `json:"min_order"`
	DeliveryTime int                     `json:"delivery_time"`
	Latitude     float64                 `json:"latitude"`
	Longitude    float64                 `json:"longitude"`
	Images       []string                `json:"images"` // Add this
	Menu         []CreateMenuItemRequest `json:"menu"`   // Add this
}

// Add these to models/requests.go
type CreateMenuItemRequest struct {
	Name            string   `json:"name" binding:"required"`
	Description     string   `json:"description"`
	Price           float64  `json:"price" binding:"required"`
	Category        string   `json:"category" binding:"required"`
	Ingredients     []string `json:"ingredients"`
	Addons          []Addon  `json:"addons"`
	PreparationTime int      `json:"preparation_time"`
	IsAvailable     *bool    `json:"is_available" default:"true"`
	Image           string   `json:"image"`
}

type CreateAddonRequest struct {
	Name     string  `json:"name" binding:"required"`
	Price    float64 `json:"price" binding:"required"`
	IsActive bool    `json:"is_active" default:"true"`
}

type UpdateMenuItemRequest struct {
	Name            string   `json:"name"`
	Description     string   `json:"description"`
	Price           float64  `json:"price"`
	Category        string   `json:"category"`
	Ingredients     []string `json:"ingredients"`
	Addons          []Addon  `json:"addons"`
	IsAvailable     *bool    `json:"is_available"` // Use pointer to distinguish between false and not provided
	PreparationTime int      `json:"preparation_time"`
	Image           string   `json:"image"`
}
