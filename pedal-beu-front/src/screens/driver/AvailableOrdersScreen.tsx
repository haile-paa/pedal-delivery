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

// Define the expected shape of a backend order (from REST or WebSocket)
interface BackendOrder {
  id: string;
  order_number?: string;
  restaurant_id: string;
  customer_id: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total_amount: {
    total: number;
  };
  delivery_info: {
    address: {
      address: string;
      location?: {
        coordinates: [number, number]; // [lng, lat]
      };
    };
    contact_name: string;
    contact_phone: string;
    estimated_delivery?: string;
  };
  special_instructions?: string;
  payment_method: string;
  created_at: string;
  restaurant?: {
    name: string;
    address: string;
    image?: string;
    rating: number;
    location?: {
      coordinates: [number, number];
    };
  };
  customer?: {
    name: string;
    phone: string;
  };
}

// Frontend Order interface used in the screen
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

// Helper to convert backend order to frontend Order
const mapBackendOrder = (backendOrder: BackendOrder): Order => {
  const restaurantLocation = backendOrder.restaurant?.location?.coordinates
    ? {
        latitude: backendOrder.restaurant.location.coordinates[1],
        longitude: backendOrder.restaurant.location.coordinates[0],
      }
    : { latitude: 0, longitude: 0 };

  const customerLocation = backendOrder.delivery_info?.address?.location
    ?.coordinates
    ? {
        latitude: backendOrder.delivery_info.address.location.coordinates[1],
        longitude: backendOrder.delivery_info.address.location.coordinates[0],
      }
    : { latitude: 0, longitude: 0 };

  return {
    id: backendOrder.id || "",
    orderId: backendOrder.order_number || backendOrder.id || "",
    restaurant: {
      id: backendOrder.restaurant_id || "",
      name: backendOrder.restaurant?.name || "Restaurant",
      address: backendOrder.restaurant?.address || "",
      image: backendOrder.restaurant?.image,
      rating: backendOrder.restaurant?.rating || 0,
    },
    customer: {
      id: backendOrder.customer_id || "",
      name: backendOrder.delivery_info?.contact_name || "Customer",
      phone: backendOrder.delivery_info?.contact_phone || "",
      location: customerLocation,
    },
    amount: backendOrder.total_amount?.total || 0,
    distance: "N/A",
    items: (backendOrder.items || []).map((item) => ({
      name: item.name || "Item",
      quantity: item.quantity || 0,
    })),
    itemsCount: (backendOrder.items || []).reduce(
      (sum, item) => sum + (item.quantity || 0),
      0,
    ),
    estimatedPreparationTime: 15,
    estimatedDeliveryTime: backendOrder.delivery_info?.estimated_delivery
      ? new Date(
          backendOrder.delivery_info.estimated_delivery,
        ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "30 min",
    specialInstructions: backendOrder.special_instructions,
    createdAt: backendOrder.created_at || new Date().toISOString(),
    restaurantLocation,
    customerLocation,
    paymentMethod: backendOrder.payment_method || "cash",
  };
};

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
  const locationInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    initializeDriver();

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      subscription.remove();
      if (locationInterval.current) {
        clearInterval(locationInterval.current);
      }
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

      // Start periodic location updates if online
      if (isOnline) {
        startLocationUpdates();
      }
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
            const { latitude, longitude } = position.coords;
            setDriverLocation({ latitude, longitude });

            // Send initial location via WebSocket
            if (isOnline) {
              WebSocketService.updateDriverLocation({
                lat: latitude,
                lng: longitude,
              });
            }
            resolve();
          },
          (error) => {
            console.error("Location error:", error);
            resolve(); // Continue without location
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
        );
      } else {
        resolve(); // Continue without location
      }
    });
  };

  const startLocationUpdates = () => {
    if (locationInterval.current) clearInterval(locationInterval.current);
    locationInterval.current = setInterval(() => {
      if (driverLocation && isOnline) {
        WebSocketService.updateDriverLocation({
          lat: driverLocation.latitude,
          lng: driverLocation.longitude,
        });
      }
    }, 10000); // every 10 seconds
  };

  const connectWebSocket = async () => {
    try {
      const token = await AsyncStorage.getItem("accessToken");
      if (!token) {
        Alert.alert("Error", "You are not logged in");
        router.replace("/login");
        return;
      }

      WebSocketService.connect(token);

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
      if (locationInterval.current) {
        clearInterval(locationInterval.current);
      }
      WebSocketService.disconnect();
    }

    appState.current = nextAppState;
  };

  const handleNewOrder = (data: BackendOrder) => {
    const order = mapBackendOrder(data);
    // Calculate distance if driver location is available
    if (driverLocation) {
      const dist = calculateDistance(
        driverLocation.latitude,
        driverLocation.longitude,
        order.restaurantLocation.latitude,
        order.restaurantLocation.longitude,
      );
      order.distance = `${dist.toFixed(1)} km`;
    }

    setAvailableOrders((prev) => {
      if (prev.some((o) => o.id === order.id)) return prev;
      return [order, ...prev];
    });

    // Show notification
    Alert.alert(
      "🎉 New Order Available!",
      `New order from ${order.restaurant.name} for ${order.amount.toFixed(
        2,
      )} Birr`,
      [
        {
          text: "Ignore",
          style: "cancel",
        },
        {
          text: "View",
          onPress: () => {
            // Optionally scroll to the order
          },
        },
      ],
    );
  };

  const handleOrderCancelled = (data: { orderId: string }) => {
    setAvailableOrders((prev) =>
      prev.filter((order) => order.id !== data.orderId),
    );
  };

  const handleOrderTaken = async (data: {
    orderId: string;
    driverId: string;
  }) => {
    // If another driver took the order, remove it from available list
    const driverId = await AsyncStorage.getItem("userId");
    if (data.driverId !== driverId) {
      setAvailableOrders((prev) =>
        prev.filter((order) => order.id !== data.orderId),
      );
    }
  };

  const fetchAvailableOrders = async () => {
    try {
      const token = await AsyncStorage.getItem("accessToken");
      if (!driverLocation) {
        console.warn("Driver location not available yet");
        return;
      }
      const { latitude, longitude } = driverLocation;
      const url = `https://pedal-delivery-back.onrender.com/api/v1/driver/orders/available?lat=${latitude}&lng=${longitude}&radius=5000`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (response.ok) {
        const orders = (data as BackendOrder[]).map((order) => {
          const mapped = mapBackendOrder(order);
          if (driverLocation) {
            const dist = calculateDistance(
              driverLocation.latitude,
              driverLocation.longitude,
              mapped.restaurantLocation.latitude,
              mapped.restaurantLocation.longitude,
            );
            mapped.distance = `${dist.toFixed(1)} km`;
          }
          return mapped;
        });
        setAvailableOrders(orders);
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
      const token = await AsyncStorage.getItem("accessToken");
      const response = await fetch(
        "https://pedal-delivery-back.onrender.com/api/v1/driver/stats",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        // Fallback to default stats
        setDriverStats({
          totalDeliveries: 0,
          averageRating: 0,
          averageEarnings: 0,
          averageTime: 0,
          acceptanceRate: 0,
        });
        return;
      }

      const text = await response.text();
      try {
        const data = JSON.parse(text);
        setDriverStats(data);
      } catch (e) {
        console.error("Invalid JSON from stats endpoint:", text);
        setDriverStats({
          totalDeliveries: 0,
          averageRating: 0,
          averageEarnings: 0,
          averageTime: 0,
          acceptanceRate: 0,
        });
      }
    } catch (error) {
      console.error("Fetch stats error:", error);
      setDriverStats({
        totalDeliveries: 0,
        averageRating: 0,
        averageEarnings: 0,
        averageTime: 0,
        acceptanceRate: 0,
      });
    }
  };

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
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
      const token = await AsyncStorage.getItem("accessToken");
      const response = await fetch(
        `https://pedal-delivery-back.onrender.com/api/v1/driver/orders/${orderId}/accept`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      const data = await response.json();

      if (response.ok) {
        // Remove order from available list
        setAvailableOrders((prev) =>
          prev.filter((order) => order.id !== orderId),
        );

        // Notify customer via WebSocket
        const driverId = await AsyncStorage.getItem("userId");
        const driverName = await AsyncStorage.getItem("userName");
        const driverPhone = await AsyncStorage.getItem("userPhone");
        const driverProfilePic = await AsyncStorage.getItem("userAvatar");

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
          pathname: "/(driver)/order-detail" as any,
          params: { orderId },
        });

        Alert.alert(
          "✅ Order Accepted!",
          "You have accepted the order. Navigate to the restaurant for pickup.",
          [{ text: "Proceed" }],
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
            const token = await AsyncStorage.getItem("accessToken");
            await fetch(
              `https://pedal-delivery-back.onrender.com/api/v1/driver/orders/${orderId}/reject`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
              },
            );

            setAvailableOrders((prev) =>
              prev.filter((order) => order.id !== orderId),
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
              const token = await AsyncStorage.getItem("accessToken");

              // Accept the first order and navigate to it
              const firstOrder = availableOrders[0];
              await handleAcceptOrder(firstOrder.id);

              // Reject the rest
              const remainingOrders = availableOrders.slice(1);
              for (const order of remainingOrders) {
                await fetch(
                  `https://pedal-delivery-back.onrender.com/api/v1/driver/orders/${order.id}/reject`,
                  {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${token}`,
                      "Content-Type": "application/json",
                    },
                  },
                );
              }

              setAvailableOrders([]);
            } catch (error) {
              console.error("Accept all error:", error);
            }
          },
        },
      ],
    );
  };

  const handleToggleOnlineStatus = () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);

    if (newStatus) {
      connectWebSocket();
      if (driverLocation) {
        startLocationUpdates();
      }
      Alert.alert(
        "✅ You're Online",
        "You will now receive new order notifications",
      );
    } else {
      if (locationInterval.current) {
        clearInterval(locationInterval.current);
      }
      WebSocketService.disconnect();
      Alert.alert("⏸️ You're Offline", "You won't receive new orders");
    }
  };

  const handleFilterPress = (filter: keyof typeof activeFilters) => {
    setActiveFilters((prev) => {
      const newFilters = { ...prev };

      newFilters[filter] = !prev[filter];

      if (filter === "all" && newFilters[filter]) {
        newFilters.nearby = false;
        newFilters.highValue = false;
        newFilters.quickDelivery = false;
      } else if (newFilters[filter]) {
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
        filters.push(distance <= 5);
      }
      if (activeFilters.highValue) {
        filters.push(order.amount >= 30);
      }
      if (activeFilters.quickDelivery) {
        filters.push(order.estimatedPreparationTime <= 20);
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
              renderOrderCard(order, index),
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
