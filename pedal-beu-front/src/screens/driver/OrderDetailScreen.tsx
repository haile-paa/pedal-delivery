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
import { colors } from "../../theme/colors";
import ProgressStepper from "../../components/ui/ProgressStepper";
import AnimatedButton from "../../components/ui/AnimatedButton";
import { useRouter } from "expo-router";

const OrderDetailScreen: React.FC = () => {
  const router = useRouter();
  const [orderStatus, setOrderStatus] = useState("picked_up");
  const [loading, setLoading] = useState(false);

  const orderDetails = {
    id: "ORD001",
    restaurant: "Burger Palace",
    customer: "John Doe",
    address: "123 Main St, New York, NY 10001",
    phone: "+1 (555) 123-4567",
    items: [
      { name: "Classic Cheeseburger", quantity: 2, price: 12.99 },
      { name: "French Fries", quantity: 1, price: 4.99 },
      { name: "Coca-Cola", quantity: 1, price: 2.99 },
    ],
    subtotal: 33.96,
    deliveryFee: 2.99,
    tax: 2.71,
    total: 39.66,
    specialInstructions: "Please ring doorbell twice",
    estimatedDelivery: "7:45 PM",
  };

  const statusSteps = [
    { title: "Accepted", description: "Order accepted" },
    { title: "Pickup", description: "At restaurant" },
    { title: "On The Way", description: "Delivering" },
    { title: "Delivered", description: "Order complete" },
  ];

  const getCurrentStep = () => {
    switch (orderStatus) {
      case "accepted":
        return 0;
      case "at_restaurant":
        return 1;
      case "picked_up":
        return 2;
      case "delivered":
        return 3;
      default:
        return 0;
    }
  };

  const handleStatusUpdate = (newStatus: string) => {
    setLoading(true);

    // Simulate API call
    setTimeout(() => {
      setOrderStatus(newStatus);
      setLoading(false);

      if (newStatus === "delivered") {
        Alert.alert(
          "Order Delivered!",
          "Order marked as delivered successfully.",
          [
            {
              text: "Continue",
              onPress: () => router.push("/(driver)/dashboard"),
            },
          ]
        );
      }
    }, 1500);
  };

  const handleCallCustomer = () => {
    Alert.alert(
      "Call Customer",
      `Call ${orderDetails.customer} at ${orderDetails.phone}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Call",
          onPress: () => {
            // In a real app, this would initiate a phone call
            Alert.alert("Calling", `Connecting to ${orderDetails.customer}...`);
          },
        },
      ]
    );
  };

  const handleNavigate = () => {
    router.push("./(driver)/navigation");
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle='dark-content' backgroundColor={colors.background} />

      <ScrollView style={styles.scrollView}>
        {/* Order Header */}
        <View style={styles.header}>
          <Text style={styles.orderId}>Order #{orderDetails.id}</Text>
          <Text style={styles.restaurantName}>{orderDetails.restaurant}</Text>
          <Text style={styles.estimatedTime}>
            Estimated Delivery: {orderDetails.estimatedDelivery}
          </Text>
        </View>

        {/* Status Tracker */}
        <View style={styles.statusSection}>
          <Text style={styles.sectionTitle}>Delivery Status</Text>
          <ProgressStepper
            steps={statusSteps}
            currentStep={getCurrentStep()}
            showLabels={true}
          />
        </View>

        {/* Customer Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Name</Text>
            <Text style={styles.infoValue}>{orderDetails.customer}</Text>

            <Text style={styles.infoLabel}>Delivery Address</Text>
            <Text style={styles.infoValue}>{orderDetails.address}</Text>

            <Text style={styles.infoLabel}>Phone Number</Text>
            <Text style={styles.infoValue}>{orderDetails.phone}</Text>

            {orderDetails.specialInstructions && (
              <>
                <Text style={styles.infoLabel}>Special Instructions</Text>
                <Text style={[styles.infoValue, styles.specialInstructions]}>
                  {orderDetails.specialInstructions}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Order Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          <View style={styles.itemsCard}>
            {orderDetails.items.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <Text style={styles.itemName}>
                  {item.quantity}x {item.name}
                </Text>
                <Text style={styles.itemPrice}>
                  ${(item.quantity * item.price).toFixed(2)}
                </Text>
              </View>
            ))}

            <View style={styles.divider} />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>
                ${orderDetails.subtotal.toFixed(2)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Delivery Fee</Text>
              <Text style={styles.totalValue}>
                ${orderDetails.deliveryFee.toFixed(2)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax</Text>
              <Text style={styles.totalValue}>
                ${orderDetails.tax.toFixed(2)}
              </Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>
                ${orderDetails.total.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.footer}>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.callButton}
            onPress={handleCallCustomer}
          >
            <Text style={styles.callButtonText}>📞 Call Customer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navigateButton}
            onPress={handleNavigate}
          >
            <Text style={styles.navigateButtonText}>🗺️ Navigate</Text>
          </TouchableOpacity>
        </View>

        {/* Status Update Buttons */}
        {orderStatus === "accepted" && (
          <AnimatedButton
            title='Arrived at Restaurant'
            onPress={() => handleStatusUpdate("at_restaurant")}
            loading={loading}
            fullWidth
          />
        )}

        {orderStatus === "at_restaurant" && (
          <AnimatedButton
            title='Picked Up Order'
            onPress={() => handleStatusUpdate("picked_up")}
            loading={loading}
            fullWidth
          />
        )}

        {orderStatus === "picked_up" && (
          <AnimatedButton
            title='Mark as Delivered'
            onPress={() => handleStatusUpdate("delivered")}
            loading={loading}
            fullWidth
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
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    marginBottom: 20,
  },
  orderId: {
    fontSize: 14,
    color: colors.gray500,
    marginBottom: 4,
  },
  restaurantName: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.gray900,
    marginBottom: 8,
  },
  estimatedTime: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: "600",
  },
  statusSection: {
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.gray800,
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.gray500,
    marginBottom: 4,
    marginTop: 12,
  },
  infoValue: {
    fontSize: 16,
    color: colors.gray800,
    lineHeight: 24,
  },
  specialInstructions: {
    fontStyle: "italic",
    color: colors.primary,
  },
  itemsCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  itemName: {
    fontSize: 16,
    color: colors.gray800,
    flex: 1,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.gray800,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray200,
    marginVertical: 16,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: colors.gray600,
  },
  totalValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray800,
  },
  grandTotalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  grandTotalLabel: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.gray800,
  },
  grandTotalValue: {
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
    paddingHorizontal: 20,
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
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  callButton: {
    flex: 1,
    backgroundColor: colors.info + "10",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.info,
  },
  callButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.info,
  },
  navigateButton: {
    flex: 1,
    backgroundColor: colors.primary + "10",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  navigateButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
  },
});

export default OrderDetailScreen;
