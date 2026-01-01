package repositories

import (
	"context"
	"errors"
	"log"
	"time"

	"github.com/haile-paa/pedal-delivery/internal/models"
	"github.com/haile-paa/pedal-delivery/pkg/database"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Define Pagination struct in the same package
// type Pagination struct {
//     Page    int64
//     Limit   int64
//     SortBy  string
//     SortDir int // 1 for ascending, -1 for descending
// }

type RestaurantRepository interface {
	Create(ctx context.Context, restaurant *models.Restaurant) error
	FindByID(ctx context.Context, id primitive.ObjectID) (*models.Restaurant, error)
	FindByOwnerID(ctx context.Context, ownerID primitive.ObjectID) ([]models.Restaurant, error)
	FindNearby(ctx context.Context, location models.GeoLocation, radius float64, pagination Pagination) ([]models.Restaurant, int64, error)
	FindAll(ctx context.Context, pagination Pagination) ([]models.Restaurant, int64, error)
	Update(ctx context.Context, id primitive.ObjectID, update interface{}) error
	Delete(ctx context.Context, id primitive.ObjectID) error
	UpdateStatus(ctx context.Context, id primitive.ObjectID, isActive bool) error
	AddMenuItem(ctx context.Context, restaurantID primitive.ObjectID, item *models.MenuItem) error
	UpdateMenuItem(ctx context.Context, restaurantID, itemID primitive.ObjectID, update interface{}) error
	DeleteMenuItem(ctx context.Context, restaurantID, itemID primitive.ObjectID) error
	GetMenuItems(ctx context.Context, restaurantID primitive.ObjectID) ([]models.MenuItem, error)
	Search(ctx context.Context, query string, location models.GeoLocation, radius float64) ([]models.Restaurant, error)
}

type restaurantRepository struct {
	collection *mongo.Collection
}

func NewRestaurantRepository() RestaurantRepository {
	collections := database.GetCollections()
	return &restaurantRepository{
		collection: collections.Restaurants,
	}
}

func (r *restaurantRepository) Create(ctx context.Context, restaurant *models.Restaurant) error {
	restaurant.CreatedAt = time.Now()
	restaurant.UpdatedAt = time.Now()
	restaurant.IsVerified = false
	restaurant.IsActive = true
	restaurant.Rating = 0
	restaurant.TotalReviews = 0

	// Set location type
	restaurant.Location.Type = "Point"

	result, err := r.collection.InsertOne(ctx, restaurant)
	if err != nil {
		return err
	}

	restaurant.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

func (r *restaurantRepository) FindByID(ctx context.Context, id primitive.ObjectID) (*models.Restaurant, error) {
	var restaurant models.Restaurant
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&restaurant)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, errors.New("restaurant not found")
		}
		return nil, err
	}
	return &restaurant, nil
}

func (r *restaurantRepository) FindByOwnerID(ctx context.Context, ownerID primitive.ObjectID) ([]models.Restaurant, error) {
	filter := bson.M{"owner_id": ownerID}
	opts := options.Find().SetSort(bson.D{{Key: "created_at", Value: -1}})

	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var restaurants []models.Restaurant
	if err = cursor.All(ctx, &restaurants); err != nil {
		return nil, err
	}

	return restaurants, nil
}

func (r *restaurantRepository) FindAll(ctx context.Context, pagination Pagination) ([]models.Restaurant, int64, error) {
	log.Printf("📊 Repository: FindAll called, page=%d, limit=%d", pagination.Page, pagination.Limit)

	// Create filter - only active and verified restaurants
	filter := bson.M{
		"is_active":   true,
		"is_verified": true,
	}

	// Get total count
	total, err := r.collection.CountDocuments(ctx, filter)
	if err != nil {
		log.Printf("❌ Error counting restaurants: %v", err)
		return []models.Restaurant{}, 0, err
	}

	log.Printf("📊 Total active restaurants in DB: %d", total)

	// If no restaurants, return empty slice
	if total == 0 {
		log.Printf("⚠️ No restaurants found with is_active=true and is_verified=true")
		return []models.Restaurant{}, 0, nil
	}

	// Calculate skip
	skip := (pagination.Page - 1) * pagination.Limit

	// Create sort options
	sortDir := 1 // ascending
	if pagination.SortDir < 0 {
		sortDir = -1 // descending
	}

	// Find restaurants
	cursor, err := r.collection.Find(ctx, filter, options.Find().
		SetSort(bson.D{{Key: pagination.SortBy, Value: sortDir}}).
		SetSkip(skip).
		SetLimit(pagination.Limit))
	if err != nil {
		log.Printf("❌ Error finding restaurants: %v", err)
		return []models.Restaurant{}, 0, err
	}
	defer cursor.Close(ctx)

	// Decode results
	var restaurants []models.Restaurant
	if err := cursor.All(ctx, &restaurants); err != nil {
		log.Printf("❌ Error decoding restaurants: %v", err)
		return []models.Restaurant{}, 0, err
	}

	log.Printf("✅ Found %d restaurants", len(restaurants))
	return restaurants, total, nil
}

func (r *restaurantRepository) FindNearby(ctx context.Context, location models.GeoLocation, radius float64, pagination Pagination) ([]models.Restaurant, int64, error) {
	log.Printf("📍 Repository: FindNearby called, location=%v, radius=%.0f", location, radius)

	// Create geospatial query
	filter := bson.M{
		"location": bson.M{
			"$nearSphere": bson.M{
				"$geometry":    location,
				"$maxDistance": radius,
			},
		},
		"is_active":   true,
		"is_verified": true,
	}

	// Get total count
	total, err := r.collection.CountDocuments(ctx, filter)
	if err != nil {
		log.Printf("❌ Error counting nearby restaurants: %v", err)
		return []models.Restaurant{}, 0, err
	}

	log.Printf("📍 Total nearby restaurants: %d", total)

	// If no restaurants, return empty slice
	if total == 0 {
		log.Printf("⚠️ No restaurants found within %.0f meters", radius)
		return []models.Restaurant{}, 0, nil
	}

	// Calculate skip
	skip := (pagination.Page - 1) * pagination.Limit

	// Find restaurants - $nearSphere already sorts by distance, so we don't need additional sort
	cursor, err := r.collection.Find(ctx, filter, options.Find().
		SetSkip(skip).
		SetLimit(pagination.Limit))
	if err != nil {
		log.Printf("❌ Error finding nearby restaurants: %v", err)
		return []models.Restaurant{}, 0, err
	}
	defer cursor.Close(ctx)

	// Decode results
	var restaurants []models.Restaurant
	if err := cursor.All(ctx, &restaurants); err != nil {
		log.Printf("❌ Error decoding nearby restaurants: %v", err)
		return []models.Restaurant{}, 0, err
	}

	log.Printf("✅ Found %d nearby restaurants", len(restaurants))
	return restaurants, total, nil
}

func (r *restaurantRepository) Update(ctx context.Context, id primitive.ObjectID, update interface{}) error {
	updateDoc := bson.M{
		"$set": bson.M{
			"updated_at": time.Now(),
		},
	}

	if updateMap, ok := update.(bson.M); ok {
		for k, v := range updateMap {
			updateDoc["$set"].(bson.M)[k] = v
		}
	}

	result, err := r.collection.UpdateOne(ctx, bson.M{"_id": id}, updateDoc)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return errors.New("restaurant not found")
	}

	return nil
}

func (r *restaurantRepository) Delete(ctx context.Context, id primitive.ObjectID) error {
	result, err := r.collection.DeleteOne(ctx, bson.M{"_id": id})
	if err != nil {
		return err
	}
	if result.DeletedCount == 0 {
		return errors.New("restaurant not found")
	}
	return nil
}

func (r *restaurantRepository) UpdateStatus(ctx context.Context, id primitive.ObjectID, isActive bool) error {
	update := bson.M{
		"$set": bson.M{
			"is_active":  isActive,
			"updated_at": time.Now(),
		},
	}

	result, err := r.collection.UpdateOne(ctx, bson.M{"_id": id}, update)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return errors.New("restaurant not found")
	}

	return nil
}

func (r *restaurantRepository) AddMenuItem(ctx context.Context, restaurantID primitive.ObjectID, item *models.MenuItem) error {
	item.ID = primitive.NewObjectID()
	item.CreatedAt = time.Now()
	item.UpdatedAt = time.Now()

	update := bson.M{
		"$push": bson.M{
			"menu": item,
		},
		"$set": bson.M{
			"updated_at": time.Now(),
		},
	}

	result, err := r.collection.UpdateOne(ctx, bson.M{"_id": restaurantID}, update)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return errors.New("restaurant not found")
	}

	return nil
}

func (r *restaurantRepository) UpdateMenuItem(ctx context.Context, restaurantID, itemID primitive.ObjectID, update interface{}) error {
	updateFields := bson.M{}
	if updateMap, ok := update.(bson.M); ok {
		for k, v := range updateMap {
			updateFields["menu.$."+k] = v
		}
	}

	updateFields["menu.$.updated_at"] = time.Now()
	updateFields["updated_at"] = time.Now()

	updateDoc := bson.M{
		"$set": updateFields,
	}

	filter := bson.M{
		"_id":      restaurantID,
		"menu._id": itemID,
	}

	result, err := r.collection.UpdateOne(ctx, filter, updateDoc)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return errors.New("menu item not found")
	}

	return nil
}

func (r *restaurantRepository) DeleteMenuItem(ctx context.Context, restaurantID, itemID primitive.ObjectID) error {
	update := bson.M{
		"$pull": bson.M{
			"menu": bson.M{"_id": itemID},
		},
		"$set": bson.M{
			"updated_at": time.Now(),
		},
	}

	result, err := r.collection.UpdateOne(ctx, bson.M{"_id": restaurantID}, update)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return errors.New("restaurant not found")
	}

	return nil
}

func (r *restaurantRepository) GetMenuItems(ctx context.Context, restaurantID primitive.ObjectID) ([]models.MenuItem, error) {
	var restaurant models.Restaurant
	projection := bson.M{"menu": 1}

	err := r.collection.FindOne(ctx, bson.M{"_id": restaurantID}, options.FindOne().SetProjection(projection)).Decode(&restaurant)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, errors.New("restaurant not found")
		}
		return nil, err
	}

	return restaurant.Menu, nil
}

func (r *restaurantRepository) Search(ctx context.Context, query string, location models.GeoLocation, radius float64) ([]models.Restaurant, error) {
	filter := bson.M{
		"$and": []bson.M{
			{
				"$or": []bson.M{
					{"name": bson.M{"$regex": query, "$options": "i"}},
					{"description": bson.M{"$regex": query, "$options": "i"}},
					{"cuisine_type": bson.M{"$in": []string{query}}},
				},
			},
			{
				"is_active":   true,
				"is_verified": true,
			},
		},
	}

	if location.Type == "Point" && len(location.Coordinates) == 2 {
		filter["location"] = bson.M{
			"$near": bson.M{
				"$geometry":    location,
				"$maxDistance": radius,
			},
		}
	}

	opts := options.Find().SetLimit(50).SetSort(bson.D{{Key: "rating", Value: -1}})

	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var restaurants []models.Restaurant
	if err = cursor.All(ctx, &restaurants); err != nil {
		return nil, err
	}

	return restaurants, nil
}
