import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useAppState } from "../../context/AppStateContext";
import { useRouter } from "expo-router";
import { colors } from "../../theme/colors";
import SwipeableCard from "../../components/ui/SwipeableCard";
import CartCounter from "../../components/customer/CartCounter";
import AnimatedButton from "../../components/ui/AnimatedButton";
import CheckoutBottomSheet from "../../components/customer/CheckoutBottomSheet";
import { Restaurant, Order } from "../../types";

const CartScreen: React.FC = () => {
  const router = useRouter();
  const { state, dispatch, actions } = useAppState(); // 👈 added actions

  const [showCheckout, setShowCheckout] = useState(false);
  const [currentRestaurant, setCurrentRestaurant] = useState<Restaurant | null>(
    null,
  );
  const [isLoadingRestaurant, setIsLoadingRestaurant] = useState(false);

  useEffect(() => {
    const findRestaurantForCart = () => {
      if (state.customer.cart.length === 0) {
        setCurrentRestaurant(null);
        return;
      }
      if (state.restaurants.currentRestaurant) {
        setCurrentRestaurant(state.restaurants.currentRestaurant);
        return;
      }
      setCurrentRestaurant(null);
    };
    findRestaurantForCart();
  }, [state.customer.cart, state.restaurants.currentRestaurant]);

  const calculateSubtotal = () => {
    return state.customer.cart.reduce((total, item) => {
      return total + item.menu_item.price * item.quantity;
    }, 0);
  };

  const calculateDeliveryFee = () => {
    if (currentRestaurant && currentRestaurant.delivery_fee !== undefined) {
      return currentRestaurant.delivery_fee;
    }
    return 50.0;
  };

  const calculateServiceCharge = () => {
    const subtotal = calculateSubtotal();
    return subtotal * 0.1;
  };

  const calculateGrandTotal = () => {
    const subtotal = calculateSubtotal();
    const deliveryFee = calculateDeliveryFee();
    const serviceCharge = calculateServiceCharge();
    return subtotal + deliveryFee + serviceCharge;
  };

  const handleUpdateQuantity = (
    id: string,
    newQuantity: number,
    selectedAddonsIds?: string[],
  ) => {
    if (newQuantity === 0) {
      dispatch({
        type: "REMOVE_FROM_CART",
        payload: { id, selectedAddonsIds },
      });
    } else {
      dispatch({
        type: "UPDATE_CART_QUANTITY",
        payload: { id, selectedAddonsIds, quantity: newQuantity },
      });
    }
  };

  const handleRemoveItem = (id: string, selectedAddonsIds?: string[]) => {
    Alert.alert(
      "Remove Item",
      "Are you sure you want to remove this item from your cart?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            dispatch({
              type: "REMOVE_FROM_CART",
              payload: { id, selectedAddonsIds },
            });
          },
        },
      ],
    );
  };

  const handleClearCart = () => {
    if (state.customer.cart.length === 0) return;

    Alert.alert(
      "Clear Cart",
      "Are you sure you want to clear your entire cart?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: () => {
            dispatch({ type: "CLEAR_CART" });
          },
        },
      ],
    );
  };

  const loadRestaurantData = async () => {
    if (state.customer.cart.length === 0) {
      Alert.alert("Empty Cart", "Your cart is empty. Add some items first!");
      return;
    }
    if (currentRestaurant) {
      setShowCheckout(true);
      return;
    }
    if (state.restaurants.currentRestaurant) {
      setCurrentRestaurant(state.restaurants.currentRestaurant);
      setShowCheckout(true);
      return;
    }
    Alert.alert(
      "Restaurant Information Needed",
      "We need restaurant information to proceed with checkout. Please go back to the restaurant page and try again.",
      [
        {
          text: "Go Back",
          onPress: () => router.back(),
        },
        {
          text: "Clear Cart",
          style: "destructive",
          onPress: () => {
            dispatch({ type: "CLEAR_CART" });
            router.back();
          },
        },
      ],
    );
  };

  const handleCheckout = () => {
    loadRestaurantData();
  };

  // ✅ FIXED: now uses the real backend API via actions.createOrder
  const handlePlaceOrder = async (
    paymentMethod: string,
    addressId: string,
  ): Promise<Order> => {
    if (!currentRestaurant) {
      throw new Error("Restaurant information is missing");
    }

    // Prepare payload exactly as backend expects
    const orderData = {
      restaurant_id: currentRestaurant.id,
      items: state.customer.cart.map((item) => ({
        menu_item_id: item.menu_item.id,
        quantity: item.quantity,
        addons: item.selected_addons.map((a) => ({ addon_id: a.id })),
        notes: item.special_instructions || "",
      })),
      address_id: addressId,
      payment_method: paymentMethod,
      notes: "",
    };

    // Call the real API through the context action
    const createdOrder = await actions.createOrder(orderData);

    // Clear cart (already done inside createOrder, but safe to do again)
    dispatch({ type: "CLEAR_CART" });
    setShowCheckout(false);

    // Navigate to the tracking screen with the real order ID
    router.push({
      pathname: "/(customer)/order-traking",
      params: {
        orderId: createdOrder.id,
        restaurantName: currentRestaurant.name,
      },
    });

    return createdOrder;
  };

  const renderLeftAction = () => (
    <View style={styles.leftAction}>
      <Text style={styles.actionText}>Remove</Text>
    </View>
  );

  if (state.customer.cart.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <StatusBar
          barStyle='dark-content'
          backgroundColor={colors.background}
        />
        <View style={styles.emptyContent}>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>
            Add delicious food from restaurants to get started!
          </Text>
          <AnimatedButton
            title='Browse Restaurants'
            onPress={() => router.back()}
            style={styles.browseButton}
          />
        </View>
      </View>
    );
  }

  const subtotal = calculateSubtotal();
  const deliveryFee = calculateDeliveryFee();
  const serviceCharge = calculateServiceCharge();
  const grandTotal = calculateGrandTotal();

  return (
    <View style={styles.container}>
      <StatusBar barStyle='dark-content' backgroundColor={colors.background} />

      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Your Cart</Text>
          <TouchableOpacity onPress={handleClearCart}>
            <Text style={styles.clearButton}>Clear All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cartItems}>
          {state.customer.cart.map((item, index) => (
            <SwipeableCard
              key={`${item.id}-${index}`}
              leftAction={renderLeftAction()}
              onSwipeLeft={() =>
                handleRemoveItem(
                  item.id,
                  item.selected_addons?.map((a) => a.id),
                )
              }
            >
              <View style={styles.cartItem}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.menu_item.name}</Text>
                  <Text style={styles.itemPrice}>
                    {(item.menu_item.price * item.quantity).toFixed(2)}Birr
                  </Text>
                  {item.special_instructions && (
                    <Text style={styles.itemInstructions}>
                      Note: {item.special_instructions}
                    </Text>
                  )}
                  {item.selected_addons && item.selected_addons.length > 0 && (
                    <Text style={styles.itemVariation}>
                      Add-ons:{" "}
                      {item.selected_addons.map((a) => a.name).join(", ")}
                    </Text>
                  )}
                </View>
                <CartCounter
                  count={item.quantity}
                  onIncrement={() =>
                    handleUpdateQuantity(
                      item.id,
                      item.quantity + 1,
                      item.selected_addons?.map((a) => a.id),
                    )
                  }
                  onDecrement={() =>
                    handleUpdateQuantity(
                      item.id,
                      item.quantity - 1,
                      item.selected_addons?.map((a) => a.id),
                    )
                  }
                />
              </View>
            </SwipeableCard>
          ))}
        </View>

        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{subtotal.toFixed(2)}Birr</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery Fee</Text>
            <Text style={styles.summaryValue}>
              {deliveryFee.toFixed(2)}Birr
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Service Charge (10%)</Text>
            <Text style={styles.summaryValue}>
              {serviceCharge.toFixed(2)}Birr
            </Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{grandTotal.toFixed(2)}Birr</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <Text style={styles.footerTotal}>{grandTotal.toFixed(2)}Birr</Text>
          <Text style={styles.itemCount}>
            {state.customer.cart.reduce(
              (total, item) => total + item.quantity,
              0,
            )}{" "}
            {state.customer.cart.reduce(
              (total, item) => total + item.quantity,
              0,
            ) === 1
              ? "item"
              : "items"}
          </Text>
        </View>
        <AnimatedButton
          title={isLoadingRestaurant ? "Loading..." : "Proceed to Checkout"}
          onPress={handleCheckout}
          fullWidth
          size='large'
          disabled={isLoadingRestaurant}
        />
      </View>

      {currentRestaurant && (
        <CheckoutBottomSheet
          visible={showCheckout}
          onClose={() => setShowCheckout(false)}
          restaurant={currentRestaurant}
          cartItems={state.customer.cart}
          cartTotal={subtotal}
          deliveryFee={deliveryFee}
          serviceCharge={serviceCharge}
          grandTotal={grandTotal}
          onPlaceOrder={handlePlaceOrder} // ✅ now expects (paymentMethod, addressId)
        />
      )}
    </View>
  );
};

// ---- styles remain exactly as before ----
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyContent: {
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.gray800,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: colors.gray600,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  browseButton: {
    minWidth: 200,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.gray900,
  },
  clearButton: {
    fontSize: 16,
    color: colors.error,
    fontWeight: "600",
  },
  cartItems: {
    marginBottom: 24,
  },
  cartItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.gray800,
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "600",
    marginBottom: 2,
  },
  itemVariation: {
    fontSize: 12,
    color: colors.gray600,
    marginBottom: 2,
  },
  itemInstructions: {
    fontSize: 12,
    color: colors.gray500,
    fontStyle: "italic",
  },
  leftAction: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.error,
    borderRadius: 16,
  },
  actionText: {
    color: colors.white,
    fontWeight: "bold",
  },
  summarySection: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 100,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 16,
    color: colors.gray600,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.gray800,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    paddingTop: 12,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.gray800,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.primary,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  footerTotal: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.primary,
  },
  itemCount: {
    fontSize: 14,
    color: colors.gray600,
  },
});

export default CartScreen;
