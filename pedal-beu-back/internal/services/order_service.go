package services

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/haile-paa/pedal-delivery/internal/models"
	"github.com/haile-paa/pedal-delivery/internal/repositories"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

type OrderService interface {
	CreateOrder(ctx context.Context, customerID primitive.ObjectID, req *models.CreateOrderRequest) (*models.Order, error)
	GetOrderByID(ctx context.Context, orderID primitive.ObjectID, userID primitive.ObjectID, userRole string) (*OrderWithDriver, error)
	GetCustomerOrders(ctx context.Context, customerID primitive.ObjectID, page, limit int64) ([]models.Order, int64, error)
	GetDriverOrders(ctx context.Context, driverID primitive.ObjectID, page, limit int64) ([]models.Order, int64, error)
	GetRestaurantOrders(ctx context.Context, restaurantID primitive.ObjectID, page, limit int64) ([]models.Order, int64, error)
	UpdateOrderStatus(ctx context.Context, orderID primitive.ObjectID, status models.OrderStatus, actorID primitive.ObjectID, actorRole string) error
	AssignDriver(ctx context.Context, orderID, driverID primitive.ObjectID) error
	RejectOrder(ctx context.Context, orderID, driverID primitive.ObjectID) error
	GetAvailableOrders(ctx context.Context, driverID primitive.ObjectID, driverLocation models.GeoLocation, radius float64) ([]OrderWithRestaurant, error)
	CancelOrder(ctx context.Context, orderID primitive.ObjectID, userID primitive.ObjectID, userRole, reason string) error
	RateOrder(ctx context.Context, orderID primitive.ObjectID, rating *models.OrderRating) error
	CalculateDeliveryFee(ctx context.Context, restaurantLocation, deliveryLocation models.GeoLocation) (float64, error)
	GetOrderStatistics(ctx context.Context, restaurantID primitive.ObjectID) (map[string]interface{}, error)
	GetAllOrders(ctx context.Context, page, limit int64) ([]models.Order, int64, error)
	GetAllOrdersEnriched(ctx context.Context, page, limit int64) ([]AdminOrderView, int64, error)
	VerifyOrderPayment(ctx context.Context, orderID primitive.ObjectID, customerID primitive.ObjectID, req *models.VerifyOrderPaymentRequest) (*models.Order, error)
	SubmitPaymentProof(ctx context.Context, orderID primitive.ObjectID, customerID primitive.ObjectID, req *models.SubmitPaymentProofRequest) (*models.Order, error)
	ReviewPaymentProof(ctx context.Context, orderID primitive.ObjectID, adminID primitive.ObjectID, req *models.ReviewPaymentProofRequest) (*models.Order, error)
	GetPaymentVerificationHealth(ctx context.Context) map[string]interface{}
	GetDriverStats(ctx context.Context, driverID primitive.ObjectID) (map[string]interface{}, error)
	GetDriverEarningsChart(ctx context.Context, driverID primitive.ObjectID, rangeType string) (map[string]interface{}, error)
	GetDriverEarningsTransactions(ctx context.Context, driverID primitive.ObjectID, limit int64) ([]map[string]interface{}, error)
	// AutoCancelStaleOrders cancels every unassigned order older than
	// `olderThan` and returns the orders it cancelled, so the caller
	// (main.go's sweep ticker) can broadcast order:cancelled for each one.
	AutoCancelStaleOrders(ctx context.Context, olderThan time.Duration) ([]models.Order, error)
}

type orderService struct {
	orderRepo      repositories.OrderRepository
	restaurantRepo repositories.RestaurantRepository
	userRepo       repositories.UserRepository
	driverRepo     repositories.DriverRepository
}

func NewOrderService(
	orderRepo repositories.OrderRepository,
	restaurantRepo repositories.RestaurantRepository,
	userRepo repositories.UserRepository,
	driverRepo repositories.DriverRepository,
) OrderService {
	return &orderService{
		orderRepo:      orderRepo,
		restaurantRepo: restaurantRepo,
		userRepo:       userRepo,
		driverRepo:     driverRepo,
	}
}

// OrderWithDriver is what GET /orders/:id actually returns. The raw Order
// document only stores driver_id (a bare ObjectID reference), but both
// consumers of this endpoint need more than that: the customer app needs
// the assigned driver's name/phone/vehicle/rating to show "Your Driver",
// and the driver app just ignores the extra field. Without this, the
// customer never sees who's delivering their order even after a driver
// has accepted it.
type OrderWithDriver struct {
	*models.Order
	Driver     *DriverContact  `json:"driver,omitempty"`
	Restaurant *RestaurantInfo `json:"restaurant,omitempty"`
}

// RestaurantInfo is the pickup-location subset of a restaurant attached to
// orders for the driver and customer apps — name, address, phone, and
// location. The Order document only stores RestaurantID (plus a denormalized
// RestaurantLocation snapshot for geo queries), so this is resolved from the
// restaurants collection at read time rather than stored on the order.
type RestaurantInfo struct {
	Name     string             `json:"name"`
	Address  string             `json:"address"`
	Phone    string             `json:"phone,omitempty"`
	Location *models.GeoLocation `json:"location,omitempty"`
}

// OrderWithRestaurant is what GET /driver/orders/available returns — each
// order plus its restaurant's name/address/phone/location, so the driver
// app can show the pickup address without a second round trip per order.
type OrderWithRestaurant struct {
	models.Order
	Restaurant *RestaurantInfo `json:"restaurant,omitempty"`
}

// DriverContact is the public-facing subset of driver info safe to expose
// to the customer tracking an order.
type DriverContact struct {
	ID                  string  `json:"id"`
	Name                string  `json:"name"`
	Phone               string  `json:"phone"`
	ProfilePicture      string  `json:"profile_picture,omitempty"`
	Rating              float64 `json:"rating"`
	VehicleType         string  `json:"vehicle_type"`
	LicensePlate        string  `json:"license_plate"`
	CompletedDeliveries int     `json:"completed_deliveries"`
}

func (s *orderService) CreateOrder(ctx context.Context, customerID primitive.ObjectID, req *models.CreateOrderRequest) (*models.Order, error) {
	// Validate restaurant
	restaurantID, err := primitive.ObjectIDFromHex(req.RestaurantID)
	if err != nil {
		return nil, errors.New("invalid restaurant ID")
	}

	restaurant, err := s.restaurantRepo.FindByID(ctx, restaurantID)
	if err != nil {
		return nil, errors.New("restaurant not found")
	}

	if !restaurant.IsActive || !restaurant.IsVerified {
		return nil, errors.New("restaurant is not available")
	}

	// Validate menu items
	var orderItems []models.OrderItem
	var subtotal float64

	for _, itemReq := range req.Items {
		menuItemID, err := primitive.ObjectIDFromHex(itemReq.MenuItemID)
		if err != nil {
			return nil, fmt.Errorf("invalid menu item ID: %s", itemReq.MenuItemID)
		}

		// Find menu item in restaurant
		var menuItem *models.MenuItem
		for _, m := range restaurant.Menu {
			if m.ID == menuItemID {
				menuItem = &m
				break
			}
		}

		if menuItem == nil {
			return nil, fmt.Errorf("menu item not found: %s", itemReq.MenuItemID)
		}

		if !menuItem.IsAvailable {
			return nil, fmt.Errorf("menu item not available: %s", menuItem.Name)
		}

		// Calculate item total
		itemTotal := menuItem.Price * float64(itemReq.Quantity)

		// Add addons if any
		var addons []models.OrderItemAddon
		for _, addonReq := range itemReq.Addons {
			addonID, err := primitive.ObjectIDFromHex(addonReq.AddonID)
			if err != nil {
				return nil, fmt.Errorf("invalid addon ID: %s", addonReq.AddonID)
			}

			for _, addon := range menuItem.Addons {
				if addon.ID == addonID && addon.IsActive {
					itemTotal += addon.Price * float64(itemReq.Quantity)
					addons = append(addons, models.OrderItemAddon{
						AddonID: addon.ID,
						Name:    addon.Name,
						Price:   addon.Price,
					})
					break
				}
			}
		}

		orderItem := models.OrderItem{
			MenuItemID: menuItemID,
			Name:       menuItem.Name,
			Quantity:   itemReq.Quantity,
			Price:      menuItem.Price,
			Addons:     addons,
			Total:      itemTotal,
			Notes:      itemReq.Notes,
		}

		orderItems = append(orderItems, orderItem)
		subtotal += itemTotal
	}

	// Check minimum order
	if subtotal < restaurant.MinOrder {
		return nil, fmt.Errorf("minimum order amount is %.2f", restaurant.MinOrder)
	}

	// Get customer address
	customer, err := s.userRepo.FindByID(ctx, customerID)
	if err != nil {
		return nil, errors.New("customer not found")
	}

	var deliveryAddress models.Address
	addressID, err := primitive.ObjectIDFromHex(req.AddressID)
	if err != nil {
		return nil, errors.New("invalid address ID")
	}

	for _, addr := range customer.Profile.Addresses {
		if addr.ID == addressID {
			deliveryAddress = addr
			break
		}
	}

	if deliveryAddress.ID.IsZero() {
		return nil, errors.New("address not found")
	}

	// Delivery fee: use the restaurant's own configured delivery_fee when
	// one is set (this is the exact number the customer already saw and
	// agreed to in the cart/checkout screens), and only fall back to the
	// distance-based estimate for restaurants that haven't configured one.
	// Previously this always recalculated a distance-based fee here,
	// silently overriding whatever the customer was shown at checkout —
	// which is why the stored order total could differ from the price the
	// customer approved.
	deliveryFee := restaurant.DeliveryFee
	if deliveryFee <= 0 {
		calculatedFee, err := s.CalculateDeliveryFee(ctx, restaurant.Location, deliveryAddress.Location)
		if err != nil {
			return nil, err
		}
		deliveryFee = calculatedFee
	}

	// Calculate total amount
	totalAmount := models.OrderAmount{
		Subtotal:      subtotal,
		DeliveryFee:   deliveryFee,
		ServiceCharge: subtotal * 0.05, // 5% service charge
		Discount:      0,
		Tax:           subtotal * 0.10, // 10% tax
		Total:         subtotal + deliveryFee + (subtotal * 0.05) + (subtotal * 0.10),
	}

	// Create order
	// Status starts as "accepted" (not "pending") so it's immediately
	// visible to nearby drivers via GetAvailableOrders — this app has no
	// separate restaurant-side "confirm this order" step/portal, so
	// requiring manual acceptance before drivers can see it just meant no
	// order was ever visible to anyone. Admins can still reject/cancel it
	// from the admin site if needed (see order_service.go transition table).
	order := &models.Order{
		CustomerID:         customerID,
		RestaurantID:       restaurantID,
		RestaurantLocation: restaurant.Location,
		Items:              orderItems,
		Status:             models.OrderAccepted,
		TotalAmount:        totalAmount,
		DeliveryInfo: models.DeliveryInfo{
			Address:           deliveryAddress,
			Notes:             req.Notes,
			ContactName:       fmt.Sprintf("%s %s", customer.Profile.FirstName, customer.Profile.LastName),
			ContactPhone:      customer.Phone,
			EstimatedDelivery: time.Now().Add(time.Duration(restaurant.DeliveryTime) * time.Minute),
		},
		PaymentMethod: req.PaymentMethod,
		PaymentStatus: "pending",
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	// Save order
	if err := s.orderRepo.Create(ctx, order); err != nil {
		return nil, err
	}

	return order, nil
}

func (s *orderService) GetOrderByID(ctx context.Context, orderID primitive.ObjectID, userID primitive.ObjectID, userRole string) (*OrderWithDriver, error) {
	order, err := s.orderRepo.FindByID(ctx, orderID)
	if err != nil {
		return nil, err
	}

	// Check permissions
	switch userRole {
	case "customer":
		if order.CustomerID != userID {
			return nil, errors.New("unauthorized")
		}
	case "driver":
		if order.DriverID == nil || *order.DriverID != userID {
			return nil, errors.New("unauthorized")
		}
	case "restaurant_owner":
		// Need to check if user owns the restaurant
		restaurant, err := s.restaurantRepo.FindByID(ctx, order.RestaurantID)
		if err != nil || restaurant.OwnerID != userID {
			return nil, errors.New("unauthorized")
		}
	case "admin":
		// Admin can see all orders
	default:
		return nil, errors.New("unauthorized")
	}

	result := &OrderWithDriver{Order: order}

	// Resolve the restaurant's name/address/phone/location so order-detail,
	// navigation, and tracking screens can show pickup info without a
	// separate /restaurants/:id call.
	if restaurant, rerr := s.restaurantRepo.FindByID(ctx, order.RestaurantID); rerr == nil && restaurant != nil {
		result.Restaurant = &RestaurantInfo{
			Name:     restaurant.Name,
			Address:  restaurant.Address,
			Phone:    restaurant.Phone,
			Location: &restaurant.Location,
		}
	}

	// Resolve the assigned driver's contact/vehicle info, if any, so the
	// customer app can render "Your Driver" without a second round trip.
	if order.DriverID != nil {
		if driverUser, uerr := s.userRepo.FindByID(ctx, *order.DriverID); uerr == nil && driverUser != nil {
			contact := &DriverContact{
				ID:    driverUser.ID.Hex(),
				Name:  userDisplayName(driverUser),
				Phone: driverUser.Phone,
			}
			if driverProfile, derr := s.driverRepo.FindByUserID(ctx, *order.DriverID); derr == nil && driverProfile != nil {
				contact.Rating = driverProfile.Rating
				contact.VehicleType = driverProfile.Vehicle.Type
				contact.LicensePlate = driverProfile.Vehicle.Plate
				contact.CompletedDeliveries = driverProfile.TotalTrips
			}
			result.Driver = contact
		}
	}

	return result, nil
}

func (s *orderService) GetCustomerOrders(ctx context.Context, customerID primitive.ObjectID, page, limit int64) ([]models.Order, int64, error) {
	pagination := repositories.Pagination{
		Page:    page,
		Limit:   limit,
		SortBy:  "created_at",
		SortDir: -1,
	}

	return s.orderRepo.FindByCustomerID(ctx, customerID, pagination)
}

func (s *orderService) GetDriverOrders(ctx context.Context, driverID primitive.ObjectID, page, limit int64) ([]models.Order, int64, error) {
	pagination := repositories.Pagination{
		Page:    page,
		Limit:   limit,
		SortBy:  "created_at",
		SortDir: -1,
	}

	return s.orderRepo.FindByDriverID(ctx, driverID, pagination)
}

func (s *orderService) GetRestaurantOrders(ctx context.Context, restaurantID primitive.ObjectID, page, limit int64) ([]models.Order, int64, error) {
	pagination := repositories.Pagination{
		Page:    page,
		Limit:   limit,
		SortBy:  "created_at",
		SortDir: -1,
	}

	return s.orderRepo.FindByRestaurantID(ctx, restaurantID, pagination)
}

func (s *orderService) UpdateOrderStatus(ctx context.Context, orderID primitive.ObjectID, status models.OrderStatus, actorID primitive.ObjectID, actorRole string) error {
	order, err := s.orderRepo.FindByID(ctx, orderID)
	if err != nil {
		return err
	}

	// Validate status transition
	if !s.isValidStatusTransition(order.Status, status, actorRole) {
		return errors.New("invalid status transition")
	}

	return s.orderRepo.UpdateStatus(ctx, orderID, status, actorID, actorRole)
}

func (s *orderService) isValidStatusTransition(current, new models.OrderStatus, actorRole string) bool {
	transitions := map[models.OrderStatus]map[string][]models.OrderStatus{
		models.OrderPending: {
			"restaurant": {models.OrderAccepted, models.OrderRejected},
			"customer":   {models.OrderCancelled},
			// "admin" can also drive the restaurant side of the order
			// lifecycle: there is no separate "restaurant" account role
			// anywhere in this system (registration only allows
			// customer/driver/admin — see models.RegisterRequest), so
			// without this, NO order could ever move past "pending" and
			// drivers would never see any order, ever. Restaurants are
			// managed through the admin site in this app, so admin is the
			// practical stand-in for the restaurant's own actions.
			"admin": {models.OrderAccepted, models.OrderRejected, models.OrderCancelled},
		},
		models.OrderAccepted: {
			"restaurant": {models.OrderPreparing, models.OrderCancelled},
			// There is no restaurant portal to mark "food ready" in real
			// time (see the CreateOrder comment above), so once a driver
			// has taken the order, they are the only actor who can report
			// having physically arrived at the restaurant. Let them push
			// straight to "ready" — this is what the driver app's
			// "Arrived at Restaurant" button sends.
			"driver": {models.OrderReady, models.OrderCancelled},
			"admin":  {models.OrderPreparing, models.OrderCancelled},
		},
		models.OrderPreparing: {
			"restaurant": {models.OrderReady, models.OrderCancelled},
			"admin":      {models.OrderReady, models.OrderCancelled},
		},
		models.OrderReady: {
			"driver": {models.OrderPickedUp},
			"admin":  {models.OrderCancelled},
		},
		models.OrderPickedUp: {
			// Same reasoning as above: no dispatcher needs the separate
			// "on the way" hop reported, so the driver app's "Mark as
			// Delivered" button can go straight from picked_up to
			// delivered. on_the_way is kept available (e.g. for admin use)
			// but isn't required.
			"driver": {models.OrderOnTheWay, models.OrderDelivered},
			"admin":  {models.OrderCancelled},
		},
		models.OrderOnTheWay: {
			"driver": {models.OrderDelivered},
			"admin":  {models.OrderCancelled},
		},
	}

	if roleTransitions, ok := transitions[current]; ok {
		if allowedStatuses, ok := roleTransitions[actorRole]; ok {
			for _, allowed := range allowedStatuses {
				if allowed == new {
					return true
				}
			}
		}
	}

	return false
}

func (s *orderService) AssignDriver(ctx context.Context, orderID, driverID primitive.ObjectID) error {
	return s.orderRepo.AssignDriver(ctx, orderID, driverID)
}

func (s *orderService) RejectOrder(ctx context.Context, orderID, driverID primitive.ObjectID) error {
	return s.orderRepo.RejectOrder(ctx, orderID, driverID)
}

func (s *orderService) GetAvailableOrders(ctx context.Context, driverID primitive.ObjectID, driverLocation models.GeoLocation, radius float64) ([]OrderWithRestaurant, error) {
	orders, err := s.orderRepo.FindAvailableOrders(ctx, driverID, driverLocation, radius)
	if err != nil {
		return nil, err
	}

	views := make([]OrderWithRestaurant, 0, len(orders))
	for _, order := range orders {
		view := OrderWithRestaurant{Order: order}
		if restaurant, rerr := s.restaurantRepo.FindByID(ctx, order.RestaurantID); rerr == nil && restaurant != nil {
			view.Restaurant = &RestaurantInfo{
				Name:     restaurant.Name,
				Address:  restaurant.Address,
				Phone:    restaurant.Phone,
				Location: &restaurant.Location,
			}
		}
		views = append(views, view)
	}

	return views, nil
}

func (s *orderService) CancelOrder(ctx context.Context, orderID primitive.ObjectID, userID primitive.ObjectID, userRole, reason string) error {
	cancellation := models.CancellationInfo{
		Reason:      reason,
		CancelledBy: userID,
		Role:        userRole,
	}

	return s.orderRepo.CancelOrder(ctx, orderID, cancellation)
}

// AutoCancelStaleOrders finds unassigned orders older than `olderThan` and
// cancels each one (same CancelOrder path as a manual cancellation, so it
// gets the same timeline entry / cancellation record), returning the
// orders it cancelled so main.go's sweep ticker can broadcast
// order:cancelled to the driver room and to the customer who placed each
// one. CancelledBy is left as the zero ObjectID with Role "system" to mark
// these as machine-initiated rather than a real user action.
func (s *orderService) AutoCancelStaleOrders(ctx context.Context, olderThan time.Duration) ([]models.Order, error) {
	cutoff := time.Now().Add(-olderThan)
	stale, err := s.orderRepo.FindStaleUnassignedOrders(ctx, cutoff)
	if err != nil {
		return nil, err
	}

	cancelled := make([]models.Order, 0, len(stale))
	for _, order := range stale {
		cancellation := models.CancellationInfo{
			Reason:      "No driver accepted this order in time",
			CancelledBy: primitive.NilObjectID,
			Role:        "system",
		}
		if err := s.orderRepo.CancelOrder(ctx, order.ID, cancellation); err != nil {
			// One stale order failing to cancel (e.g. a driver accepted it
			// in the split second between the find and this update, so it
			// no longer matches CancelOrder's status filter) shouldn't
			// stop the rest of the sweep from processing.
			continue
		}
		cancelled = append(cancelled, order)
	}

	return cancelled, nil
}

func (s *orderService) RateOrder(ctx context.Context, orderID primitive.ObjectID, rating *models.OrderRating) error {
	order, err := s.orderRepo.FindByID(ctx, orderID)
	if err != nil {
		return err
	}

	if order.Status != models.OrderDelivered {
		return errors.New("order must be delivered before rating")
	}

	if order.Rating != nil {
		return errors.New("order already rated")
	}

	if err := s.orderRepo.AddRating(ctx, orderID, *rating); err != nil {
		return err
	}

	// Recompute and persist the driver's/restaurant's average rating so
	// they reflect real customer feedback everywhere they're surfaced —
	// not just in GetDriverStats (which averages live from order history
	// on every call), but also the static Driver.Rating/Restaurant.Rating
	// fields used by DriverContact (customer's live tracking card) and the
	// restaurant listing/detail screens.
	if order.DriverID != nil {
		if avg, count, derr := s.averageDriverRating(ctx, *order.DriverID); derr == nil && count > 0 {
			if uerr := s.driverRepo.UpdateRating(ctx, *order.DriverID, avg); uerr != nil {
				fmt.Printf("⚠️  Failed to update driver rating for %s: %v\n", order.DriverID.Hex(), uerr)
			}
		}
	}

	if avg, count, rerr := s.averageRestaurantRating(ctx, order.RestaurantID); rerr == nil && count > 0 {
		if uerr := s.restaurantRepo.Update(ctx, order.RestaurantID, bson.M{
			"rating":        avg,
			"total_reviews": count,
		}); uerr != nil {
			fmt.Printf("⚠️  Failed to update restaurant rating for %s: %v\n", order.RestaurantID.Hex(), uerr)
		}
	}

	return nil
}

// averageDriverRating averages DeliveryRating across every rated order this
// driver has completed. userID is the driver's User._id (matches
// order.driver_id — see UpdateRating).
func (s *orderService) averageDriverRating(ctx context.Context, userID primitive.ObjectID) (float64, int, error) {
	orders, _, err := s.orderRepo.FindByDriverID(ctx, userID, repositories.Pagination{
		Page: 1, Limit: 10000, SortBy: "created_at", SortDir: -1,
	})
	if err != nil {
		return 0, 0, err
	}

	sum, count := 0, 0
	for _, o := range orders {
		if o.Rating != nil && o.Rating.DeliveryRating > 0 {
			sum += o.Rating.DeliveryRating
			count++
		}
	}
	if count == 0 {
		return 0, 0, nil
	}
	return float64(sum) / float64(count), count, nil
}

// averageRestaurantRating averages RestaurantRating across every rated order
// placed with this restaurant.
func (s *orderService) averageRestaurantRating(ctx context.Context, restaurantID primitive.ObjectID) (float64, int, error) {
	orders, _, err := s.orderRepo.FindByRestaurantID(ctx, restaurantID, repositories.Pagination{
		Page: 1, Limit: 10000, SortBy: "created_at", SortDir: -1,
	})
	if err != nil {
		return 0, 0, err
	}

	sum, count := 0, 0
	for _, o := range orders {
		if o.Rating != nil && o.Rating.RestaurantRating > 0 {
			sum += o.Rating.RestaurantRating
			count++
		}
	}
	if count == 0 {
		return 0, 0, nil
	}
	return float64(sum) / float64(count), count, nil
}

func (s *orderService) CalculateDeliveryFee(ctx context.Context, restaurantLocation, deliveryLocation models.GeoLocation) (float64, error) {
	// Calculate distance using Haversine formula
	distance := calculateDistance(
		restaurantLocation.Coordinates[1], // lat1
		restaurantLocation.Coordinates[0], // lon1
		deliveryLocation.Coordinates[1],   // lat2
		deliveryLocation.Coordinates[0],   // lon2
	)

	// Base fee + distance fee
	baseFee := 2.0
	distanceFee := distance * 0.5 // $0.5 per km

	return baseFee + distanceFee, nil
}

func calculateDistance(lat1, lon1, lat2, lon2 float64) float64 {
	// Convert to radians
	lat1Rad := lat1 * math.Pi / 180
	lon1Rad := lon1 * math.Pi / 180
	lat2Rad := lat2 * math.Pi / 180
	lon2Rad := lon2 * math.Pi / 180

	// Haversine formula
	dLon := lon2Rad - lon1Rad
	dLat := lat2Rad - lat1Rad
	a := math.Pow(math.Sin(dLat/2), 2) + math.Cos(lat1Rad)*math.Cos(lat2Rad)*math.Pow(math.Sin(dLon/2), 2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	// Earth radius in kilometers
	radius := 6371.0

	return radius * c
}

func (s *orderService) GetOrderStatistics(ctx context.Context, restaurantID primitive.ObjectID) (map[string]interface{}, error) {
	// Get all restaurant orders
	pagination := repositories.Pagination{
		Page:    1,
		Limit:   1000,
		SortBy:  "created_at",
		SortDir: -1,
	}

	orders, _, err := s.orderRepo.FindByRestaurantID(ctx, restaurantID, pagination)
	if err != nil {
		return nil, err
	}

	// Calculate statistics
	stats := map[string]interface{}{
		"total_orders":        len(orders),
		"total_revenue":       0.0,
		"average_order_value": 0.0,
		"status_counts":       map[string]int{},
	}

	var totalRevenue float64
	statusCounts := map[string]int{}

	for _, order := range orders {
		totalRevenue += order.TotalAmount.Total
		statusCounts[string(order.Status)]++
	}

	if len(orders) > 0 {
		stats["average_order_value"] = totalRevenue / float64(len(orders))
	}

	stats["total_revenue"] = totalRevenue
	stats["status_counts"] = statusCounts

	return stats, nil
}

// userDisplayName returns "FirstName LastName" trimmed, falling back to
// username then phone. Mirrors handlers.userDisplayName (unexported there,
// in a different package, so duplicated here rather than shared).
func userDisplayName(u *models.User) string {
	name := strings.TrimSpace(u.Profile.FirstName + " " + u.Profile.LastName)
	if name != "" {
		return name
	}
	if u.Username != "" {
		return u.Username
	}
	return u.Phone
}

func (s *orderService) GetAllOrders(ctx context.Context, page, limit int64) ([]models.Order, int64, error) {
	pagination := repositories.Pagination{
		Page:    page,
		Limit:   limit,
		SortBy:  "created_at",
		SortDir: -1,
	}
	return s.orderRepo.GetAllOrders(ctx, pagination)
}

// AdminOrderView is what the admin site's Orders page actually needs to
// display — the raw Order document only stores customer_id/restaurant_id/
// driver_id references, never resolved names, but the UI needs to show
// "who ordered", "which restaurant", "which driver took it", and the price
// without the admin having to cross-reference IDs by hand.
type AdminOrderView struct {
	models.Order
	CustomerName   string `json:"customer_name"`
	CustomerPhone  string `json:"customer_phone"`
	RestaurantName string `json:"restaurant_name"`
	DriverName     string `json:"driver_name,omitempty"`
	DriverPhone    string `json:"driver_phone,omitempty"`
}

// GetAllOrdersEnriched is the same as GetAllOrders but resolves
// customer/restaurant/driver names for display on the admin site — see
// AdminOrderView. Uses simple per-order lookups rather than a batch $in
// query since admin page sizes are small (typically 20/page); fine for this
// scale, worth revisiting with a proper join/cache if order volume grows.
func (s *orderService) GetAllOrdersEnriched(ctx context.Context, page, limit int64) ([]AdminOrderView, int64, error) {
	orders, total, err := s.GetAllOrders(ctx, page, limit)
	if err != nil {
		return nil, 0, err
	}

	views := make([]AdminOrderView, 0, len(orders))
	for _, order := range orders {
		view := AdminOrderView{Order: order}

		if customer, err := s.userRepo.FindByID(ctx, order.CustomerID); err == nil && customer != nil {
			view.CustomerName = userDisplayName(customer)
			view.CustomerPhone = customer.Phone
		}

		if restaurant, err := s.restaurantRepo.FindByID(ctx, order.RestaurantID); err == nil && restaurant != nil {
			view.RestaurantName = restaurant.Name
		}

		if order.DriverID != nil {
			if driver, err := s.userRepo.FindByID(ctx, *order.DriverID); err == nil && driver != nil {
				view.DriverName = userDisplayName(driver)
				view.DriverPhone = driver.Phone
			}
		}

		views = append(views, view)
	}

	return views, total, nil
}

// GetDriverStats computes a driver's delivery/earnings/rating stats live
// from their order history. Backs GET /api/v1/driver/stats — used by
// DriverDashboard, DriverProfileScreen, and AvailableOrdersScreen in the app.
func (s *orderService) GetDriverStats(ctx context.Context, driverID primitive.ObjectID) (map[string]interface{}, error) {
	orders, _, err := s.orderRepo.FindByDriverID(ctx, driverID, repositories.Pagination{
		Page:    1,
		Limit:   10000,
		SortBy:  "created_at",
		SortDir: -1,
	})
	if err != nil {
		return nil, err
	}

	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	startOfWeek := startOfDay.AddDate(0, 0, -int(now.Weekday()))
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	var totalDeliveries int
	var totalEarnings, todayEarnings, weekEarnings, monthEarnings float64
	var ratingSum, ratingCount int

	for _, o := range orders {
		if o.Status == models.OrderDelivered {
			totalDeliveries++
			fee := o.TotalAmount.DeliveryFee
			totalEarnings += fee
			if o.UpdatedAt.After(startOfDay) {
				todayEarnings += fee
			}
			if o.UpdatedAt.After(startOfWeek) {
				weekEarnings += fee
			}
			if o.UpdatedAt.After(startOfMonth) {
				monthEarnings += fee
			}
		}
		if o.Rating != nil && o.Rating.DeliveryRating > 0 {
			ratingSum += o.Rating.DeliveryRating
			ratingCount++
		}
	}

	// Acceptance rate: orders this driver ended up assigned to vs. orders
	// they were offered and rejected (tracked in rejected_by_drivers).
	acceptedCount := int64(len(orders))
	rejectedCount, err := s.orderRepo.CountOrders(ctx, bson.M{"rejected_by_drivers": driverID})
	if err != nil {
		rejectedCount = 0
	}
	acceptanceRate := 100.0
	if acceptedCount+rejectedCount > 0 {
		acceptanceRate = float64(acceptedCount) / float64(acceptedCount+rejectedCount) * 100
	}

	averageRating := 5.0
	if ratingCount > 0 {
		averageRating = float64(ratingSum) / float64(ratingCount)
	}

	averageEarnings := 0.0
	if totalDeliveries > 0 {
		averageEarnings = totalEarnings / float64(totalDeliveries)
	}

	return map[string]interface{}{
		"totalDeliveries": totalDeliveries,
		"averageRating":   averageRating,
		"rating":          averageRating, // DriverProfileScreen reads this key
		"ratingCount":     ratingCount,   // 0 means no customer has rated this driver yet — the app should show "New" instead of a fake 5.0
		"averageEarnings": averageEarnings,
		"acceptanceRate":  acceptanceRate,
		"todayEarnings":   todayEarnings,
		"weekEarnings":    weekEarnings,
		"earnings": map[string]interface{}{
			"total":     totalEarnings,
			"thisMonth": monthEarnings,
			"today":     todayEarnings,
		},
	}, nil
}

// GetDriverEarningsChart buckets a driver's delivered-order earnings into a
// bar-chart-friendly {data, labels} shape for the given range. Backs GET
// /api/v1/driver/earnings/chart — used by EarningsScreen.
func (s *orderService) GetDriverEarningsChart(ctx context.Context, driverID primitive.ObjectID, rangeType string) (map[string]interface{}, error) {
	orders, _, err := s.orderRepo.FindByDriverID(ctx, driverID, repositories.Pagination{
		Page:    1,
		Limit:   10000,
		SortBy:  "created_at",
		SortDir: -1,
	})
	if err != nil {
		return nil, err
	}

	now := time.Now()
	var labels []string
	var data []float64

	switch rangeType {
	case "month":
		// Bucket the current month into weekly chunks (Week 1..Week n).
		startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		daysInMonth := time.Date(now.Year(), now.Month()+1, 0, 0, 0, 0, 0, now.Location()).AddDate(0, 0, -1).Day()
		numWeeks := (daysInMonth + 6) / 7
		data = make([]float64, numWeeks)
		labels = make([]string, numWeeks)
		for i := 0; i < numWeeks; i++ {
			labels[i] = fmt.Sprintf("Week %d", i+1)
		}
		for _, o := range orders {
			if o.Status != models.OrderDelivered {
				continue
			}
			if o.UpdatedAt.Before(startOfMonth) || o.UpdatedAt.Month() != now.Month() || o.UpdatedAt.Year() != now.Year() {
				continue
			}
			weekIdx := (o.UpdatedAt.Day() - 1) / 7
			if weekIdx >= numWeeks {
				weekIdx = numWeeks - 1
			}
			data[weekIdx] += o.TotalAmount.DeliveryFee
		}
	case "year":
		monthNames := []string{"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"}
		data = make([]float64, 12)
		labels = monthNames
		for _, o := range orders {
			if o.Status != models.OrderDelivered {
				continue
			}
			if o.UpdatedAt.Year() != now.Year() {
				continue
			}
			data[int(o.UpdatedAt.Month())-1] += o.TotalAmount.DeliveryFee
		}
	default: // "week"
		dayNames := []string{"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"}
		data = make([]float64, 7)
		labels = make([]string, 7)
		startOfRange := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).AddDate(0, 0, -6)
		for i := 0; i < 7; i++ {
			labels[i] = dayNames[int(startOfRange.AddDate(0, 0, i).Weekday())]
		}
		for _, o := range orders {
			if o.Status != models.OrderDelivered {
				continue
			}
			if o.UpdatedAt.Before(startOfRange) {
				continue
			}
			dayIdx := int(o.UpdatedAt.Sub(startOfRange).Hours() / 24)
			if dayIdx < 0 || dayIdx > 6 {
				continue
			}
			data[dayIdx] += o.TotalAmount.DeliveryFee
		}
	}

	return map[string]interface{}{
		"data":   data,
		"labels": labels,
	}, nil
}

// GetDriverEarningsTransactions returns the driver's most recent delivered
// or cancelled orders formatted as earnings transactions. Backs GET
// /api/v1/driver/earnings/transactions — used by EarningsScreen.
func (s *orderService) GetDriverEarningsTransactions(ctx context.Context, driverID primitive.ObjectID, limit int64) ([]map[string]interface{}, error) {
	orders, _, err := s.orderRepo.FindByDriverID(ctx, driverID, repositories.Pagination{
		Page:    1,
		Limit:   10000,
		SortBy:  "updated_at",
		SortDir: -1,
	})
	if err != nil {
		return nil, err
	}

	if limit <= 0 {
		limit = 5
	}

	transactions := make([]map[string]interface{}, 0, limit)
	for _, o := range orders {
		if int64(len(transactions)) >= limit {
			break
		}
		if o.Status != models.OrderDelivered && o.Status != models.OrderCancelled {
			continue
		}
		status := "completed"
		if o.Status == models.OrderCancelled {
			status = "failed"
		}
		transactions = append(transactions, map[string]interface{}{
			"id":      o.ID.Hex(),
			"date":    o.UpdatedAt.Format("Jan 2, 2006"),
			"amount":  o.TotalAmount.DeliveryFee,
			"orderId": o.OrderNumber,
			"status":  status,
		})
	}

	return transactions, nil
}