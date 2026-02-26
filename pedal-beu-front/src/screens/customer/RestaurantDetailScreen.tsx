import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from "react-native";
import { useAppState } from "../../context/AppStateContext";
import { colors } from "../../theme/colors";
import { Restaurant, MenuItem, CartItem, OrderStatus } from "../../types";
import CategoryFilter from "../../components/customer/CategoryFilter";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import CheckoutBottomSheet from "../../components/customer/CheckoutBottomSheet";
import { restaurantAPI } from "../../../lib/restaurant";

const RestaurantDetailScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const restaurantId = params.id as string;

  const { state, dispatch } = useAppState();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);

  useEffect(() => {
    loadRestaurantDetails();
  }, [restaurantId]);

  const loadRestaurantDetails = async () => {
    setLoading(true);
    try {
      const restaurantResponse = await restaurantAPI.getById(restaurantId);
      if (!restaurantResponse.success || !restaurantResponse.data) {
        Alert.alert(
          "Error",
          restaurantResponse.error || "Restaurant not found",
        );
        router.back();
        return;
      }

      const restaurantData = restaurantResponse.data;
      setRestaurant(restaurantData);

      const menuResponse = await restaurantAPI.getMenu(restaurantId);
      if (menuResponse.success && Array.isArray(menuResponse.data)) {
        const menuData = menuResponse.data;
        setMenuItems(menuData);

        const uniqueCategories = ["All"];
        menuData.forEach((item) => {
          if (item.category && !uniqueCategories.includes(item.category)) {
            uniqueCategories.push(item.category);
          }
        });
        setCategories(uniqueCategories);
      } else {
        setMenuItems([]);
        setCategories(["All"]);
      }
    } catch (error) {
      console.error("Error loading restaurant:", error);
      Alert.alert("Error", "Failed to load restaurant details");
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = menuItems.filter(
    (item) => selectedCategory === "All" || item.category === selectedCategory,
  );

  const handleAddToCart = (menuItem: MenuItem) => {
    const existingItem = state.customer.cart.find(
      (item) => item.menu_item.id === menuItem.id,
    );

    if (existingItem) {
      dispatch({
        type: "UPDATE_CART_QUANTITY",
        payload: {
          id: existingItem.id,
          quantity: existingItem.quantity + 1,
        },
      });
    } else {
      const cartItem: CartItem = {
        id: `${menuItem.id}-${Date.now()}`,
        menu_item: menuItem,
        quantity: 1,
        selected_addons: [],
        special_instructions: "",
      };

      dispatch({ type: "ADD_TO_CART", payload: cartItem });
    }
  };

  const updateCartItemQuantity = (itemId: string, newQuantity: number) => {
    const cartItem = state.customer.cart.find(
      (item) => item.menu_item.id === itemId,
    );

    if (!cartItem) return;

    if (newQuantity > 0) {
      dispatch({
        type: "UPDATE_CART_QUANTITY",
        payload: {
          id: cartItem.id,
          quantity: newQuantity,
        },
      });
    } else {
      dispatch({
        type: "REMOVE_FROM_CART",
        payload: { id: cartItem.id },
      });
    }
  };

  const getCartCount = () => {
    return state.customer.cart.reduce(
      (total, item) => total + item.quantity,
      0,
    );
  };

  const getCartTotal = () => {
    return state.customer.cart.reduce((total, item) => {
      const itemTotal = item.menu_item.price * item.quantity;
      const addonsTotal =
        item.selected_addons.reduce((sum, addon) => sum + addon.price, 0) *
        item.quantity;
      return total + itemTotal + addonsTotal;
    }, 0);
  };

  const handleCheckout = () => {
    if (!restaurant) return;

    if (!state.auth.user) {
      Alert.alert("Login Required", "Please log in to place an order", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Login",
          onPress: () => router.push("/login"),
        },
      ]);
      return;
    }

    if (state.customer.cart.length === 0) {
      Alert.alert("Empty Cart", "Please add items to your cart first");
      return;
    }

    const cartTotal = getCartTotal();
    if (restaurant.min_order && cartTotal < restaurant.min_order) {
      Alert.alert(
        "Minimum Order Required",
        `Minimum order for this restaurant is ${
          restaurant.min_order
        }Birr. Please add ${(restaurant.min_order - cartTotal).toFixed(
          2,
        )}Birr more.`,
      );
      return;
    }

    setShowCheckout(true);
  };

  const handlePlaceOrder = (paymentMethod: string) => {
    if (!restaurant) return;

    setShowCheckout(false);

    const cartTotal = getCartTotal();
    const deliveryFee = restaurant.delivery_fee || 0;
    const serviceCharge = cartTotal * 0.1;
    const grandTotal = cartTotal + deliveryFee + serviceCharge;

    // Ensure coordinates are a tuple [number, number]
    const getCoordinates = (coords: number[] | undefined): [number, number] => {
      if (Array.isArray(coords) && coords.length >= 2) {
        return [coords[0], coords[1]];
      }
      return [0, 0];
    };

    const order = {
      id: `order-${Date.now()}`,
      order_number: `ORD-${Date.now()}`,
      customer_id: state.auth.user?.id || "",
      restaurant_id: restaurant.id,
      items: state.customer.cart.map((item) => ({
        menu_item_id: item.menu_item.id,
        name: item.menu_item.name,
        quantity: item.quantity,
        price: item.menu_item.price,
        addons: item.selected_addons.map((addon) => ({
          addon_id: addon.id,
          name: addon.name,
          price: addon.price,
        })),
        total: item.menu_item.price * item.quantity,
        notes: item.special_instructions || "",
      })),
      status: "pending" as OrderStatus,
      total_amount: {
        subtotal: cartTotal,
        delivery_fee: deliveryFee,
        service_charge: serviceCharge,
        discount: 0,
        tax: cartTotal * 0.08,
        total: grandTotal,
      },
      delivery_info: {
        address: {
          id: selectedAddress?.id || "temp-address",
          label: selectedAddress?.label || "Delivery Address",
          address: selectedAddress?.address || restaurant.address,
          location: {
            type: "Point" as const,
            coordinates: selectedAddress?.location?.coordinates
              ? getCoordinates(selectedAddress.location.coordinates)
              : getCoordinates(restaurant.location?.coordinates),
          },
          is_default: false,
          created_at: new Date().toISOString(),
        },
        notes: "",
        contact_name: state.auth.user?.profile?.first_name || "Customer",
        contact_phone: state.auth.user?.phone || "",
        estimated_delivery: new Date(Date.now() + 45 * 60000).toISOString(),
      },
      timeline: [
        {
          status: "pending" as OrderStatus,
          timestamp: new Date().toISOString(),
          actor_id: state.auth.user?.id,
          actor_type: "customer" as const,
          notes: "Order placed",
        },
      ],
      payment_method: paymentMethod,
      payment_status: (paymentMethod === "cash" ? "pending" : "paid") as
        | "pending"
        | "paid",
      is_scheduled: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    dispatch({ type: "ADD_ORDER", payload: order });
    dispatch({ type: "CLEAR_CART" });

    router.push({
      pathname: "/(customer)/order-tracking" as any,
      params: {
        orderId: order.id,
        restaurantName: restaurant.name,
      },
    });
  };

  const handleAddressChange = () => {
    setShowCheckout(false);
    router.push("/address-selection" as any);
  };

  const getItemQuantity = (itemId: string) => {
    const cartItem = state.customer.cart.find(
      (item) => item.menu_item.id === itemId,
    );
    return cartItem ? cartItem.quantity : 0;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size='large' color={colors.primary} />
        <Text style={styles.loadingText}>Loading restaurant details...</Text>
      </View>
    );
  }

  if (!restaurant) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name='error-outline' size={64} color={colors.error} />
        <Text style={styles.errorText}>Restaurant not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name='arrow-back' size={20} color={colors.white} />
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const cartCount = getCartCount();
  const cartTotal = getCartTotal();
  const deliveryFee = restaurant.delivery_fee || 0;
  const serviceCharge = cartTotal * 0.1;
  const grandTotal = cartTotal + deliveryFee + serviceCharge;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle='light-content' backgroundColor={colors.primary} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButtonHeader}
          onPress={() => router.back()}
        >
          <Ionicons name='arrow-back' size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{restaurant.name}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView}>
        <Image
          source={{
            uri:
              restaurant.images && restaurant.images.length > 0
                ? restaurant.images[0]
                : "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500",
          }}
          style={styles.restaurantImage}
        />

        <View style={styles.infoCard}>
          <View style={styles.restaurantHeader}>
            <View>
              <Text style={styles.restaurantName}>{restaurant.name}</Text>
              <View style={styles.ratingContainer}>
                <Ionicons name='star' size={16} color={colors.warning} />
                <Text style={styles.ratingText}>
                  {restaurant.rating.toFixed(1)}
                </Text>
                <Text style={styles.dot}>•</Text>
                <Text style={styles.deliveryTime}>
                  {restaurant.delivery_time} min
                </Text>
                <Text style={styles.dot}>•</Text>
                <Text style={styles.deliveryFee}>
                  {restaurant.delivery_fee.toFixed(2)}Birr delivery fee
                </Text>
              </View>
            </View>
            <View style={styles.statusBadge}>
              <View style={styles.statusIndicator} />
              <Text style={styles.statusText}>
                {restaurant.is_active ? "Open now" : "Closed"}
              </Text>
            </View>
          </View>

          <Text style={styles.description}>{restaurant.description}</Text>

          <View style={styles.addressContainer}>
            <Ionicons
              name='location-outline'
              size={20}
              color={colors.gray600}
            />
            <Text style={styles.addressText}>{restaurant.address}</Text>
          </View>

          <View style={styles.hoursContainer}>
            <Ionicons name='time-outline' size={20} color={colors.gray600} />
            <Text style={styles.hoursText}>
              {restaurant.cuisine_type?.join(", ") || "Various cuisines"}
            </Text>
          </View>
        </View>

        {categories.length > 1 && (
          <View style={styles.categoriesContainer}>
            <CategoryFilter
              categories={categories}
              selectedCategory={selectedCategory}
              onCategorySelect={setSelectedCategory}
            />
          </View>
        )}

        <View style={styles.menuContainer}>
          <Text style={styles.menuTitle}>Menu</Text>
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => {
              const quantity = getItemQuantity(item.id);
              return (
                <View key={item.id} style={styles.menuItemCard}>
                  {item.image && (
                    <Image
                      source={{ uri: item.image }}
                      style={styles.menuItemImage}
                    />
                  )}
                  <View style={styles.menuItemInfo}>
                    <Text style={styles.menuItemName}>{item.name}</Text>
                    <Text style={styles.menuItemDescription}>
                      {item.description}
                    </Text>
                    <Text style={styles.menuItemPrice}>
                      {item.price.toFixed(2)}Birr
                    </Text>

                    {quantity > 0 ? (
                      <View style={styles.quantityControls}>
                        <TouchableOpacity
                          style={styles.quantityButton}
                          onPress={() =>
                            updateCartItemQuantity(item.id, quantity - 1)
                          }
                        >
                          <Text style={styles.quantityButtonText}>-</Text>
                        </TouchableOpacity>
                        <Text style={styles.quantityText}>{quantity}</Text>
                        <TouchableOpacity
                          style={styles.quantityButton}
                          onPress={() =>
                            updateCartItemQuantity(item.id, quantity + 1)
                          }
                        >
                          <Text style={styles.quantityButtonText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[
                          styles.addButton,
                          !item.is_available && styles.addButtonDisabled,
                        ]}
                        onPress={() => handleAddToCart(item)}
                        disabled={!item.is_available}
                      >
                        <Text style={styles.addButtonText}>
                          {item.is_available ? "Add" : "Unavailable"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyMenu}>
              <Ionicons
                name='fast-food-outline'
                size={64}
                color={colors.gray400}
              />
              <Text style={styles.emptyMenuText}>No menu items available</Text>
              <Text style={styles.emptyMenuSubtext}>
                Check back later for menu updates
              </Text>
            </View>
          )}
        </View>

        <View style={styles.spacer} />
      </ScrollView>

      {cartCount > 0 && (
        <View style={styles.checkoutBar}>
          <View style={styles.cartInfo}>
            <Text style={styles.cartCount}>{cartCount} items</Text>
            <Text style={styles.cartTotal}>
              {grandTotal.toFixed(2)}Birr Total
            </Text>
          </View>
          <TouchableOpacity
            style={styles.checkoutButton}
            onPress={handleCheckout}
          >
            <Text style={styles.checkoutButtonText}>Go to Checkout</Text>
            <Ionicons name='arrow-forward' size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
      )}

      <CheckoutBottomSheet
        visible={showCheckout}
        onClose={() => setShowCheckout(false)}
        restaurant={restaurant}
        cartItems={state.customer.cart}
        cartTotal={cartTotal}
        deliveryFee={deliveryFee}
        serviceCharge={serviceCharge}
        grandTotal={grandTotal}
        onPlaceOrder={handlePlaceOrder}
        address={selectedAddress}
        onAddressChange={handleAddressChange}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.gray600,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    padding: 20,
  },
  errorText: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.error,
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  backButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButtonHeader: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.white,
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  restaurantImage: {
    width: "100%",
    height: 200,
  },
  infoCard: {
    backgroundColor: colors.white,
    padding: 20,
    marginHorizontal: 16,
    marginTop: -20,
    borderRadius: 16,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  restaurantHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  restaurantName: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.gray900,
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray800,
  },
  dot: {
    fontSize: 14,
    color: colors.gray500,
    marginHorizontal: 2,
  },
  deliveryTime: {
    fontSize: 14,
    color: colors.gray600,
  },
  deliveryFee: {
    fontSize: 14,
    color: colors.gray600,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.successLight || "#D1FAE5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.success,
  },
  description: {
    fontSize: 14,
    color: colors.gray600,
    lineHeight: 20,
    marginBottom: 16,
  },
  addressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  addressText: {
    fontSize: 14,
    color: colors.gray700,
    flex: 1,
  },
  hoursContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  hoursText: {
    fontSize: 14,
    color: colors.gray700,
  },
  categoriesContainer: {
    backgroundColor: colors.white,
    paddingVertical: 12,
    marginTop: 16,
  },
  menuContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.gray900,
    marginBottom: 16,
  },
  menuItemCard: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  menuItemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  menuItemInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "space-between",
  },
  menuItemName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.gray900,
    marginBottom: 4,
  },
  menuItemDescription: {
    fontSize: 12,
    color: colors.gray600,
    marginBottom: 8,
    lineHeight: 16,
  },
  menuItemPrice: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: 8,
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primaryLight,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  quantityButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  quantityButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.white,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
    marginHorizontal: 12,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  addButtonDisabled: {
    backgroundColor: colors.gray400,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  addButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "600",
  },
  emptyMenu: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyMenuText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.gray700,
    marginTop: 12,
    marginBottom: 4,
  },
  emptyMenuSubtext: {
    fontSize: 14,
    color: colors.gray500,
    textAlign: "center",
  },
  spacer: {
    height: 100,
  },
  checkoutBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cartInfo: {
    flex: 1,
  },
  cartCount: {
    fontSize: 14,
    color: colors.gray600,
    marginBottom: 2,
  },
  cartTotal: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.gray900,
  },
  checkoutButton: {
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  checkoutButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "bold",
  },
});

export default RestaurantDetailScreen;
