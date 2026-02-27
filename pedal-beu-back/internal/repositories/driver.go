package repositories

import (
	"context"

	"github.com/haile-paa/pedal-delivery/internal/models"
	"github.com/haile-paa/pedal-delivery/pkg/database"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

type DriverRepository interface {
	CountActive(ctx context.Context) (int64, error)
}

type driverRepository struct {
	collection *mongo.Collection
}

func NewDriverRepository() DriverRepository {
	collections := database.GetCollections()
	return &driverRepository{
		collection: collections.Drivers, // assuming you have a "drivers" collection
	}
}

func (r *driverRepository) CountActive(ctx context.Context) (int64, error) {
	filter := bson.M{
		"is_online": true,
		"status":    bson.M{"$in": []models.DriverStatus{models.DriverApproved, "on_break"}}, // adjust based on your status enum
	}
	return r.collection.CountDocuments(ctx, filter)
}
