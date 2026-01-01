package database

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/haile-paa/pedal-delivery/internal/config"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.mongodb.org/mongo-driver/mongo/readpref"
)

var (
	client      *mongo.Client
	database    *mongo.Database
	collections = struct {
		Users         *mongo.Collection
		Admins        *mongo.Collection
		Drivers       *mongo.Collection
		Restaurants   *mongo.Collection
		Orders        *mongo.Collection
		MenuItems     *mongo.Collection
		Documents     *mongo.Collection
		Notifications *mongo.Collection
		ChatMessages  *mongo.Collection
	}{}
)

func Connect() error {
	cfg := config.Get()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	clientOptions := options.Client().
		ApplyURI(cfg.Database.URI).
		// SetAuth(options.Credential{
		// 	Username: "haileyesuseyasu_db_user",
		// 	Password: "haile85",
		// }).
		SetMaxPoolSize(100).
		SetMinPoolSize(10).
		SetMaxConnIdleTime(30 * time.Minute)

	var err error
	client, err = mongo.Connect(ctx, clientOptions)
	if err != nil {
		return fmt.Errorf("failed to connect to MongoDB: %v", err)
	}

	// Ping database
	if err := client.Ping(ctx, readpref.Primary()); err != nil {
		return fmt.Errorf("failed to ping MongoDB: %v", err)
	}

	database = client.Database(cfg.Database.Database)
	initializeCollections()
	createIndexes(ctx)

	log.Println("✅ MongoDB connected successfully")
	return nil
}

func initializeCollections() {
	collections.Users = database.Collection("users")
	collections.Admins = database.Collection("admins")
	collections.Drivers = database.Collection("drivers")
	collections.Restaurants = database.Collection("restaurants")
	collections.Orders = database.Collection("orders")
	collections.MenuItems = database.Collection("menu_items")
	collections.Documents = database.Collection("documents")
	collections.Notifications = database.Collection("notifications")
	collections.ChatMessages = database.Collection("chat_messages")
}

func createIndexes(ctx context.Context) {
	// Users collection indexes
	collections.Users.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    map[string]interface{}{"phone": 1},
		Options: options.Index().SetUnique(true),
	})

	collections.Users.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: map[string]interface{}{"location": "2dsphere"},
	})
	// Admins collection indexes
	collections.Admins.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    map[string]interface{}{"phone": 1},
		Options: options.Index().SetUnique(true),
	})

	collections.Admins.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    map[string]interface{}{"email": 1},
		Options: options.Index().SetUnique(true).SetSparse(true),
	})

	// Drivers collection indexes
	collections.Drivers.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    map[string]interface{}{"user_id": 1},
		Options: options.Index().SetUnique(true),
	})

	collections.Drivers.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: map[string]interface{}{"location": "2dsphere"},
	})

	collections.Drivers.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: map[string]interface{}{"is_online": 1},
	})

	collections.Drivers.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: map[string]interface{}{"status": 1},
	})

	// Restaurants collection indexes
	collections.Restaurants.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: map[string]interface{}{"location": "2dsphere"},
	})

	collections.Restaurants.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: map[string]interface{}{"is_active": 1},
	})

	collections.Restaurants.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: map[string]interface{}{"owner_id": 1},
	})

	// Orders collection indexes
	collections.Orders.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: map[string]interface{}{"customer_id": 1},
	})

	collections.Orders.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: map[string]interface{}{"driver_id": 1},
	})

	collections.Orders.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: map[string]interface{}{"restaurant_id": 1},
	})

	collections.Orders.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: map[string]interface{}{"status": 1},
	})

	collections.Orders.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: map[string]interface{}{"created_at": -1},
	})

	collections.Orders.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: map[string]interface{}{
			"status":      1,
			"created_at":  -1,
			"customer_id": 1,
		},
	})
}

func GetClient() *mongo.Client {
	return client
}

func GetDB() *mongo.Database {
	return database
}

func GetCollections() struct {
	Users         *mongo.Collection
	Admins        *mongo.Collection
	Drivers       *mongo.Collection
	Restaurants   *mongo.Collection
	Orders        *mongo.Collection
	MenuItems     *mongo.Collection
	Documents     *mongo.Collection
	Notifications *mongo.Collection
	ChatMessages  *mongo.Collection
} {
	return collections
}

func Disconnect() {
	if client != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = client.Disconnect(ctx)
		log.Println("MongoDB disconnected")
	}
}
