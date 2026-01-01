package repositories

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/haile-paa/pedal-delivery/internal/models"
	"github.com/haile-paa/pedal-delivery/pkg/database"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type AdminRepository interface {
	Create(ctx context.Context, admin *models.Admin) error
	FindByID(ctx context.Context, id primitive.ObjectID) (*models.Admin, error)
	FindByPhone(ctx context.Context, phone string) (*models.Admin, error)
	FindByEmail(ctx context.Context, email string) (*models.Admin, error)
	Update(ctx context.Context, id primitive.ObjectID, update interface{}) error
	VerifyPhone(ctx context.Context, phone string) error
	UpdateLastLogin(ctx context.Context, id primitive.ObjectID) error
}

type adminRepository struct {
	collection *mongo.Collection
}

func NewAdminRepository() AdminRepository {
	collections := database.GetCollections()
	return &adminRepository{
		collection: collections.Admins, // Make sure Admins collection exists in database package
	}
}

func (r *adminRepository) Create(ctx context.Context, admin *models.Admin) error {
	admin.CreatedAt = time.Now()
	admin.UpdatedAt = time.Now()

	result, err := r.collection.InsertOne(ctx, admin)
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return errors.New("phone number already registered")
		}
		return err
	}

	admin.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

func (r *adminRepository) FindByID(ctx context.Context, id primitive.ObjectID) (*models.Admin, error) {
	var admin models.Admin
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&admin)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, errors.New("admin not found")
		}
		return nil, err
	}
	return &admin, nil
}

func (r *adminRepository) FindByPhone(ctx context.Context, phone string) (*models.Admin, error) {
	var admin models.Admin

	// Try the exact phone first
	err := r.collection.FindOne(ctx, bson.M{"phone": phone}).Decode(&admin)
	if err == nil {
		return &admin, nil
	}

	// If not found, try to normalize and search with different formats
	if strings.HasPrefix(phone, "+251") && len(phone) == 13 {
		// Format: +251XXXXXXXXX -> 0XXXXXXXXX
		withoutPlus := phone[4:] // Remove +251
		withZero := "0" + withoutPlus

		// Try with 0 prefix
		err = r.collection.FindOne(ctx, bson.M{"phone": withZero}).Decode(&admin)
		if err == nil {
			return &admin, nil
		}

		// Try without prefix
		err = r.collection.FindOne(ctx, bson.M{"phone": withoutPlus}).Decode(&admin)
		if err == nil {
			return &admin, nil
		}
	}

	// If starts with 0 and is 10 digits, try with +251
	if strings.HasPrefix(phone, "0") && len(phone) == 10 {
		withPlus := "+251" + phone[1:]
		err = r.collection.FindOne(ctx, bson.M{"phone": withPlus}).Decode(&admin)
		if err == nil {
			return &admin, nil
		}
	}

	// If starts with 9 and is 9 digits, try with +251
	if strings.HasPrefix(phone, "9") && len(phone) == 9 {
		withPlus := "+251" + phone
		err = r.collection.FindOne(ctx, bson.M{"phone": withPlus}).Decode(&admin)
		if err == nil {
			return &admin, nil
		}

		// Try with 0 prefix
		withZero := "0" + phone
		err = r.collection.FindOne(ctx, bson.M{"phone": withZero}).Decode(&admin)
		if err == nil {
			return &admin, nil
		}
	}

	return nil, errors.New("admin not found")
}

func (r *adminRepository) FindByEmail(ctx context.Context, email string) (*models.Admin, error) {
	var admin models.Admin
	err := r.collection.FindOne(ctx, bson.M{"email": email}).Decode(&admin)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, errors.New("admin not found")
		}
		return nil, err
	}
	return &admin, nil
}

func (r *adminRepository) Update(ctx context.Context, id primitive.ObjectID, update interface{}) error {
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
		return errors.New("admin not found")
	}

	return nil
}

func (r *adminRepository) VerifyPhone(ctx context.Context, phone string) error {
	update := bson.M{
		"$set": bson.M{
			"is_verified": true,
			"updated_at":  time.Now(),
		},
	}

	result, err := r.collection.UpdateOne(ctx, bson.M{"phone": phone}, update)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return errors.New("admin not found")
	}

	return nil
}

func (r *adminRepository) UpdateLastLogin(ctx context.Context, id primitive.ObjectID) error {
	now := time.Now()
	update := bson.M{
		"$set": bson.M{
			"last_login_at": now,
			"updated_at":    now,
		},
	}

	result, err := r.collection.UpdateOne(ctx, bson.M{"_id": id}, update)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return errors.New("admin not found")
	}

	return nil
}
