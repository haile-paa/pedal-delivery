import React from "react";
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

const CartScreen: React.FC = () => {
  const router = useRouter();
  const { state, dispatch } = useAppState();

  const calculateTotal = () => {
    return state.customer.cart.reduce((total, item) => {
      return total + item.menu_item.price * item.quantity;
    }, 0);
  };

  const handleUpdateQuantity = (
    id: string,
    variation: string | undefined,
    newQuantity: number
  ) => {
    if (newQuantity === 0) {
      dispatch({ type: "REMOVE_FROM_CART", payload: { id, variation } });
    } else {
      dispatch({
        type: "UPDATE_CART_QUANTITY",
        payload: { id, variation, quantity: newQuantity },
      });
    }
  };

  const handleRemoveItem = (id: string, variation: string | undefined) => {
    Alert.alert(
      "Remove Item",
      "Are you sure you want to remove this item from your cart?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            dispatch({ type: "REMOVE_FROM_CART", payload: { id, variation } });
          },
        },
      ]
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
      ]
    );
  };

  const handleCheckout = () => {
    if (state.customer.cart.length === 0) {
      Alert.alert("Empty Cart", "Your cart is empty. Add some items first!");
      return;
    }

    router.push("./(customer)/checkout");
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
          {state.customer.cart.map((item) => (
            <SwipeableCard
              key={`${item.id}-${item.variation}`}
              leftAction={renderLeftAction()}
              onSwipeLeft={() => handleRemoveItem(item.id, item.variation)}
            >
              <View style={styles.cartItem}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.menu_item.name}</Text>
                  <Text style={styles.itemPrice}>
                    ${(item.menu_item.price * item.quantity).toFixed(2)}
                  </Text>
                  {item.variation && (
                    <Text style={styles.itemVariation}>
                      Variation: {item.variation}
                    </Text>
                  )}
                  {item.specialInstructions && (
                    <Text style={styles.itemInstructions}>
                      Note: {item.specialInstructions}
                    </Text>
                  )}
                </View>

                <CartCounter
                  count={item.quantity}
                  onIncrement={() =>
                    handleUpdateQuantity(
                      item.id,
                      item.variation,
                      item.quantity + 1
                    )
                  }
                  onDecrement={() =>
                    handleUpdateQuantity(
                      item.id,
                      item.variation,
                      item.quantity - 1
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
            <Text style={styles.summaryValue}>
              ${calculateTotal().toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Delivery Fee</Text>
            <Text style={styles.summaryValue}>$2.99</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax</Text>
            <Text style={styles.summaryValue}>
              ${(calculateTotal() * 0.08).toFixed(2)}
            </Text>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>
              ${(calculateTotal() + 2.99 + calculateTotal() * 0.08).toFixed(2)}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <Text style={styles.footerTotal}>${calculateTotal().toFixed(2)}</Text>
          <Text style={styles.itemCount}>
            {state.customer.cart.length}{" "}
            {state.customer.cart.length === 1 ? "item" : "items"}
          </Text>
        </View>

        <AnimatedButton
          title='Proceed to Checkout'
          onPress={handleCheckout}
          fullWidth
          size='large'
        />
      </View>
    </View>
  );
};

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
