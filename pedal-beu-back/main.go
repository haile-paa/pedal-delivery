package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
	"github.com/google/uuid"
	"github.com/haile-paa/pedal-delivery/internal/config"
	"github.com/haile-paa/pedal-delivery/internal/handlers"
	"github.com/haile-paa/pedal-delivery/internal/middleware"
	"github.com/haile-paa/pedal-delivery/internal/repositories"
	"github.com/haile-paa/pedal-delivery/internal/services"
	"github.com/haile-paa/pedal-delivery/internal/websocket"
	"github.com/haile-paa/pedal-delivery/pkg/database"
	"github.com/haile-paa/pedal-delivery/pkg/sms"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

// Cloudinary client instance
var cld *cloudinary.Cloudinary

// Initialize Cloudinary
func initCloudinary() error {
	cloudName := os.Getenv("CLOUDINARY_CLOUD_NAME")
	apiKey := os.Getenv("CLOUDINARY_API_KEY")
	apiSecret := os.Getenv("CLOUDINARY_API_SECRET")

	if cloudName == "" || apiKey == "" || apiSecret == "" {
		log.Println("⚠️  Cloudinary credentials not found. Using local storage fallback.")
		return fmt.Errorf("cloudinary credentials not configured")
	}

	cldInstance, err := cloudinary.NewFromParams(cloudName, apiKey, apiSecret)
	if err != nil {
		log.Printf("⚠️  Failed to initialize Cloudinary: %v", err)
		return err
	}

	cld = cldInstance
	log.Println("✅ Cloudinary initialized successfully")
	return nil
}

// Upload file to Cloudinary
func uploadToCloudinary(file multipart.File, fileType, publicID string) (*uploader.UploadResult, error) {
	if cld == nil {
		return nil, fmt.Errorf("cloudinary not initialized")
	}

	folder := fileType
	if fileType == "menu" {
		folder = "menu_items"
	}

	ctx := context.Background()
	uploadResult, err := cld.Upload.Upload(ctx, file, uploader.UploadParams{
		PublicID:       publicID,
		Folder:         folder,
		Transformation: "q_auto,f_auto",
		ResourceType:   "image",
	})

	return uploadResult, err
}

// Upload file to Cloudinary from path (for backward compatibility)
func uploadFileToCloudinary(filePath, fileType, publicID string) (*uploader.UploadResult, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	return uploadToCloudinary(file, fileType, publicID)
}

// Get image URL - prefers Cloudinary, falls back to local
func getImageURL(cfg *config.Config, fileType, filename string) string {
	if cld != nil {
		folder := fileType
		if fileType == "menu" {
			folder = "menu_items"
		}
		return fmt.Sprintf("https://res.cloudinary.com/%s/image/upload/%s/%s",
			os.Getenv("CLOUDINARY_CLOUD_NAME"), folder, filename)
	}

	serverURL := "https://pedal-delivery-back.onrender.com"
	if cfg.Server.Environment == "development" {
		serverURL = "http://localhost:8080"
	}

	return fmt.Sprintf("%s/uploads/%s/%s", serverURL, fileType, filename)
}

func main() {
	// Load configuration
	cfg := config.Load()

	// Set Gin mode
	if cfg.Server.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	} else {
		gin.SetMode(gin.DebugMode)
	}

	// Initialize Cloudinary
	cloudinaryErr := initCloudinary()
	if cloudinaryErr != nil {
		log.Printf("⚠️  Cloudinary initialization failed: %v", cloudinaryErr)
		log.Println("⚠️  Falling back to local file storage")
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

	// Create uploads directory for local fallback
	uploadsDir := "./uploads"
	if err := os.MkdirAll(uploadsDir, 0755); err != nil {
		log.Printf("Warning: Failed to create uploads directory: %v", err)
	}

	// Create subdirectories for local fallback
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

	// Initialize SMS client
	var smsClient *sms.Client
	if cfg.SMS.APIToken != "" {
		smsClient = sms.NewClient(
			cfg.SMS.APIToken,
			cfg.SMS.From,
			cfg.SMS.Sender,
			cfg.SMS.APIBase,
		)
		log.Println("✅ SMS client initialized (Afromessage)")
	} else {
		log.Println("⚠️ SMS client not configured (missing API token)")
	}

	// Initialize services
	authService := services.NewAuthService(userRepo, adminRepo)
	orderService := services.NewOrderService(orderRepo, restaurantRepo, userRepo)
	restaurantService := services.NewRestaurantService(restaurantRepo)

	// Initialize handlers with SMS client
	authHandler := handlers.NewAuthHandler(authService, smsClient)
	orderHandler := handlers.NewOrderHandler(orderService)
	restaurantHandler := handlers.NewRestaurantHandler(restaurantService)

	// Set repositories for standalone functions
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
			"status":      "healthy",
			"timestamp":   time.Now().Unix(),
			"cloudinary":  cld != nil,
			"sms_enabled": smsClient != nil,
			"environment": cfg.Server.Environment,
		})
	})

	// Serve static files for uploads (only for local fallback)
	router.Static("/uploads", uploadsDir)

	// API v1 routes
	api := router.Group("/api/v1")
	{
		// Authentication routes (public)
		auth := api.Group("/auth")
		{
			// OTP endpoints (now using authHandler methods)
			auth.POST("/send-otp", authHandler.SendOTP)
			auth.POST("/verify-otp", handlers.VerifyOTPOnly)
			auth.POST("/register-driver", authHandler.RegisterDriver)

			// Existing AuthHandler endpoints
			auth.POST("/register", authHandler.Register)
			auth.POST("/login-otp", authHandler.LoginWithOTP)
			auth.POST("/refresh", authHandler.RefreshToken)
			auth.POST("/forgot-password", authHandler.ForgotPassword)
			auth.POST("/reset-password", authHandler.ResetPassword)
			auth.GET("/check-phone", handlers.CheckPhoneExists)
		}

		// Image upload routes with Cloudinary
		upload := api.Group("/upload")
		{
			// Single image upload
			upload.POST("", func(c *gin.Context) {
				file, err := c.FormFile("image")
				if err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded", "details": err.Error()})
					return
				}

				fileType := c.PostForm("type")
				if fileType == "" {
					fileType = "restaurants"
				}

				src, err := file.Open()
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open file", "details": err.Error()})
					return
				}
				defer src.Close()

				ext := filepath.Ext(file.Filename)
				filename := uuid.New().String() + ext

				if cld != nil {
					publicID := filename[:len(filename)-len(ext)]
					uploadResult, err := uploadToCloudinary(src, fileType, publicID)
					if err != nil {
						log.Printf("Cloudinary upload failed: %v", err)
					} else {
						c.JSON(http.StatusOK, gin.H{
							"url":        uploadResult.SecureURL,
							"public_id":  uploadResult.PublicID,
							"asset_id":   uploadResult.AssetID,
							"filename":   filename,
							"size":       file.Size,
							"type":       fileType,
							"mime_type":  file.Header.Get("Content-Type"),
							"cloudinary": true,
						})
						return
					}
				}

				// Fallback to local
				src.Seek(0, 0)

				uploadDir := filepath.Join(uploadsDir, fileType)
				if err := os.MkdirAll(uploadDir, 0755); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory", "details": err.Error()})
					return
				}

				filePath := filepath.Join(uploadDir, filename)
				dst, err := os.Create(filePath)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file", "details": err.Error()})
					return
				}
				defer dst.Close()

				if _, err := io.Copy(dst, src); err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to copy file", "details": err.Error()})
					return
				}

				fileURL := getImageURL(cfg, fileType, filename)

				c.JSON(http.StatusOK, gin.H{
					"url":        fileURL,
					"filename":   filename,
					"size":       file.Size,
					"type":       fileType,
					"mime_type":  file.Header.Get("Content-Type"),
					"cloudinary": false,
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

				fileType := c.PostForm("type")
				if fileType == "" {
					fileType = "restaurants"
				}

				var uploadedFiles []gin.H
				var uploadErrors []string

				for _, file := range files {
					src, err := file.Open()
					if err != nil {
						uploadErrors = append(uploadErrors, fmt.Sprintf("Failed to open %s: %v", file.Filename, err))
						continue
					}

					ext := filepath.Ext(file.Filename)
					filename := uuid.New().String() + ext
					publicID := filename[:len(filename)-len(ext)]

					if cld != nil {
						uploadResult, err := uploadToCloudinary(src, fileType, publicID)
						if err != nil {
							log.Printf("Cloudinary upload failed for %s: %v", filename, err)
						} else {
							uploadedFiles = append(uploadedFiles, gin.H{
								"url":        uploadResult.SecureURL,
								"public_id":  uploadResult.PublicID,
								"filename":   filename,
								"size":       file.Size,
								"type":       fileType,
								"mime_type":  file.Header.Get("Content-Type"),
								"cloudinary": true,
							})
							src.Close()
							continue
						}
					}

					// Fallback to local
					src.Seek(0, 0)

					uploadDir := filepath.Join(uploadsDir, fileType)
					if err := os.MkdirAll(uploadDir, 0755); err != nil {
						uploadErrors = append(uploadErrors, fmt.Sprintf("Failed to create directory for %s: %v", filename, err))
						src.Close()
						continue
					}

					filePath := filepath.Join(uploadDir, filename)
					dst, err := os.Create(filePath)
					if err != nil {
						uploadErrors = append(uploadErrors, fmt.Sprintf("Failed to save %s: %v", filename, err))
						src.Close()
						continue
					}

					if _, err := io.Copy(dst, src); err != nil {
						uploadErrors = append(uploadErrors, fmt.Sprintf("Failed to copy %s: %v", filename, err))
						src.Close()
						dst.Close()
						continue
					}

					src.Close()
					dst.Close()

					fileURL := getImageURL(cfg, fileType, filename)

					uploadedFiles = append(uploadedFiles, gin.H{
						"url":        fileURL,
						"filename":   filename,
						"size":       file.Size,
						"type":       fileType,
						"mime_type":  file.Header.Get("Content-Type"),
						"cloudinary": false,
					})
				}

				response := gin.H{
					"message": "Files uploaded successfully",
					"count":   len(uploadedFiles),
					"files":   uploadedFiles,
				}

				if len(uploadErrors) > 0 {
					response["errors"] = uploadErrors
					response["message"] = fmt.Sprintf("%d files uploaded, %d failed", len(uploadedFiles), len(uploadErrors))
				}

				c.JSON(http.StatusOK, response)
			})

			// Delete image from Cloudinary
			upload.DELETE("", func(c *gin.Context) {
				publicID := c.Query("public_id")
				if publicID == "" {
					c.JSON(http.StatusBadRequest, gin.H{"error": "public_id is required"})
					return
				}

				if cld == nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": "Cloudinary not configured"})
					return
				}

				ctx := context.Background()
				result, err := cld.Upload.Destroy(ctx, uploader.DestroyParams{
					PublicID: publicID,
				})

				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete image", "details": err.Error()})
					return
				}

				c.JSON(http.StatusOK, gin.H{
					"message": result.Result,
					"deleted": true,
				})
			})
		}

		// Restaurant routes (public)
		restaurants := api.Group("/restaurants")
		{
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
					file, err := c.FormFile("image")
					if err != nil {
						c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded", "details": err.Error()})
						return
					}

					fileType := "users"

					src, err := file.Open()
					if err != nil {
						c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open file", "details": err.Error()})
						return
					}
					defer src.Close()

					ext := filepath.Ext(file.Filename)
					filename := uuid.New().String() + ext

					if cld != nil {
						publicID := filename[:len(filename)-len(ext)]
						uploadResult, err := uploadToCloudinary(src, fileType, publicID)
						if err != nil {
							log.Printf("Cloudinary upload failed: %v", err)
						} else {
							c.JSON(http.StatusOK, gin.H{
								"url":        uploadResult.SecureURL,
								"public_id":  uploadResult.PublicID,
								"filename":   filename,
								"size":       file.Size,
								"type":       fileType,
								"mime_type":  file.Header.Get("Content-Type"),
								"cloudinary": true,
							})
							return
						}
					}

					// Fallback to local
					src.Seek(0, 0)

					uploadDir := filepath.Join(uploadsDir, fileType)
					if err := os.MkdirAll(uploadDir, 0755); err != nil {
						c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload directory", "details": err.Error()})
						return
					}

					filePath := filepath.Join(uploadDir, filename)
					dst, err := os.Create(filePath)
					if err != nil {
						c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file", "details": err.Error()})
						return
					}
					defer dst.Close()

					if _, err := io.Copy(dst, src); err != nil {
						c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to copy file", "details": err.Error()})
						return
					}

					fileURL := getImageURL(cfg, fileType, filename)

					c.JSON(http.StatusOK, gin.H{
						"url":        fileURL,
						"filename":   filename,
						"size":       file.Size,
						"type":       fileType,
						"mime_type":  file.Header.Get("Content-Type"),
						"cloudinary": false,
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
				restaurantAdmin.POST("", restaurantHandler.CreateRestaurant)
				restaurantAdmin.PUT("/:id", restaurantHandler.UpdateRestaurant)
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

	go func() {
		log.Printf("Server starting on port %s in %s mode", cfg.Server.Port, cfg.Server.Environment)
		log.Printf("Cloudinary enabled: %v", cld != nil)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

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
