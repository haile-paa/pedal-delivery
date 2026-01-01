import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme/colors";
import TrackingMap from "../../src/components/customer/TrackingMap";

const OrderTrackingPage: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [estimatedDeliveryTime, setEstimatedDeliveryTime] = useState(25);

  // Mock data - in a real app, you would fetch this from an API
  const mockOrder = {
    id: "ORD-123456",
    restaurant: "Burger Palace",
    restaurantLocation: { latitude: 8.9862, longitude: 38.7614 },
    driver: {
      name: "Haile",
      vehicle: "Motorcycle",
      plate: "3A-1234",
      location: { latitude: 8.9806, longitude: 38.7578 },
    },
    userLocation: { latitude: 9.0054, longitude: 38.7636 },
    status: "on_the_way",
    items: [
      { name: "Classic Cheeseburger", quantity: 2, price: 12.99 },
      { name: "French Fries", quantity: 1, price: 4.99 },
    ],
    total: 30.97,
    deliveryAddress: "Bole Road, Addis Ababa",
    orderTime: "14:30",
    estimatedDelivery: "15:00",
  };

  useEffect(() => {
    // Simulate loading order data
    const timer = setTimeout(() => {
      setOrder(mockOrder);
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

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
        <Ionicons name='alert-circle-outline' size={64} color={colors.error} />
        <Text style={styles.errorText}>Order not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Generate route coordinates (in real app, this would come from a routing API)
  const routeCoordinates = [
    order.restaurantLocation,
    { latitude: 8.988, longitude: 38.759 },
    { latitude: 8.992, longitude: 38.761 },
    { latitude: 8.998, longitude: 38.762 },
    order.userLocation,
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButtonHeader}
          onPress={() => router.back()}
        >
          <Ionicons name='arrow-back' size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Tracking</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Order Info Card */}
        <View style={styles.orderInfoCard}>
          <View style={styles.orderHeader}>
            <View>
              <Text style={styles.orderNumber}>{order.id}</Text>
              <Text style={styles.restaurantName}>{order.restaurant}</Text>
            </View>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>On the way</Text>
            </View>
          </View>

          <View style={styles.timeInfo}>
            <View style={styles.timeItem}>
              <Ionicons name='time-outline' size={20} color={colors.gray600} />
              <Text style={styles.timeLabel}>Order Time</Text>
              <Text style={styles.timeValue}>{order.orderTime}</Text>
            </View>
            <View style={styles.timeItem}>
              <Ionicons name='timer-outline' size={20} color={colors.gray600} />
              <Text style={styles.timeLabel}>Est. Delivery</Text>
              <Text style={styles.timeValue}>{order.estimatedDelivery}</Text>
            </View>
          </View>

          <View style={styles.deliveryAddress}>
            <Ionicons
              name='location-outline'
              size={20}
              color={colors.gray600}
            />
            <Text style={styles.addressText}>
              Delivering to: {order.deliveryAddress}
            </Text>
          </View>
        </View>

        {/* Tracking Map */}
        <View style={styles.mapContainer}>
          <TrackingMap
            driverLocation={order.driver.location}
            userLocation={order.userLocation}
            restaurantLocation={order.restaurantLocation}
            routeCoordinates={routeCoordinates}
          />
        </View>

        {/* Driver Info */}
        <View style={styles.driverCard}>
          <View style={styles.driverHeader}>
            <Ionicons name='bicycle-outline' size={24} color={colors.primary} />
            <Text style={styles.driverTitle}>Your Driver</Text>
          </View>

          <View style={styles.driverInfo}>
            <View style={styles.driverAvatar}>
              <Ionicons name='person' size={32} color={colors.white} />
            </View>
            <View style={styles.driverDetails}>
              <Text style={styles.driverName}>{order.driver.name}</Text>
              <Text style={styles.driverVehicle}>
                {order.driver.vehicle} • {order.driver.plate}
              </Text>
              <Text style={styles.driverStatus}>On the way to you</Text>
            </View>
            <TouchableOpacity style={styles.callButton}>
              <Ionicons name='call' size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Order Items */}
        <View style={styles.itemsCard}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          {order.items.map((item: any, index: number) => (
            <View key={index} style={styles.itemRow}>
              <Text style={styles.itemName}>
                {item.quantity}x {item.name}
              </Text>
              <Text style={styles.itemPrice}>
                {(item.quantity * item.price).toFixed(2)}Birr
              </Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>{order.total}Birr</Text>
          </View>
        </View>

        {/* Progress Timeline */}
        <View style={styles.timelineCard}>
          <Text style={styles.sectionTitle}>Order Status</Text>

          <View style={styles.timeline}>
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, styles.activeDot]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Order Placed</Text>
                <Text style={styles.timelineTime}>14:30</Text>
              </View>
            </View>

            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, styles.activeDot]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Order Confirmed</Text>
                <Text style={styles.timelineTime}>14:32</Text>
              </View>
            </View>

            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, styles.activeDot]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Food Preparing</Text>
                <Text style={styles.timelineTime}>14:35</Text>
              </View>
            </View>

            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, styles.activeDot]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Picked Up by Driver</Text>
                <Text style={styles.timelineTime}>14:50</Text>
              </View>
            </View>

            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, styles.currentDot]} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>On the Way</Text>
                <Text style={styles.timelineTime}>Now</Text>
              </View>
            </View>

            <View style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineTitle}>Delivered</Text>
                <Text style={styles.timelineTime}>Est. 15:00</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Help Section */}
        <View style={styles.helpCard}>
          <Text style={styles.sectionTitle}>Need Help?</Text>
          <View style={styles.helpButtons}>
            <TouchableOpacity style={styles.helpButton}>
              <Ionicons
                name='chatbubble-outline'
                size={20}
                color={colors.primary}
              />
              <Text style={styles.helpButtonText}>Chat with Driver</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.helpButton}>
              <Ionicons
                name='help-circle-outline'
                size={20}
                color={colors.primary}
              />
              <Text style={styles.helpButtonText}>Contact Support</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  orderInfoCard: {
    backgroundColor: colors.white,
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  orderNumber: {
    fontSize: 14,
    color: colors.gray600,
    marginBottom: 4,
  },
  restaurantName: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.gray900,
  },
  statusBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },
  timeInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  timeItem: {
    alignItems: "center",
  },
  timeLabel: {
    fontSize: 12,
    color: colors.gray600,
    marginTop: 4,
    marginBottom: 2,
  },
  timeValue: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.gray900,
  },
  deliveryAddress: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.gray50,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  addressText: {
    fontSize: 14,
    color: colors.gray700,
    flex: 1,
  },
  mapContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: "hidden",
    height: 300,
  },
  driverCard: {
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  driverHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  driverTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.gray900,
  },
  driverInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  driverAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.gray900,
    marginBottom: 4,
  },
  driverVehicle: {
    fontSize: 14,
    color: colors.gray600,
    marginBottom: 4,
  },
  driverStatus: {
    fontSize: 12,
    color: colors.success,
    fontWeight: "500",
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
    alignItems: "center",
  },
  itemsCard: {
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.gray900,
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  itemName: {
    fontSize: 14,
    color: colors.gray700,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray900,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray200,
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.gray900,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.primary,
  },
  timelineCard: {
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  timeline: {
    marginLeft: 12,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
    position: "relative",
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.gray300,
    marginTop: 4,
    marginRight: 16,
    position: "relative",
    zIndex: 1,
  },
  activeDot: {
    backgroundColor: colors.success,
  },
  currentDot: {
    backgroundColor: colors.primary,
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.gray800,
    marginBottom: 2,
  },
  timelineTime: {
    fontSize: 12,
    color: colors.gray600,
  },
  helpCard: {
    backgroundColor: colors.white,
    marginHorizontal: 16,
    marginBottom: 32,
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  helpButtons: {
    flexDirection: "row",
    gap: 12,
  },
  helpButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  helpButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.primary,
  },
});

export default OrderTrackingPage;
