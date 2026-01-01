package repositories

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/haile-paa/pedal-delivery/internal/models"
	"github.com/haile-paa/pedal-delivery/pkg/database"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type OrderRepository interface {
	Create(ctx context.Context, order *models.Order) error
	FindByID(ctx context.Context, id primitive.ObjectID) (*models.Order, error)
	FindByOrderNumber(ctx context.Context, orderNumber string) (*models.Order, error)
	FindByCustomerID(ctx context.Context, customerID primitive.ObjectID, pagination Pagination) ([]models.Order, int64, error)
	FindByDriverID(ctx context.Context, driverID primitive.ObjectID, pagination Pagination) ([]models.Order, int64, error)
	FindByRestaurantID(ctx context.Context, restaurantID primitive.ObjectID, pagination Pagination) ([]models.Order, int64, error)
	FindAvailableOrders(ctx context.Context, location models.GeoLocation, radius float64) ([]models.Order, error)
	UpdateStatus(ctx context.Context, orderID primitive.ObjectID, status models.OrderStatus, actorID primitive.ObjectID, actorType string) error
	AssignDriver(ctx context.Context, orderID, driverID primitive.ObjectID) error
	UpdateTimeline(ctx context.Context, orderID primitive.ObjectID, event models.OrderEvent) error
	AddRating(ctx context.Context, orderID primitive.ObjectID, rating models.OrderRating) error
	UpdatePaymentStatus(ctx context.Context, orderID primitive.ObjectID, status string) error
	CancelOrder(ctx context.Context, orderID primitive.ObjectID, cancellation models.CancellationInfo) error
	FindActiveOrders(ctx context.Context) ([]models.Order, error)
}

type Pagination struct {
	Page    int64
	Limit   int64
	SortBy  string
	SortDir int // 1 for ascending, -1 for descending
}

type orderRepository struct {
	collection *mongo.Collection
}

func NewOrderRepository() OrderRepository {
	collections := database.GetCollections()
	return &orderRepository{
		collection: collections.Orders,
	}
}

func (r *orderRepository) Create(ctx context.Context, order *models.Order) error {
	order.CreatedAt = time.Now()
	order.UpdatedAt = time.Now()

	// Add initial timeline event
	order.Timeline = []models.OrderEvent{{
		Status:    order.Status,
		Timestamp: time.Now(),
		ActorID:   order.CustomerID,
		ActorType: "customer",
		Notes:     "Order placed",
	}}

	// Generate order number
	order.OrderNumber = generateOrderNumber()

	result, err := r.collection.InsertOne(ctx, order)
	if err != nil {
		return err
	}

	order.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

func generateOrderNumber() string {
	timestamp := time.Now().Unix()
	random := primitive.NewObjectID().Hex()[:6]
	return fmt.Sprintf("ORD-%d-%s", timestamp, random)
}

func (r *orderRepository) FindByID(ctx context.Context, id primitive.ObjectID) (*models.Order, error) {
	var order models.Order
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&order)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, errors.New("order not found")
		}
		return nil, err
	}
	return &order, nil
}

func (r *orderRepository) FindByOrderNumber(ctx context.Context, orderNumber string) (*models.Order, error) {
	var order models.Order
	err := r.collection.FindOne(ctx, bson.M{"order_number": orderNumber}).Decode(&order)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, errors.New("order not found")
		}
		return nil, err
	}
	return &order, nil
}

func (r *orderRepository) FindByCustomerID(ctx context.Context, customerID primitive.ObjectID, pagination Pagination) ([]models.Order, int64, error) {
	filter := bson.M{"customer_id": customerID}

	// Count total documents
	total, err := r.collection.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	// Find orders with pagination
	opts := options.Find().
		SetSkip((pagination.Page - 1) * pagination.Limit).
		SetLimit(pagination.Limit).
		SetSort(bson.D{{Key: pagination.SortBy, Value: pagination.SortDir}})

	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var orders []models.Order
	if err = cursor.All(ctx, &orders); err != nil {
		return nil, 0, err
	}

	return orders, total, nil
}

func (r *orderRepository) FindByDriverID(ctx context.Context, driverID primitive.ObjectID, pagination Pagination) ([]models.Order, int64, error) {
	filter := bson.M{"driver_id": driverID}

	total, err := r.collection.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSkip((pagination.Page - 1) * pagination.Limit).
		SetLimit(pagination.Limit).
		SetSort(bson.D{{Key: pagination.SortBy, Value: pagination.SortDir}})

	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var orders []models.Order
	if err = cursor.All(ctx, &orders); err != nil {
		return nil, 0, err
	}

	return orders, total, nil
}

func (r *orderRepository) FindByRestaurantID(ctx context.Context, restaurantID primitive.ObjectID, pagination Pagination) ([]models.Order, int64, error) {
	filter := bson.M{"restaurant_id": restaurantID}

	total, err := r.collection.CountDocuments(ctx, filter)
	if err != nil {
		return nil, 0, err
	}

	opts := options.Find().
		SetSkip((pagination.Page - 1) * pagination.Limit).
		SetLimit(pagination.Limit).
		SetSort(bson.D{{Key: pagination.SortBy, Value: pagination.SortDir}})

	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var orders []models.Order
	if err = cursor.All(ctx, &orders); err != nil {
		return nil, 0, err
	}

	return orders, total, nil
}

func (r *orderRepository) FindAvailableOrders(ctx context.Context, location models.GeoLocation, radius float64) ([]models.Order, error) {
	filter := bson.M{
		"status":    models.OrderAccepted,
		"driver_id": nil,
		"restaurant.location": bson.M{
			"$near": bson.M{
				"$geometry":    location,
				"$maxDistance": radius,
			},
		},
	}

	opts := options.Find().SetLimit(50).SetSort(bson.D{{Key: "created_at", Value: 1}})

	cursor, err := r.collection.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var orders []models.Order
	if err = cursor.All(ctx, &orders); err != nil {
		return nil, err
	}

	return orders, nil
}

func (r *orderRepository) UpdateStatus(ctx context.Context, orderID primitive.ObjectID, status models.OrderStatus, actorID primitive.ObjectID, actorType string) error {
	event := models.OrderEvent{
		Status:    status,
		Timestamp: time.Now(),
		ActorID:   actorID,
		ActorType: actorType,
	}

	update := bson.M{
		"$set": bson.M{
			"status":     status,
			"updated_at": time.Now(),
		},
		"$push": bson.M{
			"timeline": event,
		},
	}

	result, err := r.collection.UpdateOne(ctx, bson.M{"_id": orderID}, update)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return errors.New("order not found")
	}

	return nil
}

func (r *orderRepository) AssignDriver(ctx context.Context, orderID, driverID primitive.ObjectID) error {
	event := models.OrderEvent{
		Status:    models.OrderAccepted,
		Timestamp: time.Now(),
		ActorID:   driverID,
		ActorType: "driver",
		Notes:     "Driver assigned",
	}

	update := bson.M{
		"$set": bson.M{
			"driver_id":  driverID,
			"status":     models.OrderAccepted,
			"updated_at": time.Now(),
		},
		"$push": bson.M{
			"timeline": event,
		},
	}

	filter := bson.M{
		"_id":       orderID,
		"driver_id": nil,
		"status":    models.OrderPending,
	}

	result, err := r.collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return errors.New("order not available or already assigned")
	}

	return nil
}

func (r *orderRepository) UpdateTimeline(ctx context.Context, orderID primitive.ObjectID, event models.OrderEvent) error {
	update := bson.M{
		"$push": bson.M{
			"timeline": event,
		},
		"$set": bson.M{
			"updated_at": time.Now(),
		},
	}

	result, err := r.collection.UpdateOne(ctx, bson.M{"_id": orderID}, update)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return errors.New("order not found")
	}

	return nil
}

func (r *orderRepository) AddRating(ctx context.Context, orderID primitive.ObjectID, rating models.OrderRating) error {
	rating.RatedAt = time.Now()

	update := bson.M{
		"$set": bson.M{
			"rating":     rating,
			"updated_at": time.Now(),
		},
	}

	filter := bson.M{
		"_id":    orderID,
		"status": models.OrderDelivered,
		"rating": nil,
	}

	result, err := r.collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return errors.New("order not found or already rated")
	}

	return nil
}

func (r *orderRepository) UpdatePaymentStatus(ctx context.Context, orderID primitive.ObjectID, status string) error {
	update := bson.M{
		"$set": bson.M{
			"payment_status": status,
			"updated_at":     time.Now(),
		},
	}

	result, err := r.collection.UpdateOne(ctx, bson.M{"_id": orderID}, update)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return errors.New("order not found")
	}

	return nil
}

func (r *orderRepository) CancelOrder(ctx context.Context, orderID primitive.ObjectID, cancellation models.CancellationInfo) error {
	cancellation.Timestamp = time.Now()

	update := bson.M{
		"$set": bson.M{
			"status":       models.OrderCancelled,
			"cancellation": cancellation,
			"updated_at":   time.Now(),
		},
		"$push": bson.M{
			"timeline": models.OrderEvent{
				Status:    models.OrderCancelled,
				Timestamp: time.Now(),
				ActorID:   cancellation.CancelledBy,
				ActorType: cancellation.Role,
				Notes:     "Order cancelled: " + cancellation.Reason,
			},
		},
	}

	filter := bson.M{
		"_id": orderID,
		"status": bson.M{
			"$in": []models.OrderStatus{models.OrderPending, models.OrderAccepted, models.OrderPreparing},
		},
	}

	result, err := r.collection.UpdateOne(ctx, filter, update)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return errors.New("order cannot be cancelled at this stage")
	}

	return nil
}

func (r *orderRepository) FindActiveOrders(ctx context.Context) ([]models.Order, error) {
	filter := bson.M{
		"status": bson.M{
			"$in": []models.OrderStatus{
				models.OrderAccepted,
				models.OrderPreparing,
				models.OrderReady,
				models.OrderPickedUp,
				models.OrderOnTheWay,
			},
		},
	}

	cursor, err := r.collection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var orders []models.Order
	if err = cursor.All(ctx, &orders); err != nil {
		return nil, err
	}

	return orders, nil
}
