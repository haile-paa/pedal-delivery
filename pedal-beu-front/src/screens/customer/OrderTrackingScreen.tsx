// app/(customer)/order-tracking.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Alert,
  Image,
  Linking,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import MapView, { Marker, Polyline } from "react-native-maps";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import ProgressStepper from "../../components/ui/ProgressStepper";
import AnimatedButton from "../../components/ui/AnimatedButton";
import RateOrderModal from "../../components/customer/RateOrderModal";
import WebSocketService from "../../services/websocket.service";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useAppState } from "../../context/AppStateContext";
import { API_BASE_URL } from "../../utils/constants";

interface DriverInfo {
  id: string;
  name: string;
  phone: string;
  profile_picture?: string;
  rating: number;
  vehicle_type: string;
  license_plate: string;
  completed_deliveries: number;
}

interface OrderStatus {
  status:
    | "pending"
    | "accepted"
    | "preparing"
    | "ready"
    | "picked_up"
    | "on_the_way"
    | "delivered"
    | "cancelled";
  timestamp: string;
  message?: string;
}

interface OrderDetails {
  id: string;
  restaurant_name: string;
  restaurant_address: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total_amount: number;
  payment_method?: string;
  payment_status?: string;
  payment_verification?: {
    transaction_reference?: string;
    status?: string;
    payer_phone?: string;
    proof_url?: string;
  };
  delivery_address: string;
  estimated_delivery_time: string;
  created_at: string;
  rating?: {
    food_rating: number;
    delivery_rating: number;
    restaurant_rating: number;
  } | null;
}

const AUTO_CANCEL_MINUTES = 30;

const OrderTrackingScreen: React.FC = () => {
  useKeepAwake();

  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const styles = getStyles(colors, isDark);
  const router = useRouter();
  const { orderId, restaurantName } = useLocalSearchParams<{
    orderId: string;
    restaurantName: string;
  }>();

  const mapRef = useRef<MapView>(null);

  const [driverLocation, setDriverLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [restaurantLocation, setRestaurantLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [currentStatus, setCurrentStatus] =
    useState<OrderStatus["status"]>("pending");
  const [timeRemaining, setTimeRemaining] =
    useState<number>(AUTO_CANCEL_MINUTES);
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [webSocketConnected, setWebSocketConnected] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<
    Array<{ latitude: number; longitude: number }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);

  const { dispatch } = useAppState();

  // The 30‑minute auto‑cancel window is about waiting for a driver, not
  // about the order's kitchen status — orders are created with status
  // "accepted" immediately (see backend CreateOrder), so gating this on
  // status alone made it look "active" from the first second and the
  // countdown never ran. What actually ends the waiting period is a driver
  // accepting the order, so key this off driverInfo instead.
  const isOrderActive = useCallback(() => {
    if (driverInfo) return true;
    const activeStatuses: OrderStatus["status"][] = ["picked_up", "delivered"];
    return activeStatuses.includes(currentStatus);
  }, [currentStatus, driverInfo]);

  // The absolute deadline (client epoch ms) this order auto‑cancels at.
  // Resolved ONCE per order instead of being re‑derived from `created_at`
  // on every tick, and validated before being trusted — see resolveDeadline.
  const deadlineRef = useRef<number | null>(null);
  const deadlineOrderIdRef = useRef<string | null>(null);
  // Consecutive interval ticks that have found the order expired. A single
  // bad reading (a device/server clock that's out of sync, a `created_at`
  // read a moment too early, a re-render right after checkout, etc.) must
  // not be enough to cancel a brand‑new order — this was the actual cause
  // of orders getting auto‑cancelled seconds after being placed instead of
  // after the real 30‑minute window. We only act once expiry is confirmed
  // on more than one check, ~10s apart.
  const expiredStreakRef = useRef(0);

  // Resolve (and cache) the deadline for the given order. If the parsed
  // `created_at` is invalid, or already reads as expired the very first
  // time we see it (impossible for an order just placed seconds ago — a
  // sign of clock skew or a bad timestamp, not an actual 30‑minute wait),
  // we don't trust it. Instead we start a fresh full-length window
  // measured from "now" on this device, so the customer is never
  // penalized by a clock mismatch.
  const resolveDeadline = useCallback((createdAt: string, id: string) => {
    if (deadlineOrderIdRef.current !== id) {
      deadlineOrderIdRef.current = id;
      deadlineRef.current = null;
      expiredStreakRef.current = 0;
    }

    if (deadlineRef.current !== null) return deadlineRef.current;

    const createdMs = new Date(createdAt).getTime();
    const now = Date.now();
    const windowMs = AUTO_CANCEL_MINUTES * 60 * 1000;
    const candidateDeadline = createdMs + windowMs;

    const isPlausible =
      !Number.isNaN(createdMs) &&
      candidateDeadline > now && // not already "expired" the instant we saw it
      createdMs <= now + 5 * 60 * 1000; // not created implausibly far in the future

    deadlineRef.current = isPlausible ? candidateDeadline : now + windowMs;
    return deadlineRef.current;
  }, []);

  // Minutes remaining until a given deadline, for display.
  const computeTimeRemaining = useCallback((deadline: number) => {
    const diffMs = deadline - Date.now();
    if (diffMs <= 0) return 0;
    return Math.ceil(diffMs / (60 * 1000));
  }, []);

  const statusSteps = [
    { title: t("orderPlaced"), description: t("restaurantConfirmed") },
    { title: t("preparingLabel"), description: t("foodBeingPrepared") },
    { title: t("onTheWay"), description: t("driverPickedUp") },
    { title: t("delivered"), description: t("enjoyYourMeal") },
  ];

  const statusIcons: Record<OrderStatus["status"], string> = {
    pending: "time-outline",
    accepted: "checkmark-circle-outline",
    preparing: "restaurant-outline",
    ready: "fast-food-outline",
    picked_up: "bicycle-outline",
    on_the_way: "bicycle-outline",
    delivered: "checkmark-done-outline",
    cancelled: "close-circle-outline",
  };

  const statusColors: Record<OrderStatus["status"], string> = {
    pending: colors.gray500,
    accepted: colors.info,
    preparing: colors.warning,
    ready: colors.warning,
    picked_up: colors.primary,
    on_the_way: colors.primary,
    delivered: colors.success,
    cancelled: colors.error,
  };

  const getCurrentStep = () => {
    switch (currentStatus) {
      case "pending":
        return 0;
      case "accepted":
      case "preparing":
        return 1;
      case "ready":
      case "picked_up":
      case "on_the_way":
        return 2;
      case "delivered":
        return 3;
      default:
        return 0;
    }
  };

  useEffect(() => {
    if (!orderId) {
      Alert.alert(t("errorTitle"), t("noOrderIdProvided"));
      router.back();
      return;
    }

    initializeTracking();

    return () => {
      WebSocketService.disconnect();
    };
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;

    const paymentRefreshInterval = setInterval(() => {
      fetchOrderDetails().catch((refreshError) => {
        console.warn(t("bgRefreshFailedLog"), refreshError);
      });
    }, 15000);

    return () => clearInterval(paymentRefreshInterval);
  }, [orderId]);

  // Auto‑cancel timer based on real‑time remaining
  useEffect(() => {
    if (!orderDetails?.created_at || !orderId || isOrderActive()) return;

    const id = String(orderId);
    const deadline = resolveDeadline(orderDetails.created_at, id);
    setTimeRemaining(computeTimeRemaining(deadline));

    // Re-check every 10 seconds. Cancellation only fires once expiry has
    // been confirmed on two consecutive checks (see expiredStreakRef).
    const interval = setInterval(() => {
      const remaining = computeTimeRemaining(deadline);
      setTimeRemaining(remaining);

      if (remaining > 0) {
        expiredStreakRef.current = 0;
        return;
      }

      expiredStreakRef.current += 1;
      if (expiredStreakRef.current >= 2 && currentStatus !== "cancelled") {
        cancelOrderAutomatically();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [
    orderDetails?.created_at,
    orderId,
    currentStatus,
    isOrderActive,
    resolveDeadline,
    computeTimeRemaining,
  ]);

  const cancelOrderAutomatically = async () => {
    try {
      const token = await AsyncStorage.getItem("accessToken");
      if (!token) return;

      console.log("Auto‑cancelling order due to timeout");
      const response = await fetch(`${API_BASE_URL}/orders/${orderId}/cancel`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: t("autoCancelReason"),
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setCurrentStatus("cancelled");
        dispatch({
          type: "UPDATE_ORDER_STATUS",
          payload: { orderId, status: "cancelled" },
        });
        Alert.alert(
          t("orderCancelledTitle"),
          t("autoCancelMessage"),
        );
      } else {
        console.warn("Auto‑cancel failed:", data.error);
      }
    } catch (error: any) {
      console.error("Auto‑cancel error:", error);
    }
  };

  const initializeTracking = async () => {
    try {
      setLoading(true);
      setError(null);

      await getUserLocation();
      await fetchOrderDetails();
      await setupWebSocket();
    } catch (err) {
      console.error("Initialization error:", err);
      setError(t("loadOrderDetailsFailed"));
    } finally {
      setLoading(false);
    }
  };

  const getUserLocation = () => {
    return new Promise<void>((resolve) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
            resolve();
          },
          (error) => {
            console.error("Location error:", error);
            resolve();
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
        );
      } else {
        resolve();
      }
    });
  };

  const fetchOrderDetails = async () => {
    try {
      const token = await AsyncStorage.getItem("accessToken");
      if (!token) {
        throw new Error(t("notLoggedIn"));
      }

      const orderRes = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(orderData.message || t("fetchOrderFailed"));
      }

      console.log("Order data from backend:", orderData);

      const restaurantRes = await fetch(
        `${API_BASE_URL}/restaurants/${orderData.restaurant_id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const restaurantData = await restaurantRes.json();
      if (!restaurantRes.ok) {
        throw new Error(t("fetchRestaurantFailed"));
      }

      const details: OrderDetails = {
        id: orderData.id,
        restaurant_name: restaurantData.name,
        restaurant_address: restaurantData.address,
        items: orderData.items.map((item: any) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        total_amount: orderData.total_amount?.total || 0,
        payment_method: orderData.payment_method,
        payment_status: orderData.payment_status,
        payment_verification: orderData.payment_verification,
        delivery_address: orderData.delivery_info?.address?.address || "",
        estimated_delivery_time:
          orderData.delivery_info?.estimated_delivery || "",
        created_at: orderData.created_at,
        rating: orderData.rating || null,
      };

      setOrderDetails(details);
      setCurrentStatus(orderData.status);

      if (restaurantData.location?.coordinates) {
        setRestaurantLocation({
          latitude: restaurantData.location.coordinates[1],
          longitude: restaurantData.location.coordinates[0],
        });
      }

      if (orderData.driver_id && orderData.driver) {
        setDriverInfo(orderData.driver);
      }

      if (orderData.driver_location?.coordinates) {
        const driverLoc = {
          latitude: orderData.driver_location.coordinates[1],
          longitude: orderData.driver_location.coordinates[0],
        };
        setDriverLocation(driverLoc);
        calculateRoute(driverLoc);
      }
    } catch (error: any) {
      console.error("Fetch order error:", error);
      throw error;
    }
  };

  const setupWebSocket = async () => {
    try {
      const token = await AsyncStorage.getItem("accessToken");
      if (!token) return;

      WebSocketService.connect(token);

      WebSocketService.on("connect", () => {
        console.log("WebSocket connected");
        setWebSocketConnected(true);
        WebSocketService.joinOrderRoom(orderId);
      });

      WebSocketService.on("disconnect", () => {
        console.log("WebSocket disconnected");
        setWebSocketConnected(false);
      });

      WebSocketService.on("driver:assigned", handleDriverAssigned);
      WebSocketService.on("driver:location_update", handleDriverLocationUpdate);
      WebSocketService.on("order:status_update", handleOrderStatusUpdate);
      WebSocketService.on("order:accepted", handleOrderAccepted);
      WebSocketService.on("order:preparing", handleOrderPreparing);
      WebSocketService.on("order:ready", handleOrderReady);
      WebSocketService.on("order:picked_up", handleOrderPickedUp);
      WebSocketService.on("order:delivered", handleOrderDelivered);
    } catch (error) {
      console.error("WebSocket setup error:", error);
    }
  };

  const handleDriverAssigned = (data: any) => {
    setDriverInfo(data.driver);
    Alert.alert(
      t("driverAssignedTitle"),
      `${data.driver.name} ${t("driverAssignedDesc")}`,
      [{ text: t("ok") }],
    );
  };

  const handleDriverLocationUpdate = (data: any) => {
    let location = data.location;
    if (location.coordinates) {
      location = {
        latitude: location.coordinates[1],
        longitude: location.coordinates[0],
      };
    }

    setDriverLocation(location);
    calculateRoute(location);

    if (mapRef.current && location) {
      mapRef.current.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  const handleOrderStatusUpdate = (data: any) => {
    setCurrentStatus(data.status);
    fetchOrderDetails().catch((refreshError) => {
      console.warn(
        "Failed to refresh order after status update:",
        refreshError,
      );
    });
    if (data.message) {
      Alert.alert(t("statusUpdateTitle"), data.message, [{ text: t("ok") }]);
    }
  };

  const handleOrderAccepted = (data: any) => {
    setCurrentStatus("accepted");
    fetchOrderDetails().catch((refreshError) => {
      console.warn("Failed to refresh order after acceptance:", refreshError);
    });
    Alert.alert(
      t("orderAcceptedTitle"),
      t("orderAcceptedDesc"),
    );
  };

  const handleOrderPreparing = (data: any) => {
    setCurrentStatus("preparing");
    fetchOrderDetails().catch((refreshError) => {
      console.warn("Failed to refresh order while preparing:", refreshError);
    });
  };

  const handleOrderReady = (data: any) => {
    setCurrentStatus("ready");
    fetchOrderDetails().catch((refreshError) => {
      console.warn("Failed to refresh order when ready:", refreshError);
    });
    Alert.alert(t("orderReadyTitle"), t("orderReadyDesc"));
  };

  const handleOrderPickedUp = (data: any) => {
    setCurrentStatus("picked_up");
    fetchOrderDetails().catch((refreshError) => {
      console.warn("Failed to refresh order after pickup:", refreshError);
    });
    Alert.alert(
      t("onTheWayTitle"),
      t("onTheWayDesc"),
    );
  };

  const handleOrderDelivered = (data: any) => {
    setCurrentStatus("delivered");
    fetchOrderDetails().catch((refreshError) => {
      console.warn("Failed to refresh order after delivery:", refreshError);
    });
    Alert.alert(
      t("orderDeliveredTitle"),
      t("orderDeliveredDesc"),
      [
        {
          text: t("rateOrder"),
          onPress: () => setShowRatingModal(true),
        },
      ],
    );
  };

  const calculateRoute = (driverLoc: {
    latitude: number;
    longitude: number;
  }) => {
    if (!userLocation) return;
    setRouteCoordinates([driverLoc, userLocation]);
  };

  const handleCallDriver = () => {
    if (!driverInfo) {
      Alert.alert(t("noDriverTitle"), t("driverNotAssignedYet"));
      return;
    }
    Alert.alert(t("callDriverTitle"), `${t("callDriverPrompt")} ${driverInfo.name}?`, [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("callAction"),
        onPress: () => {
          Linking.openURL(`tel:${driverInfo.phone}`);
        },
      },
    ]);
  };

  const handleMessageDriver = () => {
    if (!driverInfo) {
      Alert.alert(t("noDriverTitle"), t("driverNotAssignedYet"));
      return;
    }
    Linking.openURL(`sms:${driverInfo.phone}`);
  };

  const handleCancelOrder = async () => {
    Alert.alert(t("cancelOrderTitle"), t("cancelOrderConfirm"), [
      { text: t("noAction"), style: "cancel" },
      {
        text: t("yesCancel"),
        style: "destructive",
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem("accessToken");
            if (!token) {
              Alert.alert(t("errorTitle"), t("notLoggedIn"));
              return;
            }

            const response = await fetch(
              `${API_BASE_URL}/orders/${orderId}/cancel`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  reason: t("customerRequestedCancellation"),
                }),
              },
            );

            const data = await response.json();

            if (response.ok) {
              setCurrentStatus("cancelled");

              dispatch({
                type: "UPDATE_ORDER_STATUS",
                payload: { orderId, status: "cancelled" },
              });

              Alert.alert(
                t("orderCancelledTitle"),
                data.message || t("orderCancelledSuccess"),
              );
              setTimeout(() => {
                router.replace("/(customer)/home");
              }, 2000);
            } else {
              throw new Error(data.error || t("cancelOrderFailed"));
            }
          } catch (error: any) {
            Alert.alert(t("errorTitle"), error.message || t("cancelOrderFailed"));
          }
        },
      },
    ]);
  };

  const handleContactRestaurant = () => {
    Alert.alert(t("contactRestaurantTitle"), t("featureComingSoon"), [
      { text: t("ok") },
    ]);
  };

  const handleViewOrderDetails = () => {
    Alert.alert(t("orderDetailsTitle"), t("orderDetailsFeatureComingSoon"), [
      { text: t("ok") },
    ]);
  };

  const handleHelp = () => {
    Alert.alert(t("helpTitle"), t("helpFeatureComingSoon"), [{ text: t("ok") }]);
  };

  const handleRetry = () => {
    initializeTracking();
  };

  const canCancelOrder = () => {
    const cancellableStatuses: OrderStatus["status"][] = [
      "pending",
      "accepted",
      "preparing",
      "ready",
      "picked_up",
    ];
    return cancellableStatuses.includes(currentStatus);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={colors.background}
        />
        <ActivityIndicator size='large' color={colors.primary} />
        <Text style={styles.loadingText}>{t("loadingOrderDetails")}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={colors.background}
        />
        <Ionicons name='alert-circle' size={64} color={colors.error} />
        <Text style={styles.errorTitle}>{t("somethingWentWrong")}</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
          <Text style={styles.retryButtonText}>{t("tryAgain")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.goBackButton}
          onPress={() => router.back()}
        >
          <Text style={styles.goBackButtonText}>{t("goBack")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (currentStatus === "cancelled") {
    return (
      <View style={styles.container}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={colors.background}
        />
        <Stack.Screen options={{ title: t("orderCancelledTitle") }} />
        <View style={styles.centeredContent}>
          <Ionicons name='close-circle' size={80} color={colors.error} />
          <Text style={styles.cancelledTitle}>{t("orderCancelledTitle")}</Text>
          <Text style={styles.cancelledMessage}>
            {t("orderCancelledSuccess")}
          </Text>
          <Text style={styles.cancelledSubMessage}>
            {t("refundNotice")}
          </Text>
          <AnimatedButton
            title={t("backToHome")}
            onPress={() => router.replace("/(customer)/home")}
            style={styles.homeButton}
          />
        </View>
      </View>
    );
  }

  if (currentStatus === "delivered") {
    return (
      <View style={styles.container}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={colors.background}
        />
        <Stack.Screen options={{ title: t("orderDeliveredTitleShort") }} />
        <View style={styles.centeredContent}>
          <Ionicons name='checkmark-circle' size={80} color={colors.success} />
          <Text style={styles.deliveredTitle}>🎉 {t("orderDeliveredTitleShort")}</Text>
          <Text style={styles.deliveredMessage}>
            {t("foodDeliveredEnjoy")}
          </Text>
          {orderDetails && (
            <View style={styles.deliverySummary}>
              <Text style={styles.summaryTitle}>{t("orderSummary")}</Text>
              <Text style={styles.summaryText}>
                {t("restaurantFallback")}: {orderDetails.restaurant_name}
              </Text>
              <Text style={styles.summaryText}>
                {t("totalLabel")}: {orderDetails.total_amount.toFixed(2)} {t("birr")}
              </Text>
              <Text style={styles.summaryText}>
                {t("deliveredAt")}:{" "}
                {new Date(orderDetails.created_at).toLocaleTimeString()}
              </Text>
            </View>
          )}
          <View style={styles.deliveredActions}>
            {orderDetails?.rating ? (
              <View style={styles.thanksForRating}>
                <Ionicons name='star' size={20} color={colors.warning} />
                <Text style={styles.thanksForRatingText}>
                  {t("thanksForRating")}
                </Text>
              </View>
            ) : (
              <AnimatedButton
                title={t("rateYourOrder")}
                onPress={() => setShowRatingModal(true)}
                style={styles.rateButton}
              />
            )}
            <AnimatedButton
              title={t("backToHome")}
              onPress={() => router.replace("/(customer)/home")}
              variant='outline'
              style={styles.homeButton}
            />
          </View>
        </View>
        <RateOrderModal
          visible={showRatingModal}
          orderId={orderId}
          onClose={() => setShowRatingModal(false)}
          onSubmitted={(rating) => {
            setShowRatingModal(false);
            setOrderDetails((prev) => (prev ? { ...prev, rating } : prev));
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle='light-content' backgroundColor={colors.primary} />
      <Stack.Screen
        options={{
          title: t("trackOrder"),
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: "#FFFFFF",
        }}
      />

      {/* Map Section */}
      <View style={styles.mapSection}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: userLocation?.latitude || 9.032,
            longitude: userLocation?.longitude || 38.75,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showsUserLocation={true}
          showsMyLocationButton={true}
        >
          {restaurantLocation && (
            <Marker
              coordinate={restaurantLocation}
              title={
                orderDetails?.restaurant_name || restaurantName || t("restaurantFallback")
              }
              description={t("pickupLocation")}
            >
              <View style={styles.restaurantMarker}>
                <Ionicons name='restaurant' size={20} color="#FFFFFF" />
              </View>
            </Marker>
          )}
          {driverLocation && (
            <Marker
              coordinate={driverLocation}
              title={driverInfo?.name || t("driverLabel")}
              description={t("yourDeliveryDriver")}
            >
              <View style={styles.driverMarker}>
                <Ionicons name='bicycle' size={20} color="#FFFFFF" />
              </View>
            </Marker>
          )}
          {userLocation && (
            <Marker
              coordinate={userLocation}
              title={t("youLabel")}
              description={t("deliveryDestination")}
              pinColor={colors.primary}
            />
          )}
          {routeCoordinates.length > 0 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor={colors.primary}
              strokeWidth={3}
              lineDashPattern={[10, 10]}
            />
          )}
        </MapView>

        <View style={styles.connectionStatus}>
          <View
            style={[
              styles.connectionDot,
              {
                backgroundColor: webSocketConnected
                  ? colors.success
                  : colors.error,
              },
            ]}
          />
          <Text style={styles.connectionText}>
            {webSocketConnected ? t("liveTracking") : t("reconnecting")}
          </Text>
        </View>
      </View>

      {/* Tracking Info */}
      <ScrollView
        style={styles.trackingSection}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusHeader}>
          {!driverInfo && (
              <View style={styles.timeRemaining}>
                <Text style={styles.timeLabel}>{t("autoCancelIn")}</Text>
                <Text style={styles.timeValue}>{timeRemaining} {t("minAbbrev")}</Text>
              </View>
            )}
          <View style={styles.currentStatus}>
            <Ionicons
              name={statusIcons[currentStatus] as any}
              size={24}
              color={statusColors[currentStatus]}
            />
            <Text
              style={[
                styles.statusText,
                { color: statusColors[currentStatus] },
              ]}
            >
              {currentStatus.charAt(0).toUpperCase() +
                currentStatus.slice(1).replace("_", " ")}
            </Text>
          </View>
        </View>

        <ProgressStepper
          steps={statusSteps}
          currentStep={getCurrentStep()}
          showLabels={true}
        />

        {driverInfo ? (
          <View style={styles.driverInfoCard}>
            <Text style={styles.sectionTitle}>{t("yourDriver")}</Text>
            <View style={styles.driverInfo}>
              <View style={styles.driverAvatar}>
                {driverInfo.profile_picture ? (
                  <Image
                    source={{ uri: driverInfo.profile_picture }}
                    style={styles.driverImage}
                  />
                ) : (
                  <Text style={styles.driverInitial}>
                    {driverInfo.name.charAt(0)}
                  </Text>
                )}
              </View>
              <View style={styles.driverDetails}>
                <Text style={styles.driverName}>{driverInfo.name}</Text>
                <Text style={styles.phoneNumber}>{driverInfo.phone}</Text>
                <View style={styles.driverStats}>
                  <Text style={styles.vehicleInfo}>
                    {driverInfo.vehicle_type} • {driverInfo.license_plate}
                  </Text>
                  <Text style={styles.rating}>
                    ⭐ {driverInfo.rating.toFixed(1)} (
                    {driverInfo.completed_deliveries} {t("deliveriesLabel")})
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.driverActions}>
              <TouchableOpacity
                style={styles.callDriverButton}
                onPress={handleCallDriver}
              >
                <Ionicons name='call' size={20} color="#FFFFFF" />
                <Text style={styles.callDriverText}>{t("callDriverTitle")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.messageDriverButton}
                onPress={handleMessageDriver}
              >
                <Ionicons
                  name='chatbubble-ellipses'
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.messageDriverText}>{t("messageLabel")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.noDriverCard}>
            <Ionicons name='time' size={24} color={colors.gray500} />
            <Text style={styles.noDriverText}>
              {t("waitingForDriver")}
            </Text>
            <ActivityIndicator size='small' color={colors.primary} />
          </View>
        )}

        {orderDetails && (
          <View style={styles.orderDetailsCard}>
            <Text style={styles.sectionTitle}>{t("orderDetailsTitle")}</Text>
            <View style={styles.orderInfoRow}>
              <Ionicons name='restaurant' size={20} color={colors.gray600} />
              <Text style={styles.orderInfoText}>
                {orderDetails.restaurant_name}
              </Text>
            </View>
            <View style={styles.orderInfoRow}>
              <Ionicons name='location' size={20} color={colors.gray600} />
              <Text style={styles.orderInfoText}>
                {orderDetails.delivery_address}
              </Text>
            </View>
            <View style={styles.orderInfoRow}>
              <Ionicons name='time' size={20} color={colors.gray600} />
              <Text style={styles.orderInfoText}>
                {t("orderedAt")}{" "}
                {new Date(orderDetails.created_at).toLocaleTimeString()}
              </Text>
            </View>
            <View style={styles.orderInfoRow}>
              <Ionicons
                name={
                  orderDetails.payment_status === "paid"
                    ? "checkmark-circle"
                    : "time-outline"
                }
                size={20}
                color={
                  orderDetails.payment_status === "paid"
                    ? colors.success
                    : colors.warning
                }
              />
              <Text style={styles.orderInfoText}>
                {t("paymentLabel")}: {orderDetails.payment_status || t("pendingLabel")}
                {orderDetails.payment_method
                  ? ` ${t("viaLabel")} ${orderDetails.payment_method.replace("_", " ")}`
                  : ""}
              </Text>
            </View>
            {orderDetails.payment_verification?.transaction_reference && (
              <View style={styles.orderInfoRow}>
                <Ionicons
                  name='receipt-outline'
                  size={20}
                  color={colors.gray600}
                />
                <Text style={styles.orderInfoText}>
                  {t("refLabel")}: {orderDetails.payment_verification.transaction_reference}
                </Text>
              </View>
            )}
            {orderDetails.payment_verification?.proof_url && (
              <TouchableOpacity
                style={styles.orderInfoRow}
                onPress={() =>
                  Linking.openURL(orderDetails.payment_verification!.proof_url!)
                }
              >
                <Ionicons
                  name='image-outline'
                  size={20}
                  color={colors.gray600}
                />
                <Text style={styles.orderInfoText}>
                  {t("paymentScreenshotSubmitted")}
                  {orderDetails.payment_verification.status === "pending_review"
                    ? ` ${t("forAdminReview")}`
                    : ""}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.viewOrderButton}
              onPress={handleViewOrderDetails}
            >
              <Text style={styles.viewOrderText}>{t("viewFullOrderDetails")}</Text>
              <Ionicons
                name='chevron-forward'
                size={20}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.actionsSection}>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.restaurantContactButton}
              onPress={handleContactRestaurant}
            >
              <Ionicons name='business' size={20} color="#FFFFFF" />
              <Text style={styles.restaurantContactText}>
                {t("contactRestaurantTitle")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.helpButton} onPress={handleHelp}>
              <Ionicons name='help-circle' size={20} color={colors.primary} />
              <Text style={styles.helpText}>{t("helpTitle")}</Text>
            </TouchableOpacity>
          </View>
          {canCancelOrder() && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelOrder}
            >
              <Text style={styles.cancelButtonText}>{t("cancelOrderTitle")}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.white,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.gray600,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.white,
    paddingHorizontal: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.gray800,
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: colors.gray600,
    textAlign: "center",
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
    width: "100%",
    alignItems: "center",
  },
  retryButtonText: {
    // Sits on a solid colors.primary button in both themes.
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  goBackButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray300,
    width: "100%",
    alignItems: "center",
  },
  goBackButtonText: {
    color: colors.gray700,
    fontSize: 16,
    fontWeight: "600",
  },
  mapSection: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  connectionStatus: {
    position: "absolute",
    top: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  connectionText: {
    fontSize: 12,
    color: colors.gray700,
    fontWeight: "500",
  },
  trackingSection: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "50%",
  },
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  timeRemaining: {
    alignItems: "flex-start",
  },
  timeLabel: {
    fontSize: 14,
    color: colors.gray600,
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 36,
    fontWeight: "bold",
    color: colors.primary,
  },
  currentStatus: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.gray50,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  restaurantMarker: {
    backgroundColor: colors.warning,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: colors.white,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  driverMarker: {
    backgroundColor: colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: colors.white,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  driverInfoCard: {
    backgroundColor: colors.gray50,
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.gray800,
    marginBottom: 16,
  },
  driverInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  driverAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    overflow: "hidden",
  },
  driverImage: {
    width: "100%",
    height: "100%",
  },
  driverInitial: {
    fontSize: 24,
    fontWeight: "bold",
    // Sits on a solid colors.primary avatar circle in both themes.
    color: "#FFFFFF",
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.gray800,
    marginBottom: 2,
  },
  phoneNumber: {
    fontSize: 14,
    color: colors.gray600,
    marginBottom: 4,
  },
  driverStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  vehicleInfo: {
    fontSize: 12,
    color: colors.gray600,
    backgroundColor: colors.gray100,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  rating: {
    fontSize: 12,
    color: colors.gray600,
  },
  driverActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  callDriverButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  callDriverText: {
    // Sits on a solid colors.primary button in both themes.
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  messageDriverButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  messageDriverText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  noDriverCard: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gray50,
    borderRadius: 16,
    padding: 32,
    marginTop: 24,
    gap: 12,
  },
  noDriverText: {
    fontSize: 16,
    color: colors.gray600,
    textAlign: "center",
  },
  orderDetailsCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  orderInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  orderInfoText: {
    fontSize: 14,
    color: colors.gray700,
    flex: 1,
  },
  viewOrderButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingVertical: 8,
  },
  viewOrderText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "500",
  },
  actionsSection: {
    marginTop: 24,
    gap: 12,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  restaurantContactButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.info,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  restaurantContactText: {
    // Sits on a solid colors.info button in both themes.
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  helpButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  helpText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  cancelButton: {
    alignItems: "center",
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  cancelButtonText: {
    fontSize: 16,
    color: colors.error,
    fontWeight: "600",
  },
  centeredContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  cancelledTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.error,
    marginTop: 16,
    marginBottom: 8,
  },
  cancelledMessage: {
    fontSize: 16,
    color: colors.gray600,
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 24,
  },
  cancelledSubMessage: {
    fontSize: 14,
    color: colors.gray500,
    textAlign: "center",
    marginBottom: 32,
  },
  deliveredTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: colors.success,
    marginTop: 16,
    marginBottom: 8,
  },
  deliveredMessage: {
    fontSize: 18,
    color: colors.gray600,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 24,
  },
  deliverySummary: {
    backgroundColor: colors.gray50,
    padding: 16,
    borderRadius: 12,
    width: "100%",
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.gray800,
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 14,
    color: colors.gray600,
    marginBottom: 4,
  },
  deliveredActions: {
    width: "100%",
    gap: 12,
  },
  rateButton: {
    width: "100%",
    marginBottom: 8,
  },
  thanksForRating: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.warningLight,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 8,
    gap: 8,
  },
  thanksForRatingText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.gray800,
  },
  homeButton: {
    width: "100%",
  },
});

export default OrderTrackingScreen;
