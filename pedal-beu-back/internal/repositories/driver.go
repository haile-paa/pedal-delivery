package repositories

import (
	"context"
	"time"

	"github.com/haile-paa/pedal-delivery/internal/models"
	"github.com/haile-paa/pedal-delivery/pkg/database"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type DriverRepository interface {
	CountActive(ctx context.Context) (int64, error)
	FindAll(ctx context.Context) ([]*models.Driver, error)
	FindByID(ctx context.Context, id primitive.ObjectID) (*models.Driver, error)
	FindByUserID(ctx context.Context, userID primitive.ObjectID) (*models.Driver, error)
	Create(ctx context.Context, driver *models.Driver) (*models.Driver, error)
	UpdateStatus(ctx context.Context, id primitive.ObjectID, status string) error
}

type driverRepository struct {
	collection *mongo.Collection
}

func NewDriverRepository() DriverRepository {
	collections := database.GetCollections()
	return &driverRepository{
		collection: collections.Drivers,
	}
}

func (r *driverRepository) CountActive(ctx context.Context) (int64, error) {
	filter := bson.M{
		"is_online": true,
		"status":    bson.M{"$in": []models.DriverStatus{models.DriverApproved}},
	}
	return r.collection.CountDocuments(ctx, filter)
}

func (r *driverRepository) FindAll(ctx context.Context) ([]*models.Driver, error) {
	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}})
	cursor, err := r.collection.Find(ctx, bson.M{}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var drivers []*models.Driver
	if err := cursor.All(ctx, &drivers); err != nil {
		return nil, err
	}
	return drivers, nil
}

func (r *driverRepository) FindByID(ctx context.Context, id primitive.ObjectID) (*models.Driver, error) {
	var driver models.Driver
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&driver)
	if err != nil {
		return nil, err
	}
	return &driver, nil
}

func (r *driverRepository) FindByUserID(ctx context.Context, userID primitive.ObjectID) (*models.Driver, error) {
	var driver models.Driver
	err := r.collection.FindOne(ctx, bson.M{"user_id": userID}).Decode(&driver)
	if err != nil {
		return nil, err
	}
	return &driver, nil
}

func (r *driverRepository) Create(ctx context.Context, driver *models.Driver) (*models.Driver, error) {
	driver.ID = primitive.NewObjectID()
	now := time.Now()
	driver.CreatedAt = now
	driver.UpdatedAt = now

	_, err := r.collection.InsertOne(ctx, driver)
	if err != nil {
		return nil, err
	}
	return driver, nil
}

func (r *driverRepository) UpdateStatus(ctx context.Context, id primitive.ObjectID, status string) error {
	_, err := r.collection.UpdateOne(
		ctx,
		bson.M{"_id": id},
		bson.M{"$set": bson.M{
			"status":     status,
			"updated_at": time.Now(),
		}},
	)
	return err
}
