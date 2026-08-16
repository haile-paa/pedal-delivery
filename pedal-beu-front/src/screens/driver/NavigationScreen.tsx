import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  Linking,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { useTheme } from "../../context/ThemeContext";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
import { useKeepAwake } from "expo-keep-awake";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import WebSocketService from "../../services/websocket.service";
import { API_BASE_URL } from "../../utils/constants";
import { reverseGeocodeToAddress } from "../../utils/reverseGeocode";

interface Coordinates {
  latitude: number;
  longitude: number;
}

// Everything the map needs to show "full details" for each stop — pulled
// fresh from GET /orders/:id rather than tunneled through router params, so
// this screen works from ANY entry point (order detail, the dashboard's
// quick-navigate button, a push notification deep link, etc.) as long as it
// has an orderId. It also means phone numbers and full addresses — which
// previously never made it to this screen at all — are always available.
interface OrderLocations {
  orderNumber: string;
  status: string;
  restaurant: {
    name: string;
    address: string;
    phone?: string;
    location: Coordinates | null;
  };
  customer: {
    name: string;
    address: string;
    phone: string;
    location: Coordinates | null;
    specialInstructions?: string;
  };
}

const NavigationScreen: React.FC = () => {
  // Keeps the screen on while navigating a delivery — automatically
  // deactivates when the driver leaves this screen.
  useKeepAwake();

  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId: string }>();

  const mapRef = useRef<MapView>(null);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [order, setOrder] = useState<OrderLocations | null>(null);

  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(
    null,
  );
  const [destinationType, setDestinationType] = useState<
    "restaurant" | "customer"
  >("restaurant");
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinates[]>([]);
  const [distanceRemaining, setDistanceRemaining] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  // A ref, not state: the watchPositionAsync cleanup below runs inside a
  // useEffect with an empty dependency array, so its cleanup closure only
  // ever sees the value this held at mount time. With useState that value
  // was always the initial `null` — the real subscription (set later, once
  // watchPositionAsync resolves) was never visible to the cleanup, so
  // `.remove()` never actually ran and the GPS watcher (and its outgoing
  // location updates) kept running indefinitely after leaving this screen.
  // A ref is mutated in place, so the cleanup always reads the current value.
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(
    null,
  );

  // Which marker's full-detail card is currently open (name/address/phone).
  // null = no card showing.
  const [selectedDetail, setSelectedDetail] = useState<
    "restaurant" | "customer" | null
  >(null);

  const destination =
    order &&
    (destinationType === "restaurant"
      ? order.restaurant.location
      : order.customer.location);

  // Fetch the order's full details (locations, addresses, phone numbers).
  // Same enriched GET /orders/:id endpoint the order-detail and tracking
  // screens use, so restaurant/customer info here is always accurate and
  // current rather than a stale snapshot passed through navigation params.
  const fetchOrder = useCallback(
    async (showLoading: boolean) => {
      if (!params.orderId) {
        setLoadingOrder(false);
        return;
      }
      try {
        if (showLoading) setLoadingOrder(true);
        const token = await AsyncStorage.getItem("accessToken");
        const response = await fetch(
          `${API_BASE_URL}/orders/${params.orderId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.message || "Failed to load order");

        const restLoc = data.restaurant?.location?.coordinates
          ? {
              latitude: data.restaurant.location.coordinates[1],
              longitude: data.restaurant.location.coordinates[0],
            }
          : null;
        const custLoc = data.delivery_info?.address?.location?.coordinates
          ? {
              latitude: data.delivery_info.address.location.coordinates[1],
              longitude: data.delivery_info.address.location.coordinates[0],
            }
          : null;

        setOrder({
          orderNumber: data.order_number,
          status: data.status,
          restaurant: {
            name: data.restaurant?.name || "Restaurant",
            address: data.restaurant?.address || "",
            phone: data.restaurant?.phone,
            location: restLoc,
          },
          customer: {
            name: data.delivery_info?.contact_name || "Customer",
            address: data.delivery_info?.address?.address || "",
            phone: data.delivery_info?.contact_phone || "",
            location: custLoc,
            specialInstructions: data.delivery_info?.notes,
          },
        });

        // Some restaurants were created without an address on file. When
        // that happens but real coordinates exist, fall back to an
        // on-device reverse geocode instead of showing "No address on file".
        if (!data.restaurant?.address && restLoc) {
          reverseGeocodeToAddress(restLoc.latitude, restLoc.longitude).then(
            (resolved) => {
              if (resolved) {
                setOrder((prev) =>
                  prev
                    ? {
                        ...prev,
                        restaurant: { ...prev.restaurant, address: resolved },
                      }
                    : prev,
                );
              }
            },
          );
        }

        // Start at whichever stop the driver hasn't reached yet, so
        // re-opening this screen mid-delivery resumes at the right leg.
        setDestinationType(
          data.status === "picked_up" || data.status === "on_the_way"
            ? "customer"
            : "restaurant",
        );
      } catch (error) {
        console.error("Failed to load order for navigation:", error);
        Alert.alert("Error", "Could not load order details for navigation");
      } finally {
        setLoadingOrder(false);
      }
    },
    [params.orderId],
  );

  useEffect(() => {
    fetchOrder(true);
  }, [fetchOrder]);

  // Re-sync silently (no loading spinner) whenever this screen regains
  // focus, so the destination/status here can't drift out of sync with a
  // status change made elsewhere (e.g. the order detail screen).
  useFocusEffect(
    useCallback(() => {
      fetchOrder(false);
    }, [fetchOrder]),
  );

  // Request location permission and start watching position
  useEffect(() => {
    const startLocationTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Cannot access location");
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10, // update every 10 meters
          timeInterval: 5000, // or every 5 seconds
        },
        (newLocation) => {
          const newCoords = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
          };
          setCurrentLocation(newCoords);

          const sendLocation = async () => {
            const token = await AsyncStorage.getItem("accessToken");
            if (token && WebSocketService.isConnected()) {
              WebSocketService.updateDriverLocation(
                { lat: newCoords.latitude, lng: newCoords.longitude },
                params.orderId,
              );
            }
          };
          sendLocation();
        },
      );
      locationSubscriptionRef.current = subscription;
    };

    startLocationTracking();

    return () => {
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }
    };
  }, []);

  // Update route and distance when current location or destination changes
  useEffect(() => {
    if (currentLocation && destination) {
      const dist = calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        destination.latitude,
        destination.longitude,
      );
      setDistanceRemaining(dist);
      setTimeRemaining(Math.round(dist * 12)); // rough estimate: 5 min per km → 12 km/h
      setRouteCoordinates([currentLocation, destination]);
    }
  }, [currentLocation, destination]);

  // Opens the device's Google Maps app (or Google Maps in the browser if
  // it isn't installed) with turn-by-turn directions from wherever the
  // driver currently is to the given stop.
  const openInGoogleMaps = (dest: Coordinates) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${dest.latitude},${dest.longitude}&travelmode=driving`;
    Linking.openURL(url).catch(() =>
      Alert.alert("Error", "Could not open Google Maps"),
    );
  };

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number => {
    const R = 6371; // km
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

  const fitMapToRoute = () => {
    if (mapRef.current && routeCoordinates.length > 0) {
      mapRef.current.fitToCoordinates(routeCoordinates, {
        edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
        animated: true,
      });
    }
  };

  useEffect(() => {
    if (routeCoordinates.length > 0) {
      fitMapToRoute();
    }
  }, [routeCoordinates]);

  if (loadingOrder || !currentLocation) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle='light-content' />
        <ActivityIndicator size='large' color={colors.primary} />
        <Text style={styles.loadingText}>
          {loadingOrder
            ? "Loading order details..."
            : "Getting your location..."}
        </Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle='light-content' />
        <Text style={styles.loadingText}>Order not found</Text>
      </View>
    );
  }

  const detail =
    selectedDetail === "restaurant"
      ? order.restaurant
      : selectedDetail === "customer"
        ? order.customer
        : null;
  const detailLocation =
    selectedDetail === "restaurant"
      ? order.restaurant.location
      : selectedDetail === "customer"
        ? order.customer.location
        : null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle='light-content' />

      {/* Map */}
      <MapView
        ref={mapRef}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        style={styles.map}
        initialRegion={{
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
        showsCompass={true}
        zoomControlEnabled={true}
        onPress={() => setSelectedDetail(null)}
      >
        {/* Route Line */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={colors.primary}
            strokeWidth={4}
            lineDashPattern={[10, 10]}
          />
        )}

        {/* Restaurant Marker — tap for full details */}
        {order.restaurant.location && (
          <Marker
            coordinate={order.restaurant.location}
            title={order.restaurant.name}
            description='Tap for pickup details'
            onPress={() => setSelectedDetail("restaurant")}
          >
            <View style={[styles.marker, styles.restaurantMarker]}>
              <Ionicons name='restaurant' size={20} color={colors.white} />
            </View>
          </Marker>
        )}

        {/* Customer Marker — tap for full details */}
        {order.customer.location && (
          <Marker
            coordinate={order.customer.location}
            title={order.customer.name}
            description='Tap for delivery details'
            onPress={() => setSelectedDetail("customer")}
          >
            <View style={[styles.marker, styles.customerMarker]}>
              <Ionicons name='home' size={20} color={colors.white} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Top overlay: left/right arrow buttons let the driver flip between
          restaurant and customer details from one fixed spot, in addition
          to tapping the markers directly on the map. */}
      <View style={styles.topOverlay}>
        <TouchableOpacity
          style={styles.topArrowButton}
          onPress={() => setSelectedDetail("restaurant")}
        >
          <Ionicons name='chevron-back' size={22} color={colors.gray700} />
        </TouchableOpacity>

        <View style={styles.topOverlayContent}>
          {!detail ? (
            <View style={styles.infoCard}>
              <Text style={styles.destinationLabel}>
                {destinationType === "restaurant"
                  ? "To Restaurant"
                  : "To Customer"}
              </Text>
              <Text style={styles.destinationName}>
                {destinationType === "restaurant"
                  ? order.restaurant.name
                  : order.customer.name}
              </Text>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {distanceRemaining.toFixed(1)}
                  </Text>
                  <Text style={styles.statLabel}>km</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{timeRemaining}</Text>
                  <Text style={styles.statLabel}>min</Text>
                </View>
              </View>
            </View>
          ) : detailLocation ? (
            /* Full location detail card — name, address, phone with a
               Call button, and a button to open the device's own maps
               app. This is the "full details about those locations"
               piece: tapping a marker, or the arrows above, surfaces
               everything known about that stop. */
            <View style={styles.detailCard}>
              <View style={styles.detailHeader}>
                <View
                  style={[
                    styles.detailIconCircle,
                    selectedDetail === "restaurant"
                      ? styles.restaurantMarker
                      : styles.customerMarker,
                  ]}
                >
                  <Ionicons
                    name={
                      selectedDetail === "restaurant" ? "restaurant" : "home"
                    }
                    size={20}
                    color={colors.white}
                  />
                </View>
                <View style={styles.detailHeaderText}>
                  <Text style={styles.detailLabel}>
                    {selectedDetail === "restaurant"
                      ? "Pickup Location"
                      : "Delivery Location"}
                  </Text>
                  <Text style={styles.detailName}>{detail.name}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedDetail(null)}
                  style={styles.closeButton}
                >
                  <Ionicons name='close' size={20} color={colors.gray500} />
                </TouchableOpacity>
              </View>

              <View style={styles.detailRow}>
                <Ionicons
                  name='location-outline'
                  size={16}
                  color={colors.gray500}
                />
                <Text style={styles.detailText}>
                  {detail.address || "No address on file"}
                </Text>
              </View>

              {detail.phone ? (
                <View style={styles.detailRow}>
                  <Ionicons
                    name='call-outline'
                    size={16}
                    color={colors.gray500}
                  />
                  <Text style={styles.detailText}>{detail.phone}</Text>
                </View>
              ) : null}

              {selectedDetail === "customer" &&
                order.customer.specialInstructions && (
                  <View style={styles.detailRow}>
                    <Ionicons
                      name='information-circle-outline'
                      size={16}
                      color={colors.gray500}
                    />
                    <Text style={styles.detailText}>
                      {order.customer.specialInstructions}
                    </Text>
                  </View>
                )}

              <View style={styles.detailActions}>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => openInGoogleMaps(detailLocation)}
                >
                  <Ionicons
                    name='navigate-outline'
                    size={16}
                    color={colors.gray700}
                  />
                  <Text style={styles.secondaryButtonText}>
                    Get Directions
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.topArrowButton}
          onPress={() => setSelectedDetail("customer")}
        >
          <Ionicons name='chevron-forward' size={22} color={colors.gray700} />
        </TouchableOpacity>
      </View>

      {/* Calling and advancing order status stay on Order Detail — this
          screen is just the map + directions. Back always returns to Order
          Detail for the same order, explicitly: this lives inside a Tabs
          navigator (see app/(driver)/_layout.tsx), where "order-detail",
          "navigation", and "available-orders" are sibling tabs rather than
          a single stack. router.back() there follows tab-focus history,
          which isn't guaranteed to land back on Order Detail — it can
          resolve to whichever tab (e.g. Available Orders) was focused
          before, especially since this screen can also be opened straight
          from the dashboard. Navigating to order-detail by name sidesteps
          that. */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() =>
          router.push({
            pathname: "/(driver)/order-detail" as any,
            params: { orderId: params.orderId },
          })
        }
      >
        <Ionicons name='arrow-back' size={22} color={colors.gray800} />
      </TouchableOpacity>
    </View>
  );
};

const getStyles = (colors: any) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  map: {
    width: "100%",
    height: "100%",
  },
  backButton: {
    position: "absolute",
    top: 16,
    left: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  topOverlay: {
    position: "absolute",
    top: 68,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  topOverlayContent: {
    flex: 1,
  },
  topArrowButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  infoCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  destinationLabel: {
    fontSize: 12,
    color: colors.gray500,
    marginBottom: 4,
  },
  destinationName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.gray800,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: colors.gray50,
    borderRadius: 12,
    padding: 12,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: colors.gray600,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.gray200,
  },
  detailCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  detailIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  detailHeaderText: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: colors.gray500,
  },
  detailName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.gray900,
  },
  closeButton: {
    padding: 4,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 8,
  },
  detailText: {
    flex: 1,
    fontSize: 14,
    color: colors.gray700,
  },
  detailActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  actionOverlay: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.gray200,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray700,
  },
  marker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: colors.white,
  },
  restaurantMarker: {
    backgroundColor: colors.warning,
  },
  customerMarker: {
    backgroundColor: colors.success,
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
});

export default NavigationScreen;