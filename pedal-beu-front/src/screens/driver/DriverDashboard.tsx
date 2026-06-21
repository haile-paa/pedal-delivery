import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Alert,
} from "react-native";
import * as Location from "expo-location";
import { useAppState } from "../../context/AppStateContext";
import { colors } from "../../theme/colors";
import OnlineToggle from "../../components/driver/OnlineToggle";
import OrderNotification from "../../components/driver/OrderNotification";
import FloatingActionButton from "../../components/ui/FloatingActionButton";
import { useRouter } from "expo-router";
import WebSocketService from "../../services/websocket.service";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface BackendOrder {
  id: string;
  order_number?: string;
  restaurant_id: string;
  customer_id: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  total_amount: { total: number };
  delivery_info: {
    address: { address: string; location?: { coordinates: [number, number] } };
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
    location?: { coordinates: [number, number] };
  };
}

interface NotificationOrder {
  id: string;
  restaurantName: string;
  amount: number;
  distance: string;
  itemsCount: number;
  estimatedDeliveryTime: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  restaurantLocation?: { latitude: number; longitude: number };
  customerLocation?: { latitude: number; longitude: number };
}

interface DriverStats {
  totalDeliveries: number;
  averageRating: number;
  averageEarnings: number;
  acceptanceRate: number;
  todayEarnings: number;
  weekEarnings: number;
}

const DriverDashboard: React.FC = () => {
  const router = useRouter();
  const { state, dispatch } = useAppState();
  const [notifications, setNotifications] = useState<NotificationOrder[]>([]);
  const [timeOnline, setTimeOnline] = useState(0);
  const [driverLocation, setDriverLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [stats, setStats] = useState<DriverStats>({
    totalDeliveries: 0,
    averageRating: 5.0,
    averageEarnings: 0,
    acceptanceRate: 0,
    todayEarnings: 0,
    weekEarnings: 0,
  });

  // Ref to hold the location watcher subscription
  const locationSubscription = useRef<Location.LocationSubscription | null>(
    null,
  );
  // Ref to hold the interval that sends location every 5 s
  const locationSendInterval = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  // ─── Timer for online duration ──────────────────────────────────────────────
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (state.driver.isOnline) {
      interval = setInterval(() => setTimeOnline((prev) => prev + 1), 1000);
    } else {
      setTimeOnline(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [state.driver.isOnline]);

  // ─── Fetch driver stats ──────────────────────────────────────────────────────
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = await AsyncStorage.getItem("accessToken");
        const response = await fetch(
          "https://pedal-delivery-back.onrender.com/api/v1/driver/stats",
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (response.ok) {
          const data = await response.json();
          setStats({
            totalDeliveries: data.totalDeliveries || 0,
            averageRating: data.averageRating || 5.0,
            averageEarnings: data.averageEarnings || 0,
            acceptanceRate: data.acceptanceRate || 0,
            todayEarnings: data.todayEarnings || 0,
            weekEarnings: data.weekEarnings || 0,
          });
        }
      } catch (error) {
        console.error("Failed to fetch driver stats", error);
      }
    };
    fetchStats();
  }, []);

  // ─── WebSocket + location tracking when online ───────────────────────────────
  useEffect(() => {
    if (state.driver.isOnline) {
      startOnline();
    } else {
      stopOnline();
    }
    return () => stopOnline();
  }, [state.driver.isOnline]);

  const startOnline = async () => {
    const token = await AsyncStorage.getItem("accessToken");
    if (!token) return;

    // 1. Connect WebSocket — now properly waits for the handshake to
    // finish before resolving, so the status message below is never
    // sent before the connection is actually open.
    try {
      await WebSocketService.connect(token);
    } catch (e) {
      console.warn("WebSocket failed to connect, will retry automatically:", e);
      Alert.alert(
        "Connection issue",
        "Couldn't reach the server right now. We'll keep retrying in the background.",
      );
    }

    // 2. Tell backend the driver is online
    WebSocketService.setOnlineStatus(true);

    // 3. Subscribe to order events
    WebSocketService.on("order:new", handleNewOrder);
    WebSocketService.on("order:cancelled", handleOrderCancelled);
    WebSocketService.on("order:taken", handleOrderTaken);

    // 4. Request GPS permission and start watching location
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Location required",
        "Please enable location permissions so customers can track you.",
      );
      return;
    }

    // Get initial position immediately
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = pos.coords;
      setDriverLocation({ latitude, longitude });
      // Send initial location to admin right away
      WebSocketService.sendDriverLocation(latitude, longitude);
    } catch (e) {
      console.warn("Could not get initial position:", e);
    }

    // Watch for position changes and relay to backend every movement
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 20, // meters — only send when moved 20 m
        timeInterval: 5000, // or at least every 5 s
      },
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setDriverLocation({ latitude, longitude });
        WebSocketService.sendDriverLocation(latitude, longitude);
      },
    );
  };

  const stopOnline = () => {
    // Tell backend offline
    if (WebSocketService.isConnected()) {
      WebSocketService.setOnlineStatus(false);
    }

    // Stop GPS watcher
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    if (locationSendInterval.current) {
      clearInterval(locationSendInterval.current);
      locationSendInterval.current = null;
    }

    WebSocketService.off("order:new", handleNewOrder);
    WebSocketService.off("order:cancelled", handleOrderCancelled);
    WebSocketService.off("order:taken", handleOrderTaken);
    WebSocketService.disconnect();

    setNotifications([]);
  };

  const handleNewOrder = (data: BackendOrder) => {
    const order = mapBackendToNotification(data);
    setNotifications((prev) => [order, ...prev.slice(0, 9)]);
  };

  const handleOrderCancelled = (data: { orderId: string }) => {
    setNotifications((prev) => prev.filter((o) => o.id !== data.orderId));
  };

  const handleOrderTaken = (data: { orderId: string; driverId: string }) => {
    const myId = state.auth.user?.id;
    if (data.driverId !== myId) {
      setNotifications((prev) => prev.filter((o) => o.id !== data.orderId));
    }
  };

  const mapBackendToNotification = (
    backend: BackendOrder,
  ): NotificationOrder => {
    let distance = "N/A";
    if (driverLocation && backend.restaurant?.location?.coordinates) {
      const [restLng, restLat] = backend.restaurant.location.coordinates;
      const dist = calculateDistance(
        driverLocation.latitude,
        driverLocation.longitude,
        restLat,
        restLng,
      );
      distance = `${dist.toFixed(1)} km`;
    }

    let eta = "30 min";
    if (backend.delivery_info.estimated_delivery) {
      const deliveryTime = new Date(backend.delivery_info.estimated_delivery);
      const now = new Date();
      const diffMinutes = Math.round(
        (deliveryTime.getTime() - now.getTime()) / 60000,
      );
      eta = diffMinutes > 0 ? `${diffMinutes} min` : "Now";
    }

    return {
      id: backend.id,
      restaurantName: backend.restaurant?.name || "Restaurant",
      amount: backend.total_amount?.total || 0,
      distance,
      itemsCount: backend.items.reduce((sum, item) => sum + item.quantity, 0),
      estimatedDeliveryTime: eta,
      customerName: backend.delivery_info.contact_name,
      customerPhone: backend.delivery_info.contact_phone,
      deliveryAddress: backend.delivery_info.address.address,
      restaurantLocation: backend.restaurant?.location?.coordinates
        ? {
            latitude: backend.restaurant.location.coordinates[1],
            longitude: backend.restaurant.location.coordinates[0],
          }
        : undefined,
      customerLocation: backend.delivery_info.address.location?.coordinates
        ? {
            latitude: backend.delivery_info.address.location.coordinates[1],
            longitude: backend.delivery_info.address.location.coordinates[0],
          }
        : undefined,
    };
  };

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const handleToggleOnline = (isOnline: boolean) => {
    dispatch({ type: "SET_DRIVER_ONLINE", payload: isOnline });
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
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to accept order");
      }
      setNotifications((prev) => prev.filter((o) => o.id !== orderId));
      router.push({
        pathname: "/(driver)/order-detail" as any,
        params: { orderId },
      });
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const handleRejectOrder = async (orderId: string) => {
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
      setNotifications((prev) => prev.filter((o) => o.id !== orderId));
    } catch (error) {
      console.error("Reject error:", error);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle='dark-content' backgroundColor={colors.background} />
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              Welcome back, {state.auth.user?.name || "Driver"}! 🚗
            </Text>
            <Text style={styles.subtitle}>
              {state.driver.isOnline
                ? `Online for ${formatTime(timeOnline)}`
                : "Go online to start earning"}
            </Text>
          </View>
          <OnlineToggle
            isOnline={state.driver.isOnline}
            onToggle={handleToggleOnline}
            showLabel={true}
          />
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {stats.todayEarnings.toFixed(2)} Birr
            </Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {stats.weekEarnings.toFixed(2)} Birr
            </Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalDeliveries}</Text>
            <Text style={styles.statLabel}>Deliveries</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {stats.averageRating.toFixed(1)}
            </Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>

        <View style={styles.actionsContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push("/(driver)/available-orders" as any)}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: colors.primary + "20" },
                ]}
              >
                <Text
                  style={[styles.actionIconText, { color: colors.primary }]}
                >
                  📋
                </Text>
              </View>
              <Text style={styles.actionText}>Available Orders</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push("/(driver)/earnings" as any)}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: colors.success + "20" },
                ]}
              >
                <Text
                  style={[styles.actionIconText, { color: colors.success }]}
                >
                  💰
                </Text>
              </View>
              <Text style={styles.actionText}>Earnings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push("/(driver)/documents" as any)}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: colors.info + "20" },
                ]}
              >
                <Text style={[styles.actionIconText, { color: colors.info }]}>
                  📄
                </Text>
              </View>
              <Text style={styles.actionText}>Documents</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push("/(driver)/profile" as any)}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: colors.secondary + "20" },
                ]}
              >
                <Text
                  style={[styles.actionIconText, { color: colors.secondary }]}
                >
                  👤
                </Text>
              </View>
              <Text style={styles.actionText}>Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.ordersContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {state.driver.isOnline ? "New Orders" : "Recent Activity"}
            </Text>
            {notifications.length > 0 && (
              <TouchableOpacity onPress={() => setNotifications([])}>
                <Text style={styles.clearButton}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>

          {state.driver.isOnline ? (
            notifications.length > 0 ? (
              notifications.map((order) => (
                <OrderNotification
                  key={order.id}
                  order={order}
                  onAccept={() => handleAcceptOrder(order.id)}
                  onReject={() => handleRejectOrder(order.id)}
                  index={0}
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No new orders yet</Text>
                <Text style={styles.emptySubtext}>
                  New orders will appear here when available
                </Text>
              </View>
            )
          ) : (
            <View style={styles.offlineState}>
              <Text style={styles.offlineText}>⚠️ You're offline</Text>
              <Text style={styles.offlineSubtext}>
                Go online to receive new delivery requests
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {state.driver.currentOrder && (
        <FloatingActionButton
          icon='navigate'
          onPress={() => router.push("/(driver)/navigation" as any)}
          position='bottom-right'
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: colors.white,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.gray900,
    marginBottom: 4,
  },
  subtitle: { fontSize: 14, color: colors.gray600 },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  statCard: { flex: 1, alignItems: "center" },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: { fontSize: 12, color: colors.gray600 },
  actionsContainer: {
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.gray900,
    marginBottom: 16,
  },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  actionButton: {
    width: "48%",
    alignItems: "center",
    padding: 16,
    backgroundColor: colors.gray50,
    borderRadius: 16,
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  actionIconText: { fontSize: 24 },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray800,
    textAlign: "center",
  },
  ordersContainer: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  clearButton: { fontSize: 14, color: colors.error, fontWeight: "600" },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.gray700,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.gray500,
    textAlign: "center",
    lineHeight: 20,
  },
  offlineState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    backgroundColor: colors.warning + "10",
    borderRadius: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.warning + "30",
  },
  offlineText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.warning,
    marginBottom: 8,
  },
  offlineSubtext: {
    fontSize: 14,
    color: colors.gray600,
    textAlign: "center",
    lineHeight: 20,
  },
});

export default DriverDashboard;
