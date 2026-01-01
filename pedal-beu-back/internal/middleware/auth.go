package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/haile-paa/pedal-delivery/pkg/auth"

	"github.com/gin-gonic/gin"
)

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == authHeader {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Bearer token required"})
			c.Abort()
			return
		}

		claims, err := auth.ValidateToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		c.Set("userID", claims.UserID)
		c.Set("userRole", claims.Role)
		c.Set("userPhone", claims.Phone)

		c.Next()
	}
}

func RoleMiddleware(allowedRoles []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get("userRole")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User role not found"})
			c.Abort()
			return
		}

		roleStr := fmt.Sprintf("%v", userRole)

		for _, allowed := range allowedRoles {
			if allowed == "*" || allowed == roleStr {
				c.Next()
				return
			}
		}

		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		c.Abort()
	}
}

func AdminOnly() gin.HandlerFunc {
	return RoleMiddleware([]string{"admin"})
}

func DriverOnly() gin.HandlerFunc {
	return RoleMiddleware([]string{"driver"})
}

func CustomerOnly() gin.HandlerFunc {
	return RoleMiddleware([]string{"customer"})
}

func CustomerOrAdmin() gin.HandlerFunc {
	return RoleMiddleware([]string{"customer", "admin"})
}

func DriverOrAdmin() gin.HandlerFunc {
	return RoleMiddleware([]string{"driver", "admin"})
}
