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
	"go.mongodb.org/mongo-driver/mongo/options"
)

type UserRepository interface {
	Create(ctx context.Context, user *models.User) error
	FindByID(ctx context.Context, id primitive.ObjectID) (*models.User, error)
	FindByPhone(ctx context.Context, phone string) (*models.User, error)
	FindByEmail(ctx context.Context, email string) (*models.User, error)
	Update(ctx context.Context, id primitive.ObjectID, update interface{}) error
	UpdateOTP(ctx context.Context, phone, otpCode string) error
	VerifyPhone(ctx context.Context, phone string) error
	AddAddress(ctx context.Context, userID primitive.ObjectID, address *models.Address) error
	UpdateAddress(ctx context.Context, userID, addressID primitive.ObjectID, update interface{}) error
	DeleteAddress(ctx context.Context, userID, addressID primitive.ObjectID) error
	GetAddresses(ctx context.Context, userID primitive.ObjectID) ([]models.Address, error)
	UpdateFCMToken(ctx context.Context, userID primitive.ObjectID, token string) error
	UpdateLastLogin(ctx context.Context, userID primitive.ObjectID) error
}

type userRepository struct {
	collection *mongo.Collection
}

func NewUserRepository() UserRepository {
	collections := database.GetCollections()
	return &userRepository{
		collection: collections.Users,
	}
}

func (r *userRepository) Create(ctx context.Context, user *models.User) error {
	user.CreatedAt = time.Now()
	user.UpdatedAt = time.Now()

	result, err := r.collection.InsertOne(ctx, user)
	if err != nil {
		if mongo.IsDuplicateKeyError(err) {
			return errors.New("phone number already registered")
		}
		return err
	}

	user.ID = result.InsertedID.(primitive.ObjectID)
	return nil
}

func (r *userRepository) FindByID(ctx context.Context, id primitive.ObjectID) (*models.User, error) {
	var user models.User
	err := r.collection.FindOne(ctx, bson.M{"_id": id}).Decode(&user)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, errors.New("user not found")
		}
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) FindByPhone(ctx context.Context, phone string) (*models.User, error) {
	var user models.User

	// Try the exact phone first
	err := r.collection.FindOne(ctx, bson.M{"phone": phone}).Decode(&user)
	if err == nil {
		return &user, nil
	}

	// If not found, try to normalize and search with different formats
	// Remove +251 prefix and try with 0 prefix
	if strings.HasPrefix(phone, "+251") && len(phone) == 13 {
		// Format: +251XXXXXXXXX -> 0XXXXXXXXX
		withoutPlus := phone[4:] // Remove +251
		withZero := "0" + withoutPlus

		// Try with 0 prefix
		err = r.collection.FindOne(ctx, bson.M{"phone": withZero}).Decode(&user)
		if err == nil {
			return &user, nil
		}

		// Try without prefix (just the 9 digits)
		err = r.collection.FindOne(ctx, bson.M{"phone": withoutPlus}).Decode(&user)
		if err == nil {
			return &user, nil
		}
	}

	// If starts with 0 and is 10 digits, try with +251
	if strings.HasPrefix(phone, "0") && len(phone) == 10 {
		withPlus := "+251" + phone[1:]
		err = r.collection.FindOne(ctx, bson.M{"phone": withPlus}).Decode(&user)
		if err == nil {
			return &user, nil
		}
	}

	// If starts with 9 and is 9 digits, try with +251
	if strings.HasPrefix(phone, "9") && len(phone) == 9 {
		withPlus := "+251" + phone
		err = r.collection.FindOne(ctx, bson.M{"phone": withPlus}).Decode(&user)
		if err == nil {
			return &user, nil
		}

		// Try with 0 prefix
		withZero := "0" + phone
		err = r.collection.FindOne(ctx, bson.M{"phone": withZero}).Decode(&user)
		if err == nil {
			return &user, nil
		}
	}

	return nil, errors.New("user not found")
}

func (r *userRepository) FindByEmail(ctx context.Context, email string) (*models.User, error) {
	var user models.User
	err := r.collection.FindOne(ctx, bson.M{"email": email}).Decode(&user)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, errors.New("user not found")
		}
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) Update(ctx context.Context, id primitive.ObjectID, update interface{}) error {
	updateDoc := bson.M{
		"$set": bson.M{
			"updated_at": time.Now(),
		},
	}

	// Merge update fields
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
		return errors.New("user not found")
	}

	return nil
}

func (r *userRepository) UpdateOTP(ctx context.Context, phone, otpCode string) error {
	expiresAt := time.Now().Add(10 * time.Minute)
	otp := models.OTP{
		Code:      otpCode,
		ExpiresAt: expiresAt,
		Attempts:  0,
	}

	update := bson.M{
		"$set": bson.M{
			"otp":        otp,
			"updated_at": time.Now(),
		},
	}

	result, err := r.collection.UpdateOne(ctx, bson.M{"phone": phone}, update)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return errors.New("user not found")
	}

	return nil
}

func (r *userRepository) VerifyPhone(ctx context.Context, phone string) error {
	update := bson.M{
		"$set": bson.M{
			"is_verified": true,
			"otp":         nil,
			"updated_at":  time.Now(),
		},
	}

	result, err := r.collection.UpdateOne(ctx, bson.M{"phone": phone}, update)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return errors.New("user not found")
	}

	return nil
}

func (r *userRepository) AddAddress(ctx context.Context, userID primitive.ObjectID, address *models.Address) error {
	address.ID = primitive.NewObjectID()
	address.CreatedAt = time.Now()

	// If this is default address, unset other defaults
	if address.IsDefault {
		_, err := r.collection.UpdateOne(ctx,
			bson.M{"_id": userID, "profile.addresses.is_default": true},
			bson.M{"$set": bson.M{"profile.addresses.$.is_default": false}},
		)
		if err != nil && err != mongo.ErrNoDocuments {
			return err
		}
	}

	update := bson.M{
		"$push": bson.M{
			"profile.addresses": address,
		},
		"$set": bson.M{
			"updated_at": time.Now(),
		},
	}

	result, err := r.collection.UpdateOne(ctx, bson.M{"_id": userID}, update)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return errors.New("user not found")
	}

	return nil
}

func (r *userRepository) UpdateAddress(ctx context.Context, userID, addressID primitive.ObjectID, update interface{}) error {
	updateFields := bson.M{}
	if updateMap, ok := update.(bson.M); ok {
		for k, v := range updateMap {
			updateFields["profile.addresses.$."+k] = v
		}
	}

	updateFields["updated_at"] = time.Now()

	updateDoc := bson.M{
		"$set": updateFields,
	}

	filter := bson.M{
		"_id":                   userID,
		"profile.addresses._id": addressID,
	}

	result, err := r.collection.UpdateOne(ctx, filter, updateDoc)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return errors.New("address not found")
	}

	return nil
}

func (r *userRepository) DeleteAddress(ctx context.Context, userID, addressID primitive.ObjectID) error {
	update := bson.M{
		"$pull": bson.M{
			"profile.addresses": bson.M{"_id": addressID},
		},
		"$set": bson.M{
			"updated_at": time.Now(),
		},
	}

	result, err := r.collection.UpdateOne(ctx, bson.M{"_id": userID}, update)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return errors.New("user not found")
	}

	return nil
}

func (r *userRepository) GetAddresses(ctx context.Context, userID primitive.ObjectID) ([]models.Address, error) {
	var user models.User
	projection := bson.M{"profile.addresses": 1}

	err := r.collection.FindOne(ctx, bson.M{"_id": userID}, options.FindOne().SetProjection(projection)).Decode(&user)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, errors.New("user not found")
		}
		return nil, err
	}

	return user.Profile.Addresses, nil
}

func (r *userRepository) UpdateFCMToken(ctx context.Context, userID primitive.ObjectID, token string) error {
	update := bson.M{
		"$set": bson.M{
			"fcm_token":  token,
			"updated_at": time.Now(),
		},
	}

	result, err := r.collection.UpdateOne(ctx, bson.M{"_id": userID}, update)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return errors.New("user not found")
	}

	return nil
}

func (r *userRepository) UpdateLastLogin(ctx context.Context, userID primitive.ObjectID) error {
	now := time.Now()
	update := bson.M{
		"$set": bson.M{
			"last_login_at": now,
			"updated_at":    now,
		},
	}

	result, err := r.collection.UpdateOne(ctx, bson.M{"_id": userID}, update)
	if err != nil {
		return err
	}

	if result.MatchedCount == 0 {
		return errors.New("user not found")
	}

	return nil
}

// Add this method to UserRepository interface and implement it

func (r *userRepository) FindByUsername(ctx context.Context, username string) (*models.User, error) {
	var user models.User
	err := r.collection.FindOne(ctx, bson.M{"username": username}).Decode(&user)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, errors.New("user not found")
		}
		return nil, err
	}
	return &user, nil
}
