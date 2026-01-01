import React, { useState } from "react";
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
import ProgressStepper from "../../components/ui/ProgressStepper";
import LocationPicker from "../../components/shared/LocationPicker";
import AnimatedButton from "../../components/ui/AnimatedButton";

const CheckoutScreen: React.FC = () => {
  const router = useRouter();
  const { state, dispatch } = useAppState();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [selectedPayment, setSelectedPayment] = useState<string>("credit_card");

  const steps = [
    { title: "Address", description: "Delivery location" },
    { title: "Payment", description: "Payment method" },
    { title: "Review", description: "Confirm order" },
  ];

  const calculateTotal = () => {
    const subtotal = state.customer.cart.reduce((total, item) => {
      return total + item.menuItem.price * item.quantity;
    }, 0);

    const deliveryFee = 2.99;
    const tax = subtotal * 0.08;

    return {
      subtotal: subtotal.toFixed(2),
      deliveryFee: deliveryFee.toFixed(2),
      tax: tax.toFixed(2),
      total: (subtotal + deliveryFee + tax).toFixed(2),
    };
  };

  const handleAddressSelect = (address: any) => {
    setSelectedAddress(address);
    setCurrentStep(2);
  };

  const handlePaymentSelect = (method: string) => {
    setSelectedPayment(method);
    setCurrentStep(3);
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      Alert.alert("Error", "Please select a delivery address");
      return;
    }

    // Simulate order processing
    Alert.alert(
      "Order Placed!",
      "Your order has been placed successfully. You can track it in the orders section.",
      [
        {
          text: "Track Order",
          onPress: () => {
            // Create mock order
            const mockOrder = {
              id: Math.random().toString(36).substr(2, 9),
              restaurantId: "1",
              restaurantName: "Burger Palace",
              items: state.customer.cart.map((item) => ({
                menuItemId: item.id,
                name: item.menuItem.name,
                quantity: item.quantity,
                price: item.menuItem.price,
              })),
              status: "preparing",
              total: parseFloat(calculateTotal().total),
              deliveryAddress: selectedAddress,
              createdAt: new Date(),
              estimatedDelivery: new Date(Date.now() + 30 * 60000),
            };

            dispatch({ type: "ADD_ORDER", payload: mockOrder });
            dispatch({ type: "CLEAR_CART" });

            router.push("./(customer)/order-tracking");
          },
        },
      ]
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Delivery Address</Text>
            <Text style={styles.stepDescription}>
              Where should we deliver your order?
            </Text>

            <LocationPicker
              onLocationSelect={handleAddressSelect}
              recentLocations={state.customer.addresses}
            />
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Payment Method</Text>
            <Text style={styles.stepDescription}>
              How would you like to pay?
            </Text>

            <View style={styles.paymentOptions}>
              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  selectedPayment === "credit_card" &&
                    styles.paymentOptionSelected,
                ]}
                onPress={() => handlePaymentSelect("credit_card")}
              >
                <Text style={styles.paymentOptionText}>💳 Credit Card</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  selectedPayment === "cash" && styles.paymentOptionSelected,
                ]}
                onPress={() => handlePaymentSelect("cash")}
              >
                <Text style={styles.paymentOptionText}>
                  💰 Cash on Delivery
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.paymentOption,
                  selectedPayment === "paypal" && styles.paymentOptionSelected,
                ]}
                onPress={() => handlePaymentSelect("paypal")}
              >
                <Text style={styles.paymentOptionText}>🅿️ PayPal</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Review Order</Text>
            <Text style={styles.stepDescription}>
              Please review your order details
            </Text>

            <View style={styles.orderSummary}>
              <Text style={styles.summaryTitle}>Order Summary</Text>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>
                  ${calculateTotal().subtotal}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery Fee</Text>
                <Text style={styles.summaryValue}>
                  ${calculateTotal().deliveryFee}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tax</Text>
                <Text style={styles.summaryValue}>${calculateTotal().tax}</Text>
              </View>

              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>${calculateTotal().total}</Text>
              </View>
            </View>

            {selectedAddress && (
              <View style={styles.addressSection}>
                <Text style={styles.sectionTitle}>Delivery Address</Text>
                <Text style={styles.addressText}>
                  {selectedAddress.address}
                </Text>
              </View>
            )}

            <View style={styles.paymentSection}>
              <Text style={styles.sectionTitle}>Payment Method</Text>
              <Text style={styles.paymentText}>
                {selectedPayment === "credit_card" && "💳 Credit Card"}
                {selectedPayment === "cash" && "💰 Cash on Delivery"}
                {selectedPayment === "paypal" && "🅿️ PayPal"}
              </Text>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle='dark-content' backgroundColor={colors.background} />

      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Checkout</Text>
        </View>

        <ProgressStepper
          steps={steps}
          currentStep={currentStep}
          showLabels={true}
        />

        {renderStepContent()}
      </ScrollView>

      <View style={styles.footer}>
        {currentStep > 1 && (
          <AnimatedButton
            title='Back'
            onPress={() => setCurrentStep(currentStep - 1)}
            variant='outline'
            style={styles.backButton}
          />
        )}

        {currentStep < 3 ? (
          <AnimatedButton
            title='Continue'
            onPress={() => setCurrentStep(currentStep + 1)}
            style={styles.continueButton}
          />
        ) : (
          <AnimatedButton
            title='Place Order'
            onPress={handlePlaceOrder}
            style={styles.placeOrderButton}
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.gray900,
  },
  stepContent: {
    marginTop: 32,
    marginBottom: 100,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.gray900,
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 16,
    color: colors.gray600,
    marginBottom: 24,
    lineHeight: 24,
  },
  paymentOptions: {
    gap: 12,
  },
  paymentOption: {
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.gray200,
  },
  paymentOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + "10",
  },
  paymentOptionText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.gray800,
  },
  orderSummary: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.gray900,
    marginBottom: 16,
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
  addressSection: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  paymentSection: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.gray700,
    marginBottom: 8,
  },
  addressText: {
    fontSize: 14,
    color: colors.gray600,
    lineHeight: 20,
  },
  paymentText: {
    fontSize: 14,
    color: colors.gray600,
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
    flexDirection: "row",
    gap: 12,
  },
  backButton: {
    flex: 1,
  },
  continueButton: {
    flex: 2,
  },
  placeOrderButton: {
    flex: 1,
  },
});

export default CheckoutScreen;
