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
	UpdateOnlineStatus(ctx context.Context, userID primitive.ObjectID, isOnline bool) error
	UpdateLocation(ctx context.Context, userID primitive.ObjectID, lng, lat float64) error
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

// Create inserts a new driver document.
// The location field is intentionally omitted when coordinates are empty so
// MongoDB's 2dsphere index does not reject the document with an invalid GeoJSON error.
func (r *driverRepository) Create(ctx context.Context, driver *models.Driver) (*models.Driver, error) {
	driver.ID = primitive.NewObjectID()
	now := time.Now()
	driver.CreatedAt = now
	driver.UpdatedAt = now

	doc := bson.D{
		{Key: "_id", Value: driver.ID},
		{Key: "user_id", Value: driver.UserID},
		{Key: "status", Value: driver.Status},
		{Key: "documents", Value: driver.Documents},
		{Key: "vehicle", Value: driver.Vehicle},
		{Key: "is_online", Value: driver.IsOnline},
		{Key: "rating", Value: driver.Rating},
		{Key: "total_trips", Value: driver.TotalTrips},
		{Key: "earnings", Value: driver.Earnings},
		{Key: "is_active", Value: driver.IsActive},
		{Key: "created_at", Value: driver.CreatedAt},
		{Key: "updated_at", Value: driver.UpdatedAt},
	}

	// Only include location when we have valid GeoJSON coordinates
	if len(driver.Location.Coordinates) == 2 &&
		(driver.Location.Coordinates[0] != 0 || driver.Location.Coordinates[1] != 0) {
		doc = append(doc, bson.E{Key: "location", Value: driver.Location})
	}

	_, err := r.collection.InsertOne(ctx, doc)
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

// UpdateOnlineStatus sets is_online for the driver whose user_id matches.
// Called from the WebSocket handler when the driver toggles online/offline.
func (r *driverRepository) UpdateOnlineStatus(ctx context.Context, userID primitive.ObjectID, isOnline bool) error {
	_, err := r.collection.UpdateOne(
		ctx,
		bson.M{"user_id": userID},
		bson.M{"$set": bson.M{
			"is_online":  isOnline,
			"updated_at": time.Now(),
		}},
	)
	return err
}

// UpdateLocation saves the driver's current GPS position.
// Uses $set with a valid GeoJSON Point so the 2dsphere index is satisfied.
func (r *driverRepository) UpdateLocation(ctx context.Context, userID primitive.ObjectID, lng, lat float64) error {
	_, err := r.collection.UpdateOne(
		ctx,
		bson.M{"user_id": userID},
		bson.M{"$set": bson.M{
			"location": bson.M{
				"type":        "Point",
				"coordinates": []float64{lng, lat},
			},
			"updated_at": time.Now(),
		}},
	)
	return err
}
