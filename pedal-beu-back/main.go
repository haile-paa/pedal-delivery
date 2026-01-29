package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/google/uuid"
	"github.com/haile-paa/pedal-delivery/internal/config"
	"github.com/haile-paa/pedal-delivery/internal/handlers"
	"github.com/haile-paa/pedal-delivery/internal/middleware"
	"github.com/haile-paa/pedal-delivery/internal/repositories"
	"github.com/haile-paa/pedal-delivery/internal/services"
	"github.com/haile-paa/pedal-delivery/internal/websocket"
	"github.com/haile-paa/pedal-delivery/pkg/database"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Set Gin mode
	if cfg.Server.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	} else {
		gin.SetMode(gin.DebugMode)
	}

	// Initialize database connections
	if err := database.Connect(); err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}
	defer database.Disconnect()

	if err := database.ConnectRedis(); err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer database.CloseRedis()

	// Create uploads directory
	uploadsDir := "./uploads"
	if err := os.MkdirAll(uploadsDir, 0755); err != nil {
		log.Printf("Warning: Failed to create uploads directory: %v", err)
	}

	// Create subdirectories
	subdirs := []string{"restaurants", "menu", "users", "documents"}
	for _, subdir := range subdirs {
		dirPath := filepath.Join(uploadsDir, subdir)
		if err := os.MkdirAll(dirPath, 0755); err != nil {
			log.Printf("Warning: Failed to create %s directory: %v", subdir, err)
		}
	}

	// Initialize repositories
	userRepo := repositories.NewUserRepository()
	adminRepo := repositories.NewAdminRepository()
	orderRepo := repositories.NewOrderRepository()
	restaurantRepo := repositories.NewRestaurantRepository()

	// Initialize services
	authService := services.NewAuthService(userRepo, adminRepo)
	orderService := services.NewOrderService(orderRepo, restaurantRepo, userRepo)
	restaurantService := services.NewRestaurantService(restaurantRepo)

	// Initialize handlers
	authHandler := handlers.NewAuthHandler(authService)
	orderHandler := handlers.NewOrderHandler(orderService)
	restaurantHandler := handlers.NewRestaurantHandler(restaurantService)

	// ✅ SET USER REPOSITORY FOR OTP HANDLERS
	handlers.SetUserRepository(userRepo)
	handlers.SetAdminRepository(adminRepo)

	router := gin.New()

	// Middleware
	router.Use(middleware.CORSMiddleware())
	router.Use(middleware.LoggingMiddleware())
	router.Use(gin.Recovery())

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"timestamp": time.Now().Unix(),
		})
	})

	// Serve static files for uploads
	router.Static("/uploads", uploadsDir)

	// API v1 routes
	api := router.Group("/api/v1")
	{
		// Authentication routes (public)
		auth := api.Group("/auth")
		{
			// OTP endpoints (standalone functions)
			auth.POST("/send-otp", handlers.SendOTP)
			auth.POST("/verify-otp", handlers.VerifyOTPOnly)

			// Driver registration (standalone function)
			auth.POST("/register-driver", handlers.RegisterDriver)

			// Existing AuthHandler endpoints
			auth.POST("/register", authHandler.Register)
			auth.POST("/login-otp", authHandler.LoginWithOTP)
			auth.POST("/refresh", authHandler.RefreshToken)
			auth.POST("/forgot-password", authHandler.ForgotPassword)
			auth.POST("/reset-password", authHandler.ResetPassword)

			// Add the check phone endpoint
			auth.GET("/check-phone", handlers.CheckPhoneExists)
		}

		// Image upload routes (simple implementation)
		upload := api.Group("/upload")
		{
			// Single image upload
			upload.POST("", func(c *gin.Context) {
				// Single file
				file, err := c.FormFile("image")
				if err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded", "details": err.Error()})
					return
				}

				// Get file type from form or default to "restaurants"
				fileType := c.PostForm("type")
				if fileType == "" {
					fileType = "restaurants"
				}

				// Generate unique filename
				ext := filepath.Ext(file.Filename)
				filename := uuid.New().String() + ext

				// Create folder if not exists
				uploadDir := filepath.Join(uploadsDir, fileType)
				if err := os.MkdirAll(uploadDir, 0755); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory", "details": err.Error()})
					return
				}

				// Save the file
				filePath := filepath.Join(uploadDir, filename)
				if err := c.SaveUploadedFile(file, filePath); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file", "details": err.Error()})
					return
				}

				// Construct the URL (use localhost for dev)
				serverURL := "https://pedal-delivery-back.onrender.com"
				if cfg.Server.Environment == "production" {
					// In production, use your actual domain
					serverURL = "https://pedal-delivery-back.onrender.com"
				}

				fileURL := fmt.Sprintf("%s/uploads/%s/%s", serverURL, fileType, filename)

				c.JSON(http.StatusOK, gin.H{
					"url":       fileURL,
					"filename":  filename,
					"size":      file.Size,
					"type":      fileType,
					"mime_type": file.Header.Get("Content-Type"),
				})
			})

			// Multiple images upload
			upload.POST("/multiple", func(c *gin.Context) {
				form, err := c.MultipartForm()
				if err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse form", "details": err.Error()})
					return
				}

				files := form.File["images"]
				if len(files) == 0 {
					c.JSON(http.StatusBadRequest, gin.H{"error": "No images uploaded"})
					return
				}

				// Get file type
				fileType := c.PostForm("type")
				if fileType == "" {
					fileType = "restaurants"
				}

				// Create folder if not exists
				uploadDir := filepath.Join(uploadsDir, fileType)
				if err := os.MkdirAll(uploadDir, 0755); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory", "details": err.Error()})
					return
				}

				var uploadedFiles []gin.H
				serverURL := "https://pedal-delivery-back.onrender.com"
				if cfg.Server.Environment == "production" {
					serverURL = "https://pedal-delivery-back.onrender.com"
				}

				for _, file := range files {
					// Generate unique filename
					ext := filepath.Ext(file.Filename)
					filename := uuid.New().String() + ext
					filePath := filepath.Join(uploadDir, filename)

					// Save the file
					if err := c.SaveUploadedFile(file, filePath); err != nil {
						c.JSON(http.StatusInternalServerError, gin.H{
							"error":    "Failed to save file",
							"details":  err.Error(),
							"uploaded": uploadedFiles,
						})
						return
					}

					fileURL := fmt.Sprintf("%s/uploads/%s/%s", serverURL, fileType, filename)

					uploadedFiles = append(uploadedFiles, gin.H{
						"url":       fileURL,
						"filename":  filename,
						"size":      file.Size,
						"type":      fileType,
						"mime_type": file.Header.Get("Content-Type"),
					})
				}

				c.JSON(http.StatusOK, gin.H{
					"message": "Files uploaded successfully",
					"count":   len(uploadedFiles),
					"files":   uploadedFiles,
				})
			})
		}

		// Restaurant routes (public)
		restaurants := api.Group("/restaurants")
		{
			// Public restaurant endpoints
			restaurants.GET("", restaurantHandler.GetRestaurants)
			restaurants.GET("/nearby", restaurantHandler.GetNearbyRestaurants)
			restaurants.GET("/search", restaurantHandler.SearchRestaurants)
			restaurants.GET("/:id", restaurantHandler.GetRestaurantByID)
			restaurants.GET("/:id/menu", restaurantHandler.GetRestaurantMenu)
		}

		// Protected routes
		protected := api.Group("")
		protected.Use(middleware.AuthMiddleware())
		{
			// User routes
			user := protected.Group("/users")
			{
				user.GET("/me", authHandler.GetProfile)
				user.PUT("/profile", authHandler.UpdateProfile)
				user.POST("/logout", authHandler.Logout)

				// Protected image upload for users
				user.POST("/upload", func(c *gin.Context) {
					// Single file
					file, err := c.FormFile("image")
					if err != nil {
						c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded", "details": err.Error()})
						return
					}

					// Get file type from form or default to "users"
					fileType := "users"

					// Generate unique filename
					ext := filepath.Ext(file.Filename)
					filename := uuid.New().String() + ext

					// Create folder if not exists
					uploadDir := filepath.Join(uploadsDir, fileType)
					if err := os.MkdirAll(uploadDir, 0755); err != nil {
						c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory", "details": err.Error()})
						return
					}

					// Save the file
					filePath := filepath.Join(uploadDir, filename)
					if err := c.SaveUploadedFile(file, filePath); err != nil {
						c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file", "details": err.Error()})
						return
					}

					// Construct the URL
					serverURL := "https://pedal-delivery-back.onrender.com"
					if cfg.Server.Environment == "production" {
						serverURL = "https://pedal-delivery-back.onrender.com"
					}

					fileURL := fmt.Sprintf("%s/uploads/%s/%s", serverURL, fileType, filename)

					c.JSON(http.StatusOK, gin.H{
						"url":       fileURL,
						"filename":  filename,
						"size":      file.Size,
						"type":      fileType,
						"mime_type": file.Header.Get("Content-Type"),
					})
				})
			}

			// Order routes
			orders := protected.Group("/orders")
			{
				orders.POST("", orderHandler.CreateOrder)
				orders.GET("", orderHandler.GetCustomerOrders)
				orders.GET("/:id", orderHandler.GetOrderByID)
				orders.POST("/:id/cancel", orderHandler.CancelOrder)
				orders.POST("/:id/rate", orderHandler.RateOrder)
				orders.PUT("/:id/status", orderHandler.UpdateOrderStatus)
			}

			// Driver routes
			driver := protected.Group("/driver")
			driver.Use(middleware.DriverOnly())
			{
				driver.GET("/orders/available", orderHandler.GetAvailableOrders)
				driver.POST("/orders/:id/accept", orderHandler.AcceptOrder)
			}

			// Protected restaurant routes (admin only)
			restaurantAdmin := protected.Group("/restaurants")
			restaurantAdmin.Use(middleware.AdminOnly())
			{
				// Create new restaurant - admin only
				restaurantAdmin.POST("", restaurantHandler.CreateRestaurant)

				// Update restaurant - admin only
				restaurantAdmin.PUT("/:id", restaurantHandler.UpdateRestaurant)

				// Add more admin-only routes
				restaurantAdmin.DELETE("/:id", restaurantHandler.DeleteRestaurant)
				restaurantAdmin.POST("/:id/menu", restaurantHandler.AddMenuItem)
				restaurantAdmin.PUT("/:id/menu/:itemId", restaurantHandler.UpdateMenuItem)
			}
		}
	}

	// WebSocket routes
	websocket.SetupWebSocketRoutes(router.Group(""), middleware.AuthMiddleware())

	// Swagger documentation
	if cfg.Server.Environment != "production" {
		router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	}

	// Start server
	srv := &http.Server{
		Addr:         ":" + cfg.Server.Port,
		Handler:      router,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
	}

	// Graceful shutdown
	go func() {
		log.Printf("Server starting on port %s in %s mode", cfg.Server.Port, cfg.Server.Environment)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited properly")
}
