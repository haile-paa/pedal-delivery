import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { colors } from "../../theme/colors";
import ProgressStepper from "../../components/ui/ProgressStepper";
import AnimatedButton from "../../components/ui/AnimatedButton";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface OrderDetails {
  id: string;
  order_number: string;
  restaurant: {
    name: string;
    address: string;
    phone?: string;
  };
  customer: {
    name: string;
    phone: string;
  };
  delivery_address: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  delivery_fee: number;
  tax: number;
  total: number;
  special_instructions?: string;
  status: string;
  estimated_delivery?: string;
  created_at: string;
  restaurant_location?: { lat: number; lng: number };
  customer_location?: { lat: number; lng: number };
}

const OrderDetailScreen: React.FC = () => {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const statusSteps = [
    { title: "Accepted", description: "Order accepted" },
    { title: "At Restaurant", description: "Arrived for pickup" },
    { title: "On The Way", description: "Delivering" },
    { title: "Delivered", description: "Order complete" },
  ];

  const getCurrentStep = (status: string) => {
    switch (status) {
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

  useEffect(() => {
    if (orderId) fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("accessToken");
      const response = await fetch(
        `https://pedal-delivery-back.onrender.com/api/v1/orders/${orderId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Failed to fetch order");

      // Map backend response to our OrderDetails shape
      const mapped: OrderDetails = {
        id: data.id,
        order_number: data.order_number,
        restaurant: {
          name: data.restaurant?.name || "Restaurant",
          address: data.restaurant?.address || "",
          phone: data.restaurant?.phone,
        },
        customer: {
          name: data.delivery_info?.contact_name || "Customer",
          phone: data.delivery_info?.contact_phone || "",
        },
        delivery_address: data.delivery_info?.address?.address || "",
        items:
          data.items?.map((i: any) => ({
            name: i.name,
            quantity: i.quantity,
            price: i.price,
            total: i.total,
          })) || [],
        subtotal: data.total_amount?.subtotal || 0,
        delivery_fee: data.total_amount?.delivery_fee || 0,
        tax: data.total_amount?.tax || 0,
        total: data.total_amount?.total || 0,
        special_instructions: data.delivery_info?.notes,
        status: data.status,
        estimated_delivery: data.delivery_info?.estimated_delivery,
        created_at: data.created_at,
        restaurant_location: data.restaurant?.location?.coordinates
          ? {
              lat: data.restaurant.location.coordinates[1],
              lng: data.restaurant.location.coordinates[0],
            }
          : undefined,
        customer_location: data.delivery_info?.address?.location?.coordinates
          ? {
              lat: data.delivery_info.address.location.coordinates[1],
              lng: data.delivery_info.address.location.coordinates[0],
            }
          : undefined,
      };
      setOrder(mapped);
    } catch (error) {
      console.error("Fetch order error:", error);
      Alert.alert("Error", "Could not load order details");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!order) return;
    setUpdating(true);
    try {
      const token = await AsyncStorage.getItem("accessToken");
      const response = await fetch(
        `https://pedal-delivery-back.onrender.com/api/v1/orders/${order.id}/status`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: newStatus }),
        },
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update status");
      }
      setOrder({ ...order, status: newStatus });
      if (newStatus === "delivered") {
        Alert.alert("Order Delivered!", "Order marked as delivered.", [
          { text: "OK", onPress: () => router.push("/(driver)/dashboard") },
        ]);
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleCallCustomer = () => {
    if (order?.customer.phone) {
      Alert.alert("Call Customer", `Call ${order.customer.name}?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Call",
          onPress: () => Alert.alert("Calling", "This would open phone dialer"),
        },
      ]);
    }
  };

  const handleNavigate = () => {
    if (order?.restaurant_location && order?.customer_location) {
      router.push({
        pathname: "/(driver)/navigation" as any,
        params: {
          orderId: order.id,
          restLat: order.restaurant_location.lat,
          restLng: order.restaurant_location.lng,
          custLat: order.customer_location.lat,
          custLng: order.customer_location.lng,
          restaurantName: order.restaurant.name,
          customerAddress: order.delivery_address,
        },
      });
    } else {
      Alert.alert("Navigation", "Location data not available");
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size='large' color={colors.primary} />
        <Text style={styles.loadingText}>Loading order details...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Order not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle='dark-content' backgroundColor={colors.background} />
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.orderId}>Order #{order.order_number}</Text>
          <Text style={styles.restaurantName}>{order.restaurant.name}</Text>
          <Text style={styles.estimatedTime}>
            Est. Delivery:{" "}
            {order.estimated_delivery
              ? new Date(order.estimated_delivery).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "N/A"}
          </Text>
        </View>

        <View style={styles.statusSection}>
          <Text style={styles.sectionTitle}>Delivery Status</Text>
          <ProgressStepper
            steps={statusSteps}
            currentStep={getCurrentStep(order.status)}
            showLabels={true}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Name</Text>
            <Text style={styles.infoValue}>{order.customer.name}</Text>
            <Text style={styles.infoLabel}>Delivery Address</Text>
            <Text style={styles.infoValue}>{order.delivery_address}</Text>
            <Text style={styles.infoLabel}>Phone Number</Text>
            <Text style={styles.infoValue}>{order.customer.phone}</Text>
            {order.special_instructions && (
              <>
                <Text style={styles.infoLabel}>Special Instructions</Text>
                <Text style={[styles.infoValue, styles.specialInstructions]}>
                  {order.special_instructions}
                </Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          <View style={styles.itemsCard}>
            {order.items.map((item, idx) => (
              <View key={idx} style={styles.itemRow}>
                <Text style={styles.itemName}>
                  {item.quantity}x {item.name}
                </Text>
                <Text style={styles.itemPrice}>${item.total.toFixed(2)}</Text>
              </View>
            ))}
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>
                ${order.subtotal.toFixed(2)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Delivery Fee</Text>
              <Text style={styles.totalValue}>
                ${order.delivery_fee.toFixed(2)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax</Text>
              <Text style={styles.totalValue}>${order.tax.toFixed(2)}</Text>
            </View>
            <View style={[styles.totalRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>
                ${order.total.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

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

        {/* Status update buttons based on current status */}
        {order.status === "accepted" && (
          <AnimatedButton
            title='Arrived at Restaurant'
            onPress={() => handleStatusUpdate("at_restaurant")}
            loading={updating}
            fullWidth
          />
        )}
        {order.status === "at_restaurant" && (
          <AnimatedButton
            title='Picked Up Order'
            onPress={() => handleStatusUpdate("picked_up")}
            loading={updating}
            fullWidth
          />
        )}
        {order.status === "picked_up" && (
          <AnimatedButton
            title='Mark as Delivered'
            onPress={() => handleStatusUpdate("delivered")}
            loading={updating}
            fullWidth
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1, paddingHorizontal: 20, paddingBottom: 100 },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    marginBottom: 20,
  },
  orderId: { fontSize: 14, color: colors.gray500, marginBottom: 4 },
  restaurantName: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.gray900,
    marginBottom: 8,
  },
  estimatedTime: { fontSize: 16, color: colors.primary, fontWeight: "600" },
  statusSection: { marginBottom: 24 },
  section: { marginBottom: 24 },
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
    shadowOffset: { width: 0, height: 2 },
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
  infoValue: { fontSize: 16, color: colors.gray800, lineHeight: 24 },
  specialInstructions: { fontStyle: "italic", color: colors.primary },
  itemsCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
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
  itemName: { fontSize: 16, color: colors.gray800, flex: 1 },
  itemPrice: { fontSize: 16, fontWeight: "600", color: colors.gray800 },
  divider: { height: 1, backgroundColor: colors.gray200, marginVertical: 16 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  totalLabel: { fontSize: 14, color: colors.gray600 },
  totalValue: { fontSize: 14, fontWeight: "600", color: colors.gray800 },
  grandTotalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  grandTotalLabel: { fontSize: 18, fontWeight: "bold", color: colors.gray800 },
  grandTotalValue: { fontSize: 20, fontWeight: "bold", color: colors.primary },
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
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  actionButtons: { flexDirection: "row", gap: 12, marginBottom: 16 },
  callButton: {
    flex: 1,
    backgroundColor: colors.info + "10",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.info,
  },
  callButtonText: { fontSize: 14, fontWeight: "600", color: colors.info },
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
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 16, color: colors.gray600 },
  errorContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { fontSize: 18, color: colors.error },
});

export default OrderDetailScreen;
