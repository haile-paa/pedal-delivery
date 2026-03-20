import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { colors } from "../../theme/colors";
import AnimatedButton from "../../components/ui/AnimatedButton";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import WebSocketService from "../../services/websocket.service";

interface Coordinates {
  latitude: number;
  longitude: number;
}

const NavigationScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{
    orderId: string;
    restLat: string;
    restLng: string;
    custLat: string;
    custLng: string;
    restaurantName: string;
    customerAddress: string;
  }>();

  const mapRef = useRef<MapView>(null);
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(
    null,
  );
  const [destination, setDestination] = useState<Coordinates | null>(null);
  const [destinationType, setDestinationType] = useState<
    "restaurant" | "customer"
  >("restaurant");
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinates[]>([]);
  const [distanceRemaining, setDistanceRemaining] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [locationSubscription, setLocationSubscription] =
    useState<Location.LocationSubscription | null>(null);

  // Destination coordinates from params
  const restaurantLocation: Coordinates = {
    latitude: parseFloat(params.restLat || "0"),
    longitude: parseFloat(params.restLng || "0"),
  };
  const customerLocation: Coordinates = {
    latitude: parseFloat(params.custLat || "0"),
    longitude: parseFloat(params.custLng || "0"),
  };

  // Start navigation to restaurant by default
  useEffect(() => {
    if (restaurantLocation.latitude && restaurantLocation.longitude) {
      setDestination(restaurantLocation);
      setDestinationType("restaurant");
    }
  }, []);

  // Request location permission and start watching position
  useEffect(() => {
    const startLocationTracking = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Cannot access location");
        return;
      }

      // Get initial location
      const location = await Location.getCurrentPositionAsync({});
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      // Subscribe to location updates
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

          // Send driver location via WebSocket if online
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
      setLocationSubscription(subscription);
    };

    startLocationTracking();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  // Update route and distance when current location or destination changes
  useEffect(() => {
    if (currentLocation && destination) {
      // Calculate straight‑line distance
      const dist = calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        destination.latitude,
        destination.longitude,
      );
      setDistanceRemaining(dist);
      setTimeRemaining(Math.round(dist * 12)); // rough estimate: 5 min per km → 12 km/h

      // Create a simple straight‑line polyline (just start and end)
      setRouteCoordinates([currentLocation, destination]);

      // If we're very close to destination, prompt arrival
      if (dist < 0.1) {
        // 100 meters
        handleArrival();
      }
    }
  }, [currentLocation, destination]);

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

  const handleArrival = () => {
    if (!destination) return;

    if (destinationType === "restaurant") {
      Alert.alert("Arrived at Restaurant", "Have you picked up the order?", [
        { text: "Not Yet", style: "cancel" },
        {
          text: "Yes, Picked Up",
          onPress: async () => {
            // Update order status to 'picked_up'
            try {
              const token = await AsyncStorage.getItem("accessToken");
              await fetch(
                `https://pedal-delivery-back.onrender.com/api/v1/orders/${params.orderId}/status`,
                {
                  method: "PUT",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ status: "picked_up" }),
                },
              );
              // Switch destination to customer
              setDestination(customerLocation);
              setDestinationType("customer");
            } catch (error) {
              console.error("Failed to update order status", error);
            }
          },
        },
      ]);
    } else if (destinationType === "customer") {
      Alert.alert("Arrived at Customer", "Mark order as delivered?", [
        { text: "Not Yet", style: "cancel" },
        {
          text: "Delivered",
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem("accessToken");
              await fetch(
                `https://pedal-delivery-back.onrender.com/api/v1/orders/${params.orderId}/status`,
                {
                  method: "PUT",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ status: "delivered" }),
                },
              );
              Alert.alert("Delivery Complete", "Thank you for delivering!", [
                {
                  text: "OK",
                  onPress: () => router.push("/(driver)/dashboard"),
                },
              ]);
            } catch (error) {
              console.error("Failed to mark delivered", error);
            }
          },
        },
      ]);
    }
  };

  const handleCallCustomer = () => {
    const phone = ""; // We don't have phone in params; could fetch from order details
    Alert.alert("Call Customer", "Call customer for delivery instructions?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Call",
        onPress: () => {
          // In a real app, open phone dialer
          Alert.alert("Calling", "This would open the phone dialer");
        },
      },
    ]);
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

  if (!currentLocation) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle='light-content' />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

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

        {/* Restaurant Marker */}
        {restaurantLocation.latitude !== 0 && (
          <Marker
            coordinate={restaurantLocation}
            title={params.restaurantName || "Restaurant"}
          >
            <View style={[styles.marker, styles.restaurantMarker]}>
              <Ionicons name='restaurant' size={20} color={colors.white} />
            </View>
          </Marker>
        )}

        {/* Customer Marker */}
        {customerLocation.latitude !== 0 && (
          <Marker
            coordinate={customerLocation}
            title='Customer'
            description={params.customerAddress}
          >
            <View style={[styles.marker, styles.customerMarker]}>
              <Ionicons name='home' size={20} color={colors.white} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Navigation Info Overlay */}
      <View style={styles.infoOverlay}>
        <View style={styles.infoCard}>
          <Text style={styles.destinationLabel}>
            {destinationType === "restaurant" ? "To Restaurant" : "To Customer"}
          </Text>
          <Text style={styles.destinationName}>
            {destinationType === "restaurant"
              ? params.restaurantName
              : params.customerAddress}
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
      </View>

      {/* Action Buttons */}
      <View style={styles.actionOverlay}>
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleCallCustomer}
          >
            <Ionicons name='call' size={20} color={colors.info} />
            <Text style={styles.secondaryButtonText}>Call</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={fitMapToRoute}
          >
            <Ionicons name='locate' size={20} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>Fit Route</Text>
          </TouchableOpacity>
        </View>

        <AnimatedButton
          title={
            destinationType === "restaurant"
              ? "I've Arrived at Restaurant"
              : "I've Arrived at Customer"
          }
          onPress={handleArrival}
          fullWidth
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
  map: {
    width: "100%",
    height: "100%",
  },
  infoOverlay: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
  },
  infoCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    shadowColor: colors.black,
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
