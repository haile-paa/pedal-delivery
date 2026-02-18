package services

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/haile-paa/pedal-delivery/internal/models"
	"github.com/haile-paa/pedal-delivery/internal/repositories"
	"github.com/haile-paa/pedal-delivery/internal/shipday"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type OrderService interface {
	CreateOrder(ctx context.Context, customerID primitive.ObjectID, req *models.CreateOrderRequest) (*models.Order, error)
	GetOrderByID(ctx context.Context, orderID primitive.ObjectID, userID primitive.ObjectID, userRole string) (*models.Order, error)
	GetCustomerOrders(ctx context.Context, customerID primitive.ObjectID, page, limit int64) ([]models.Order, int64, error)
	GetDriverOrders(ctx context.Context, driverID primitive.ObjectID, page, limit int64) ([]models.Order, int64, error)
	GetRestaurantOrders(ctx context.Context, restaurantID primitive.ObjectID, page, limit int64) ([]models.Order, int64, error)
	UpdateOrderStatus(ctx context.Context, orderID primitive.ObjectID, status models.OrderStatus, actorID primitive.ObjectID, actorRole string) error
	AssignDriver(ctx context.Context, orderID, driverID primitive.ObjectID) error
	GetAvailableOrders(ctx context.Context, driverLocation models.GeoLocation, radius float64) ([]models.Order, error)
	CancelOrder(ctx context.Context, orderID primitive.ObjectID, userID primitive.ObjectID, userRole, reason string) error
	RateOrder(ctx context.Context, orderID primitive.ObjectID, rating *models.OrderRating) error
	CalculateDeliveryFee(ctx context.Context, restaurantLocation, deliveryLocation models.GeoLocation) (float64, error)
	GetOrderStatistics(ctx context.Context, restaurantID primitive.ObjectID) (map[string]interface{}, error)
	UpdateDriverLocation(ctx context.Context, driverID primitive.ObjectID, location models.GeoLocation, orderID string) error
	GetActiveOrderForDriver(ctx context.Context, driverID primitive.ObjectID) (*models.Order, error)
	GetOrderByDriverAndStatus(ctx context.Context, driverID primitive.ObjectID, status models.OrderStatus) (*models.Order, error)
	 FindByShipdayID(ctx context.Context, shipdayID string) (*models.Order, error)
    UpdateOrderStatusFromWebhook(ctx context.Context, orderID primitive.ObjectID, status models.OrderStatus) error
}

type orderService struct {
	orderRepo      repositories.OrderRepository
	restaurantRepo repositories.RestaurantRepository
	userRepo       repositories.UserRepository
	wsService      WebSocketService
	shipdayClient  *shipday.Client
}

func NewOrderService(
	orderRepo repositories.OrderRepository,
	restaurantRepo repositories.RestaurantRepository,
	userRepo repositories.UserRepository,
	cfg *config.Config,
) OrderService {
	return &orderService{
		orderRepo:      orderRepo,
		restaurantRepo: restaurantRepo,
		userRepo:       userRepo,
		wsService:      NewWebSocketService(),
		 shipdayClient:  shipday.NewClient(cfg),
	}
}

func (s *orderService) FindByShipdayID(ctx context.Context, shipdayID string) (*models.Order, error) {
    // You need a repository method for this
    return s.orderRepo.FindByShipdayID(ctx, shipdayID)
}

func (s *orderService) UpdateOrderStatusFromWebhook(ctx context.Context, orderID primitive.ObjectID, status models.OrderStatus) error {
    // Use the same status update logic but with system actor
    actorID := primitive.NilObjectID
    actorRole := "system"
    err := s.UpdateOrderStatus(ctx, orderID, status, actorID, actorRole)
    if err != nil {
        return err
    }
    return nil
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

	// Calculate delivery fee
	deliveryFee, err := s.CalculateDeliveryFee(ctx, restaurant.Location, deliveryAddress.Location)
	if err != nil {
		return nil, err
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
	order := &models.Order{
		CustomerID:   customerID,
		RestaurantID: restaurantID,
		Items:        orderItems,
		Status:       models.OrderPending,
		TotalAmount:  totalAmount,
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

	// Send WebSocket notification for order creation
	s.wsService.NotifyOrderStatusChange(order)

	return order, nil
}

func (s *orderService) GetOrderByID(ctx context.Context, orderID primitive.ObjectID, userID primitive.ObjectID, userRole string) (*models.Order, error) {
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

	return order, nil
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

	// Update order status
	err = s.orderRepo.UpdateStatus(ctx, orderID, status, actorID, actorRole)
	if err != nil {
		return err
	}

	// Fetch updated order
	updatedOrder, err := s.orderRepo.FindByID(ctx, orderID)
	if err != nil {
		return err
	}

	// Send WebSocket notification
	s.wsService.NotifyOrderStatusChange(updatedOrder)

	// Special handling for picked_up status
	if status == models.OrderPickedUp && updatedOrder.DriverID != nil && !updatedOrder.DriverID.IsZero() {
		driver, err := s.userRepo.FindByID(ctx, *updatedOrder.DriverID)
		if err == nil {
			s.wsService.NotifyDriverAssigned(updatedOrder, driver)
		}
	}

	return nil
}

func (s *orderService) isValidStatusTransition(current, new models.OrderStatus, actorRole string) bool {
	transitions := map[models.OrderStatus]map[string][]models.OrderStatus{
		models.OrderPending: {
			"restaurant": {models.OrderAccepted, models.OrderRejected},
			"customer":   {models.OrderCancelled},
			"admin":      {models.OrderCancelled},
		},
		models.OrderAccepted: {
			"restaurant": {models.OrderPreparing, models.OrderCancelled},
			"driver":     {models.OrderCancelled},
			"admin":      {models.OrderCancelled},
		},
		models.OrderPreparing: {
			"restaurant": {models.OrderReady, models.OrderCancelled},
			"admin":      {models.OrderCancelled},
		},
		models.OrderReady: {
			"driver": {models.OrderPickedUp},
			"admin":  {models.OrderCancelled},
		},
		models.OrderPickedUp: {
			"driver": {models.OrderOnTheWay},
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
	// Check if driver exists and is available
	driver, err := s.userRepo.FindByID(ctx, driverID)
	if err != nil {
		return errors.New("driver not found")
	}

	// Check if driver is available (check if driver role and is active)
	if driver.Role != "driver" {
		return errors.New("user is not a driver")
	}

	// Assuming User model has an IsActive field
	if !driver.IsActive {
		return errors.New("driver is not active")
	}

	// Check if driver already has an active order
	activeOrder, err := s.GetActiveOrderForDriver(ctx, driverID)
	if err == nil && activeOrder != nil {
		return errors.New("driver already has an active order")
	}

	// Assign driver to order
	err = s.orderRepo.AssignDriver(ctx, orderID, driverID)
	if err != nil {
		return err
	}

	// Fetch updated order
	order, err := s.orderRepo.FindByID(ctx, orderID)
	if err != nil {
		return err
	}

	// Update order status to accepted (if it was pending)
	if order.Status == models.OrderPending {
		err = s.orderRepo.UpdateStatus(ctx, orderID, models.OrderAccepted, driverID, "driver")
		if err != nil {
			return err
		}

		// Fetch order again to get updated status
		order, err = s.orderRepo.FindByID(ctx, orderID)
		if err != nil {
			return err
		}
	}

	// Send WebSocket notification
	s.wsService.NotifyDriverAssigned(order, driver)

	return nil
}

func (s *orderService) GetAvailableOrders(ctx context.Context, driverLocation models.GeoLocation, radius float64) ([]models.Order, error) {
	return s.orderRepo.FindAvailableOrders(ctx, driverLocation, radius)
}

func (s *orderService) CancelOrder(ctx context.Context, orderID primitive.ObjectID, userID primitive.ObjectID, userRole, reason string) error {
	order, err := s.orderRepo.FindByID(ctx, orderID)
	if err != nil {
		return err
	}

	// Check if order can be cancelled
	if order.Status == models.OrderDelivered || order.Status == models.OrderCancelled {
		return errors.New("order cannot be cancelled")
	}

	cancellation := models.CancellationInfo{
		Reason:      reason,
		CancelledBy: userID,
		Role:        userRole,
	}

	// Cancel the order
	err = s.orderRepo.CancelOrder(ctx, orderID, cancellation)
	if err != nil {
		return err
	}

	// Update order status to cancelled
	err = s.orderRepo.UpdateStatus(ctx, orderID, models.OrderCancelled, userID, userRole)
	if err != nil {
		return err
	}

	// Fetch updated order
	updatedOrder, err := s.orderRepo.FindByID(ctx, orderID)
	if err != nil {
		return err
	}

	// Send WebSocket notification
	s.wsService.NotifyOrderStatusChange(updatedOrder)

	return nil
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

	return s.orderRepo.AddRating(ctx, orderID, *rating)
}

func (s *orderService) CalculateDeliveryFee(ctx context.Context, restaurantLocation, deliveryLocation models.GeoLocation) (float64, error) {
	// Calculate distance using Haversine formula
	distance := calculateDistance(
		restaurantLocation.Coordinates[1], // lat1
		restaurantLocation.Coordinates[0], // lon1
		deliveryLocation.Coordinates[1],   // lat2
		deliveryLocation.Coordinates[0],   // lon2
	)

	// Base fee + distance fee (in Ethiopian Birr)
	baseFee := 15.0               // 15 Birr base fee
	distanceFee := distance * 2.0 // 2 Birr per km

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

func (s *orderService) UpdateDriverLocation(ctx context.Context, driverID primitive.ObjectID, location models.GeoLocation, orderID string) error {
	// Parse orderID
	orderObjID, err := primitive.ObjectIDFromHex(orderID)
	if err != nil {
		return errors.New("invalid order ID")
	}

	// Get order to verify driver assignment
	order, err := s.orderRepo.FindByID(ctx, orderObjID)
	if err != nil {
		return errors.New("order not found")
	}

	// Check if driver is assigned to this order
	if order.DriverID == nil || *order.DriverID != driverID {
		return errors.New("driver not assigned to this order")
	}

	// Check if order is in a status that allows location updates
	if order.Status != models.OrderPickedUp && order.Status != models.OrderOnTheWay {
		return errors.New("cannot update location for this order status")
	}

	// Update driver location in the order
	// Note: You need to add this method to your OrderRepository
	// err = s.orderRepo.UpdateDriverLocation(ctx, orderObjID, location)
	// if err != nil {
	//     return err
	// }

	// For now, we'll just send the WebSocket notification
	// TODO: Implement UpdateDriverLocation in OrderRepository

	// Send WebSocket notification
	s.wsService.NotifyDriverLocationUpdate(driverID, location, orderID)

	return nil
}

func (s *orderService) GetActiveOrderForDriver(ctx context.Context, driverID primitive.ObjectID) (*models.Order, error) {
	// Get driver's orders with active statuses
	activeStatuses := []models.OrderStatus{
		models.OrderAccepted,
		models.OrderPreparing,
		models.OrderReady,
		models.OrderPickedUp,
		models.OrderOnTheWay,
	}

	orders, _, err := s.orderRepo.FindByDriverID(ctx, driverID, repositories.Pagination{
		Page:  1,
		Limit: 10,
	})
	if err != nil {
		return nil, err
	}

	// Find active order
	for _, order := range orders {
		for _, status := range activeStatuses {
			if order.Status == status {
				return &order, nil
			}
		}
	}

	return nil, nil
}

func (s *orderService) GetOrderByDriverAndStatus(ctx context.Context, driverID primitive.ObjectID, status models.OrderStatus) (*models.Order, error) {
	orders, _, err := s.orderRepo.FindByDriverID(ctx, driverID, repositories.Pagination{
		Page:  1,
		Limit: 10,
	})
	if err != nil {
		return nil, err
	}

	// Find order with specific status
	for _, order := range orders {
		if order.Status == status {
			return &order, nil
		}
	}

	return nil, nil
}
