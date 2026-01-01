import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Image,
  Platform,
  AppState,
  ActivityIndicator,
  Linking,
  type AppStateStatus,
} from "react-native";
import { colors } from "../../theme/colors";
import { useRouter } from "expo-router";
import WebSocketService from "../../services/websocket.service";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

interface Order {
  id: string;
  orderId: string;
  restaurant: {
    id: string;
    name: string;
    address: string;
    image?: string;
    rating: number;
  };
  customer: {
    id: string;
    name: string;
    phone: string;
    location: {
      latitude: number;
      longitude: number;
    };
  };
  amount: number;
  distance: string;
  items: Array<{
    name: string;
    quantity: number;
  }>;
  itemsCount: number;
  estimatedPreparationTime: number;
  estimatedDeliveryTime: string;
  specialInstructions?: string;
  createdAt: string;
  restaurantLocation: {
    latitude: number;
    longitude: number;
  };
  customerLocation: {
    latitude: number;
    longitude: number;
  };
  paymentMethod: string;
}

interface DriverStats {
  totalDeliveries: number;
  averageRating: number;
  averageEarnings: number;
  averageTime: number;
  acceptanceRate: number;
}

const AvailableOrdersScreen: React.FC = () => {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [driverLocation, setDriverLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [driverStats, setDriverStats] = useState<DriverStats>({
    totalDeliveries: 0,
    averageRating: 0,
    averageEarnings: 0,
    averageTime: 0,
    acceptanceRate: 0,
  });
  const [isOnline, setIsOnline] = useState(true);
  const [activeFilters, setActiveFilters] = useState({
    nearby: true,
    highValue: false,
    quickDelivery: false,
    all: false,
  });
  const [loading, setLoading] = useState(true);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    initializeDriver();

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      subscription.remove();
      WebSocketService.disconnect();
    };
  }, []);

  const initializeDriver = async () => {
    try {
      setLoading(true);

      // Get driver location
      await getDriverLocation();

      // Connect to WebSocket
      await connectWebSocket();

      // Fetch available orders
      await fetchAvailableOrders();

      // Fetch driver stats
      await fetchDriverStats();
    } catch (error) {
      console.error("Initialization error:", error);
      Alert.alert("Error", "Failed to initialize driver app");
    } finally {
      setLoading(false);
    }
  };

  const getDriverLocation = async () => {
    return new Promise<void>((resolve) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setDriverLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });

            // Store driver location for WebSocket
            const updateLocation = async () => {
              const token = await AsyncStorage.getItem("driverToken");
              if (token) {
                WebSocketService.updateDriverLocation(
                  {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                  },
                  "driver"
                );
              }
            };
            updateLocation();
            resolve();
          },
          (error) => {
            console.error("Location error:", error);
            resolve(); // Continue without location
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
      } else {
        resolve(); // Continue without location
      }
    });
  };

  const connectWebSocket = async () => {
    try {
      const token = await AsyncStorage.getItem("driverToken");

      WebSocketService.connect(token || "");

      WebSocketService.on("connect", () => {
        console.log("Driver WebSocket connected");
        setIsOnline(true);
      });

      WebSocketService.on("disconnect", () => {
        console.log("Driver WebSocket disconnected");
        setIsOnline(false);
      });

      WebSocketService.on("order:new", handleNewOrder);
      WebSocketService.on("order:cancelled", handleOrderCancelled);
      WebSocketService.on("order:taken", handleOrderTaken);
    } catch (error) {
      console.error("WebSocket connection error:", error);
    }
  };

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    const isComingToForeground =
      (appState.current === "inactive" || appState.current === "background") &&
      nextAppState === "active";

    const isGoingToBackground =
      nextAppState === "inactive" || nextAppState === "background";

    if (isComingToForeground) {
      // App came to foreground
      initializeDriver();
    } else if (isGoingToBackground) {
      // App went to background
      WebSocketService.disconnect();
    }

    appState.current = nextAppState;
  };

  const handleNewOrder = (order: Order) => {
    setAvailableOrders((prev) => {
      // Check if order already exists
      if (prev.some((o) => o.id === order.id)) {
        return prev;
      }

      // Add new order to the beginning
      return [order, ...prev];
    });

    // Show notification
    Alert.alert(
      "🎉 New Order Available!",
      `New order from ${order.restaurant.name} for ${order.amount.toFixed(
        2
      )} Birr`,
      [
        {
          text: "Ignore",
          style: "cancel",
        },
        {
          text: "View",
          onPress: () => {
            // Scroll to the new order
            setTimeout(() => {
              // You could add animation or scroll logic here
            }, 100);
          },
        },
      ]
    );
  };

  const handleOrderCancelled = (data: { orderId: string }) => {
    setAvailableOrders((prev) =>
      prev.filter((order) => order.id !== data.orderId)
    );
  };

  const handleOrderTaken = async (data: {
    orderId: string;
    driverId: string;
  }) => {
    // If another driver took the order, remove it from available list
    const driverId = await AsyncStorage.getItem("driverId");
    if (data.driverId !== driverId) {
      setAvailableOrders((prev) =>
        prev.filter((order) => order.id !== data.orderId)
      );
    }
  };

  const fetchAvailableOrders = async () => {
    try {
      const token = await AsyncStorage.getItem("driverToken");
      const response = await fetch(
        "http://192.168.1.3:8080/api/v1/driver/orders/available",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (response.ok) {
        // Calculate distances if driver location is available
        const ordersWithDistance = data.map((order: any) => {
          // Convert GeoLocation to {latitude, longitude} if needed
          let restaurantLocation = order.restaurantLocation;
          if (restaurantLocation && restaurantLocation.coordinates) {
            restaurantLocation = {
              latitude: restaurantLocation.coordinates[1],
              longitude: restaurantLocation.coordinates[0],
            };
          }

          let distance = "N/A";
          if (driverLocation && restaurantLocation) {
            const dist = calculateDistance(
              driverLocation.latitude,
              driverLocation.longitude,
              restaurantLocation.latitude,
              restaurantLocation.longitude
            );
            distance = `${dist.toFixed(1)} km`;
          }

          return {
            ...order,
            restaurantLocation,
            distance,
          };
        });

        setAvailableOrders(ordersWithDistance);
      } else {
        throw new Error(data.message || "Failed to fetch orders");
      }
    } catch (error) {
      console.error("Fetch orders error:", error);
      Alert.alert("Error", "Could not load available orders");
    }
  };

  const fetchDriverStats = async () => {
    try {
      const token = await AsyncStorage.getItem("driverToken");
      const response = await fetch(
        "http://192.168.1.3:8080/api/v1/driver/stats",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (response.ok) {
        setDriverStats(data);
      }
    } catch (error) {
      console.error("Fetch stats error:", error);
    }
  };

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      getDriverLocation(),
      fetchAvailableOrders(),
      fetchDriverStats(),
    ]);
    setRefreshing(false);
  };

  const handleAcceptOrder = async (orderId: string) => {
    try {
      const token = await AsyncStorage.getItem("driverToken");
      const response = await fetch(
        `http://192.168.1.3:8080/api/v1/driver/orders/${orderId}/accept`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (response.ok) {
        // Remove order from available list
        setAvailableOrders((prev) =>
          prev.filter((order) => order.id !== orderId)
        );

        // Notify customer via WebSocket
        const driverId = await AsyncStorage.getItem("driverId");
        const driverName = await AsyncStorage.getItem("driverName");
        const driverPhone = await AsyncStorage.getItem("driverPhone");
        const driverProfilePic = await AsyncStorage.getItem("driverProfilePic");

        WebSocketService.emit("driver:accepted", {
          orderId,
          driverId,
          driverInfo: {
            name: driverName || "Driver",
            phone: driverPhone || "",
            profile_picture: driverProfilePic || "",
          },
        });

        // Navigate to order details
        router.push({
          pathname: "./(driver)/order-detail",
          params: { orderId },
        });

        Alert.alert(
          "✅ Order Accepted!",
          "You have accepted the order. Navigate to the restaurant for pickup.",
          [{ text: "Proceed" }]
        );
      } else {
        throw new Error(data.message || "Failed to accept order");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to accept order");
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    Alert.alert("Reject Order", "Are you sure you want to reject this order?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem("driverToken");
            await fetch(
              `http://192.168.1.3:8080/api/v1/driver/orders/${orderId}/reject`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
              }
            );

            setAvailableOrders((prev) =>
              prev.filter((order) => order.id !== orderId)
            );
          } catch (error) {
            console.error("Reject order error:", error);
          }
        },
      },
    ]);
  };

  const handleAcceptAll = () => {
    if (availableOrders.length === 0) return;

    Alert.alert(
      "Accept All Orders",
      `Are you sure you want to accept all ${availableOrders.length} available orders?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept All",
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem("driverToken");

              // Accept the first order and navigate to it
              const firstOrder = availableOrders[0];
              await handleAcceptOrder(firstOrder.id);

              // Reject the rest
              const remainingOrders = availableOrders.slice(1);
              for (const order of remainingOrders) {
                await fetch(
                  `http://192.168.1.3:8080/api/v1/driver/orders/${order.id}/reject`,
                  {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${token}`,
                      "Content-Type": "application/json",
                    },
                  }
                );
              }

              setAvailableOrders([]);
            } catch (error) {
              console.error("Accept all error:", error);
            }
          },
        },
      ]
    );
  };

  const handleToggleOnlineStatus = () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);

    if (newStatus) {
      // Go online
      connectWebSocket();
      Alert.alert(
        "✅ You're Online",
        "You will now receive new order notifications"
      );
    } else {
      // Go offline
      WebSocketService.disconnect();
      Alert.alert("⏸️ You're Offline", "You won't receive new orders");
    }
  };

  const handleFilterPress = (filter: keyof typeof activeFilters) => {
    setActiveFilters((prev) => {
      const newFilters = { ...prev };

      // Toggle the clicked filter
      newFilters[filter] = !prev[filter];

      // If "all" is selected, deselect others
      if (filter === "all" && newFilters[filter]) {
        newFilters.nearby = false;
        newFilters.highValue = false;
        newFilters.quickDelivery = false;
      } else if (newFilters[filter]) {
        // If another filter is selected, deselect "all"
        newFilters.all = false;
      }

      return newFilters;
    });
  };

  const getFilteredOrders = () => {
    return availableOrders.filter((order) => {
      if (activeFilters.all) return true;

      const filters = [];
      if (activeFilters.nearby) {
        const distance = parseFloat(order.distance.replace(" km", ""));
        filters.push(distance <= 5); // Within 5km
      }
      if (activeFilters.highValue) {
        filters.push(order.amount >= 30); // High value orders
      }
      if (activeFilters.quickDelivery) {
        filters.push(order.estimatedPreparationTime <= 20); // Quick preparation
      }

      return filters.some(Boolean);
    });
  };

  const renderOrderCard = (order: Order, index: number) => (
    <View key={order.id} style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <View style={styles.restaurantInfo}>
          {order.restaurant.image ? (
            <Image
              source={{ uri: order.restaurant.image }}
              style={styles.restaurantImage}
            />
          ) : (
            <View style={styles.restaurantIcon}>
              <Ionicons name='restaurant' size={20} color={colors.white} />
            </View>
          )}
          <View style={styles.restaurantDetails}>
            <Text style={styles.restaurantName}>{order.restaurant.name}</Text>
            <View style={styles.restaurantMeta}>
              <Ionicons name='star' size={12} color={colors.warning} />
              <Text style={styles.restaurantRating}>
                {order.restaurant.rating.toFixed(1)}
              </Text>
              <Ionicons name='location' size={12} color={colors.gray500} />
              <Text style={styles.restaurantDistance}>{order.distance}</Text>
            </View>
          </View>
        </View>
        <View style={styles.orderAmount}>
          <Text style={styles.amountValue}>{order.amount.toFixed(2)} Birr</Text>
          <Text style={styles.amountLabel}>Total</Text>
        </View>
      </View>

      <View style={styles.orderBody}>
        <View style={styles.orderDetails}>
          <View style={styles.detailRow}>
            <Ionicons name='person' size={16} color={colors.gray600} />
            <Text style={styles.detailText}>{order.customer.name}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name='cube' size={16} color={colors.gray600} />
            <Text style={styles.detailText}>{order.itemsCount} items</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name='time' size={16} color={colors.gray600} />
            <Text style={styles.detailText}>{order.estimatedDeliveryTime}</Text>
          </View>
          {order.specialInstructions && (
            <View style={styles.detailRow}>
              <Ionicons name='document-text' size={16} color={colors.gray600} />
              <Text style={styles.detailText} numberOfLines={1}>
                Note: {order.specialInstructions}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.orderActions}>
          <TouchableOpacity
            style={styles.rejectButton}
            onPress={() => handleRejectOrder(order.id)}
          >
            <Ionicons name='close' size={20} color={colors.error} />
            <Text style={styles.rejectButtonText}>Reject</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => handleAcceptOrder(order.id)}
          >
            <Ionicons name='checkmark' size={20} color={colors.white} />
            <Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.orderFooter}>
        <Text style={styles.orderTime}>
          Ordered{" "}
          {new Date(order.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
        <View style={styles.paymentBadge}>
          <Ionicons
            name={order.paymentMethod === "cash" ? "cash" : "card"}
            size={12}
            color={colors.white}
          />
          <Text style={styles.paymentText}>
            {order.paymentMethod === "cash" ? "Cash" : "Digital"}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle='dark-content' backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Available Orders</Text>
          <TouchableOpacity
            style={[
              styles.onlineToggle,
              isOnline ? styles.online : styles.offline,
            ]}
            onPress={handleToggleOnlineStatus}
          >
            <View
              style={[
                styles.onlineDot,
                isOnline ? styles.dotOnline : styles.dotOffline,
              ]}
            />
            <Text style={styles.onlineText}>
              {isOnline ? "Online" : "Offline"}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>
          {availableOrders.length} order
          {availableOrders.length !== 1 ? "s" : ""} available near you
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{driverStats.totalDeliveries}</Text>
            <Text style={styles.statLabel}>Deliveries</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {driverStats.averageRating.toFixed(1)}
            </Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {driverStats.averageEarnings.toFixed(1)} Birr
            </Text>
            <Text style={styles.statLabel}>Avg/Order</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{driverStats.acceptanceRate}%</Text>
            <Text style={styles.statLabel}>Acceptance</Text>
          </View>
        </View>

        {/* Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersContainer}
          contentContainerStyle={styles.filtersContent}
        >
          <TouchableOpacity
            style={[
              styles.filterButton,
              activeFilters.all && styles.filterButtonActive,
            ]}
            onPress={() => handleFilterPress("all")}
          >
            <Text
              style={[
                styles.filterText,
                activeFilters.all && styles.filterTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              activeFilters.nearby && styles.filterButtonActive,
            ]}
            onPress={() => handleFilterPress("nearby")}
          >
            <Ionicons
              name='location'
              size={16}
              color={activeFilters.nearby ? colors.white : colors.gray600}
            />
            <Text
              style={[
                styles.filterText,
                activeFilters.nearby && styles.filterTextActive,
              ]}
            >
              Nearby
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              activeFilters.highValue && styles.filterButtonActive,
            ]}
            onPress={() => handleFilterPress("highValue")}
          >
            <Ionicons
              name='trending-up'
              size={16}
              color={activeFilters.highValue ? colors.white : colors.gray600}
            />
            <Text
              style={[
                styles.filterText,
                activeFilters.highValue && styles.filterTextActive,
              ]}
            >
              High Value
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              activeFilters.quickDelivery && styles.filterButtonActive,
            ]}
            onPress={() => handleFilterPress("quickDelivery")}
          >
            <Ionicons
              name='flash'
              size={16}
              color={
                activeFilters.quickDelivery ? colors.white : colors.gray600
              }
            />
            <Text
              style={[
                styles.filterText,
                activeFilters.quickDelivery && styles.filterTextActive,
              ]}
            >
              Quick
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Orders List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size='large' color={colors.primary} />
            <Text style={styles.loadingText}>Loading available orders...</Text>
          </View>
        ) : getFilteredOrders().length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name='fast-food' size={60} color={colors.gray300} />
            <Text style={styles.emptyTitle}>No orders available</Text>
            <Text style={styles.emptyMessage}>
              {isOnline
                ? "New orders will appear here when they become available. Try refreshing or check back later."
                : "You are currently offline. Go online to receive orders."}
            </Text>
            {!isOnline && (
              <TouchableOpacity
                style={styles.goOnlineButton}
                onPress={handleToggleOnlineStatus}
              >
                <Text style={styles.goOnlineText}>Go Online</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.ordersList}>
            {getFilteredOrders().map((order, index) =>
              renderOrderCard(order, index)
            )}
          </View>
        )}

        {/* Map Preview */}
        {driverLocation && availableOrders.length > 0 && (
          <View style={styles.mapPreviewContainer}>
            <Text style={styles.mapTitle}>Orders in Your Area</Text>
            <View style={styles.mapPreview}>
              <View style={styles.mapPlaceholder}>
                <Ionicons name='map' size={40} color={colors.gray400} />
                <Text style={styles.mapPlaceholderText}>Map Preview</Text>
              </View>
              <View style={styles.mapStats}>
                <Text style={styles.mapStat}>
                  🚴 {availableOrders.length} orders within 5km radius
                </Text>
                <Text style={styles.mapStat}>
                  ⏱️ Average wait time: 15-25 minutes
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Accept All Button (if multiple orders) */}
      {availableOrders.length > 1 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.acceptAllButton}
            onPress={handleAcceptAll}
          >
            <Ionicons name='checkmark-done' size={20} color={colors.white} />
            <Text style={styles.acceptAllText}>
              Accept All {availableOrders.length} Orders
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 20,
    backgroundColor: colors.white,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.gray900,
  },
  onlineToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  online: {
    backgroundColor: colors.success + "20",
  },
  offline: {
    backgroundColor: colors.gray200,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotOnline: {
    backgroundColor: colors.success,
  },
  dotOffline: {
    backgroundColor: colors.gray500,
  },
  onlineText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.gray700,
  },
  subtitle: {
    fontSize: 16,
    color: colors.gray600,
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.gray600,
  },
  filtersContainer: {
    backgroundColor: colors.white,
    paddingVertical: 16,
  },
  filtersContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.gray200,
    gap: 6,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray600,
  },
  filterTextActive: {
    color: colors.white,
  },
  ordersList: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 16,
  },
  orderCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  restaurantInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  restaurantImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  restaurantIcon: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  restaurantDetails: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.gray800,
    marginBottom: 4,
  },
  restaurantMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  restaurantRating: {
    fontSize: 12,
    color: colors.gray600,
    marginRight: 8,
  },
  restaurantDistance: {
    fontSize: 12,
    color: colors.gray600,
  },
  orderAmount: {
    alignItems: "flex-end",
  },
  amountValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: 2,
  },
  amountLabel: {
    fontSize: 12,
    color: colors.gray600,
  },
  orderBody: {
    marginBottom: 12,
  },
  orderDetails: {
    marginBottom: 16,
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: colors.gray700,
    flex: 1,
  },
  orderActions: {
    flexDirection: "row",
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.error,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  rejectButtonText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: "600",
  },
  acceptButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  acceptButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "600",
  },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  orderTime: {
    fontSize: 12,
    color: colors.gray500,
  },
  paymentBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.info,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  paymentText: {
    fontSize: 10,
    color: colors.white,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.gray700,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    color: colors.gray500,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  goOnlineButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  goOnlineText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "bold",
  },
  mapPreviewContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  mapTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.gray800,
    marginBottom: 12,
  },
  mapPreview: {
    backgroundColor: colors.white,
    borderRadius: 16,
    overflow: "hidden",
  },
  mapPlaceholder: {
    height: 150,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.gray100,
  },
  mapPlaceholderText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.gray500,
  },
  mapStats: {
    padding: 16,
    gap: 8,
  },
  mapStat: {
    fontSize: 14,
    color: colors.gray700,
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
  acceptAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.success,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  acceptAllText: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.white,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.gray600,
  },
});

export default AvailableOrdersScreen;
