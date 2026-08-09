package middleware

import (
	"github.com/haile-paa/pedal-delivery/internal/config"

	"github.com/gin-gonic/gin"
)

func CORSMiddleware() gin.HandlerFunc {
	cfg := config.Get()

	return func(c *gin.Context) {
		if !cfg.Server.EnableCORS {
			c.Next()
			return
		}

		// NOTE: "Access-Control-Allow-Origin: *" combined with
		// "Access-Control-Allow-Credentials: true" is invalid per the CORS
		// spec — browsers reject that combination outright for any
		// credentialed request. Echoing back the actual request Origin
		// (when present) keeps this permissive like before, while staying
		// spec-compliant so browsers don't silently block the response.
		origin := c.Request.Header.Get("Origin")
		if origin != "" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Vary", "Origin")
		} else {
			c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		}
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}