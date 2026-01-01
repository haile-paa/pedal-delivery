package services

import (
	"context"
	"errors"
	"log"
	"time"

	"github.com/haile-paa/pedal-delivery/internal/models"
	"github.com/haile-paa/pedal-delivery/internal/repositories"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type RestaurantService interface {
	CreateRestaurant(ctx context.Context, ownerID string, req models.CreateRestaurantRequest) (*models.Restaurant, error)
	GetRestaurantByID(ctx context.Context, id string) (*models.Restaurant, error)
	GetRestaurants(ctx context.Context, query models.RestaurantQuery) ([]models.Restaurant, int64, error)
	FindNearby(ctx context.Context, location models.GeoLocation, radius float64) ([]models.Restaurant, error)
	Search(ctx context.Context, query string, location *models.GeoLocation) ([]models.Restaurant, error)
	GetMenuItems(ctx context.Context, restaurantID string) ([]models.MenuItem, error)
	UpdateRestaurant(ctx context.Context, id string, update models.UpdateRestaurantRequest) (*models.Restaurant, error)
	DeleteRestaurant(ctx context.Context, id string) error
	AddMenuItem(ctx context.Context, restaurantID string, req models.CreateMenuItemRequest) (*models.MenuItem, error)
	UpdateMenuItem(ctx context.Context, restaurantID, itemID string, req models.UpdateMenuItemRequest) (*models.MenuItem, error)
}

type restaurantService struct {
	repo repositories.RestaurantRepository
}

func NewRestaurantService(repo repositories.RestaurantRepository) RestaurantService {
	return &restaurantService{repo: repo}
}

func (s *restaurantService) CreateRestaurant(ctx context.Context, ownerID string, req models.CreateRestaurantRequest) (*models.Restaurant, error) {
	ownerObjectID, err := primitive.ObjectIDFromHex(ownerID)
	if err != nil {
		return nil, errors.New("invalid owner ID")
	}

	// Convert menu items if provided
	var menuItems []models.MenuItem
	if req.Menu != nil {
		for _, itemReq := range req.Menu {
			// Default IsAvailable to true if not provided
			isAvailable := true
			if itemReq.IsAvailable != nil {
				isAvailable = *itemReq.IsAvailable
			}

			menuItem := models.MenuItem{
				ID:              primitive.NewObjectID(),
				Name:            itemReq.Name,
				Description:     itemReq.Description,
				Price:           itemReq.Price,
				Category:        itemReq.Category,
				Ingredients:     itemReq.Ingredients,
				Addons:          itemReq.Addons,
				IsAvailable:     isAvailable,
				PreparationTime: itemReq.PreparationTime,
				Image:           itemReq.Image,
				CreatedAt:       time.Now(),
				UpdatedAt:       time.Now(),
			}
			menuItems = append(menuItems, menuItem)
		}
	}

	restaurant := &models.Restaurant{
		OwnerID:      ownerObjectID,
		Name:         req.Name,
		Description:  req.Description,
		CuisineType:  req.CuisineType,
		Address:      req.Address,
		Phone:        req.Phone,
		Email:        req.Email,
		DeliveryFee:  req.DeliveryFee,
		MinOrder:     req.MinOrder,
		DeliveryTime: req.DeliveryTime,
		Location: models.GeoLocation{
			Type:        "Point",
			Coordinates: []float64{req.Longitude, req.Latitude},
		},
		Images:       req.Images,
		Menu:         menuItems,
		OpeningHours: models.OpeningHours{},
	}

	if err := s.repo.Create(ctx, restaurant); err != nil {
		return nil, err
	}

	return restaurant, nil
}
func (s *restaurantService) GetRestaurantByID(ctx context.Context, id string) (*models.Restaurant, error) {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, errors.New("invalid restaurant ID")
	}

	return s.repo.FindByID(ctx, objectID)
}

func (s *restaurantService) GetRestaurants(ctx context.Context, query models.RestaurantQuery) ([]models.Restaurant, int64, error) {
	pagination := repositories.Pagination{
		Page:    int64(query.Page),
		Limit:   int64(query.Limit),
		SortBy:  "created_at",
		SortDir: -1,
	}

	log.Printf("🔍 Service: GetRestaurants called with query: %+v", query)

	// If location is provided, use FindNearby
	if query.Latitude != 0 && query.Longitude != 0 {
		log.Printf("📍 Using location-based search: lat=%f, lng=%f", query.Latitude, query.Longitude)
		location := models.GeoLocation{
			Type:        "Point",
			Coordinates: []float64{query.Longitude, query.Latitude},
		}
		radius := query.Radius
		if radius == 0 {
			radius = 10000 // Default 10km
		}
		log.Printf("📍 Search radius: %.0f meters", radius)

		// Call repository and handle response
		restaurants, total, err := s.repo.FindNearby(ctx, location, radius, pagination)
		if err != nil {
			log.Printf("❌ Error in FindNearby: %v", err)
			return []models.Restaurant{}, 0, err
		}

		log.Printf("✅ FindNearby returned %d restaurants, total: %d", len(restaurants), total)
		if len(restaurants) == 0 {
			log.Printf("⚠️ No restaurants found near the location")
			return []models.Restaurant{}, 0, nil // Return empty slice, not nil
		}

		return restaurants, total, nil
	}

	// If no location, get all restaurants without geospatial query
	log.Printf("📍 No location provided, getting all restaurants")
	restaurants, total, err := s.repo.FindAll(ctx, pagination)
	if err != nil {
		log.Printf("❌ Error in FindAll: %v", err)
		return []models.Restaurant{}, 0, err
	}

	log.Printf("✅ FindAll returned %d restaurants, total: %d", len(restaurants), total)
	if len(restaurants) == 0 {
		log.Printf("⚠️ No restaurants found in database")
		return []models.Restaurant{}, 0, nil // Return empty slice, not nil
	}

	return restaurants, total, nil
}

func (s *restaurantService) FindNearby(ctx context.Context, location models.GeoLocation, radius float64) ([]models.Restaurant, error) {
	pagination := repositories.Pagination{
		Page:    1,
		Limit:   50,
		SortBy:  "rating",
		SortDir: -1,
	}

	restaurants, _, err := s.repo.FindNearby(ctx, location, radius, pagination)
	return restaurants, err
}

func (s *restaurantService) Search(ctx context.Context, query string, location *models.GeoLocation) ([]models.Restaurant, error) {
	radius := 10000.0 // 10km default radius
	if location == nil {
		// Search without location - use a default location
		defaultLocation := models.GeoLocation{
			Type:        "Point",
			Coordinates: []float64{38.746, 9.032}, // Addis Ababa coordinates
		}
		location = &defaultLocation
	}

	return s.repo.Search(ctx, query, *location, radius)
}

func (s *restaurantService) GetMenuItems(ctx context.Context, restaurantID string) ([]models.MenuItem, error) {
	objectID, err := primitive.ObjectIDFromHex(restaurantID)
	if err != nil {
		return nil, errors.New("invalid restaurant ID")
	}

	return s.repo.GetMenuItems(ctx, objectID)
}

func (s *restaurantService) UpdateRestaurant(ctx context.Context, id string, req models.UpdateRestaurantRequest) (*models.Restaurant, error) {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return nil, errors.New("invalid restaurant ID")
	}

	update := bson.M{}
	if req.Name != "" {
		update["name"] = req.Name
	}
	if req.Description != "" {
		update["description"] = req.Description
	}
	if len(req.CuisineType) > 0 {
		update["cuisine_type"] = req.CuisineType
	}
	if req.Address != "" {
		update["address"] = req.Address
	}
	if req.Phone != "" {
		update["phone"] = req.Phone
	}
	if req.Email != "" {
		update["email"] = req.Email
	}
	if req.DeliveryFee > 0 {
		update["delivery_fee"] = req.DeliveryFee
	}
	if req.MinOrder > 0 {
		update["min_order"] = req.MinOrder
	}
	if req.DeliveryTime > 0 {
		update["delivery_time"] = req.DeliveryTime
	}
	if req.Latitude != 0 && req.Longitude != 0 {
		update["location"] = models.GeoLocation{
			Type:        "Point",
			Coordinates: []float64{req.Longitude, req.Latitude},
		}
	}

	// Handle Images field
	if req.Images != nil {
		update["images"] = req.Images
	}

	// Handle Menu field if provided
	if req.Menu != nil {
		var menuItems []models.MenuItem
		for _, itemReq := range req.Menu {
			// Default IsAvailable to true if not provided
			isAvailable := true
			if itemReq.IsAvailable != nil {
				isAvailable = *itemReq.IsAvailable
			}

			menuItem := models.MenuItem{
				ID:              primitive.NewObjectID(),
				Name:            itemReq.Name,
				Description:     itemReq.Description,
				Price:           itemReq.Price,
				Category:        itemReq.Category,
				Ingredients:     itemReq.Ingredients,
				Addons:          itemReq.Addons,
				IsAvailable:     isAvailable,
				PreparationTime: itemReq.PreparationTime,
				Image:           itemReq.Image,
				CreatedAt:       time.Now(),
				UpdatedAt:       time.Now(),
			}
			menuItems = append(menuItems, menuItem)
		}
		update["menu"] = menuItems
	}

	if err := s.repo.Update(ctx, objectID, update); err != nil {
		return nil, err
	}

	return s.repo.FindByID(ctx, objectID)
}
func (s *restaurantService) AddMenuItem(ctx context.Context, restaurantID string, req models.CreateMenuItemRequest) (*models.MenuItem, error) {
	objectID, err := primitive.ObjectIDFromHex(restaurantID)
	if err != nil {
		return nil, errors.New("invalid restaurant ID")
	}

	menuItem := &models.MenuItem{
		ID:              primitive.NewObjectID(),
		Name:            req.Name,
		Description:     req.Description,
		Price:           req.Price,
		Category:        req.Category,
		Ingredients:     req.Ingredients,
		Addons:          req.Addons,
		IsAvailable:     true,
		PreparationTime: req.PreparationTime,
		Image:           req.Image,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	if err := s.repo.AddMenuItem(ctx, objectID, menuItem); err != nil {
		return nil, err
	}

	return menuItem, nil
}

func (s *restaurantService) DeleteRestaurant(ctx context.Context, id string) error {
	objectID, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		return errors.New("invalid restaurant ID")
	}

	// We need to add a Delete method to your repository
	// For now, let's update the status to inactive
	update := bson.M{
		"is_active": false,
	}
	return s.repo.Update(ctx, objectID, update)
}

func (s *restaurantService) UpdateMenuItem(ctx context.Context, restaurantID, itemID string, req models.UpdateMenuItemRequest) (*models.MenuItem, error) {
	restaurantObjectID, err := primitive.ObjectIDFromHex(restaurantID)
	if err != nil {
		return nil, errors.New("invalid restaurant ID")
	}

	itemObjectID, err := primitive.ObjectIDFromHex(itemID)
	if err != nil {
		return nil, errors.New("invalid menu item ID")
	}

	update := bson.M{}
	if req.Name != "" {
		update["name"] = req.Name
	}
	if req.Description != "" {
		update["description"] = req.Description
	}
	if req.Price > 0 {
		update["price"] = req.Price
	}
	if req.Category != "" {
		update["category"] = req.Category
	}
	if req.Ingredients != nil {
		update["ingredients"] = req.Ingredients
	}
	if req.Addons != nil {
		update["addons"] = req.Addons
	}
	if req.IsAvailable != nil {
		update["is_available"] = *req.IsAvailable
	}
	if req.PreparationTime > 0 {
		update["preparation_time"] = req.PreparationTime
	}
	if req.Image != "" {
		update["image"] = req.Image
	}

	if err := s.repo.UpdateMenuItem(ctx, restaurantObjectID, itemObjectID, update); err != nil {
		return nil, err
	}

	// Fetch and return the updated menu item
	// We need to get the restaurant and find the menu item
	restaurant, err := s.repo.FindByID(ctx, restaurantObjectID)
	if err != nil {
		return nil, err
	}

	for _, item := range restaurant.Menu {
		if item.ID == itemObjectID {
			return &item, nil
		}
	}

	return nil, errors.New("menu item not found")
}
