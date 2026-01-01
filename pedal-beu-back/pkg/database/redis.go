package database

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/haile-paa/pedal-delivery/internal/config"

	"github.com/redis/go-redis/v9"
)

var (
	redisClient *redis.Client
)

func ConnectRedis() error {
	cfg := config.Get()

	// ✅ Completely disable Redis if no URL provided
	if cfg.Redis.URL == "" {
		log.Println("⚠️ Redis disabled — skipping connection")
		return nil
	}

	opt, err := redis.ParseURL(cfg.Redis.URL)
	if err != nil {
		opt = &redis.Options{
			Addr:     "127.0.0.1:6379",
			Password: cfg.Redis.Password,
			DB:       cfg.Redis.DB,
		}
	}

	redisClient = redis.NewClient(opt)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if _, err := redisClient.Ping(ctx).Result(); err != nil {
		return fmt.Errorf("failed to connect to Redis: %v", err)
	}

	log.Println("✅ Redis connected successfully")
	return nil
}

func GetRedis() *redis.Client {
	return redisClient
}

func CloseRedis() {
	if redisClient != nil {
		_ = redisClient.Close()
		log.Println("Redis disconnected")
	}
}
