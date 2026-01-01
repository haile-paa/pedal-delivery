import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Alert,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { colors } from "../../theme/colors";
import AnimatedButton from "../../components/ui/AnimatedButton";
import { useRouter } from "expo-router";

const NavigationScreen: React.FC = () => {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [navigationStarted, setNavigationStarted] = useState(false);
  const [currentLocation, setCurrentLocation] = useState({
    latitude: 40.7128,
    longitude: -74.006,
  });
  const [destination, setDestination] = useState({
    latitude: 40.758,
    longitude: -73.9855,
  });
  const [routeCoordinates, setRouteCoordinates] = useState([
    { latitude: 40.7128, longitude: -74.006 },
    { latitude: 40.72, longitude: -73.99 },
    { latitude: 40.73, longitude: -73.98 },
    { latitude: 40.74, longitude: -73.97 },
    { latitude: 40.758, longitude: -73.9855 },
  ]);
  const [timeRemaining, setTimeRemaining] = useState(25); // minutes
  const [distanceRemaining, setDistanceRemaining] = useState(4.5); // km

  // Simulate movement along the route
  useEffect(() => {
    if (!navigationStarted) return;

    const interval = setInterval(() => {
      setCurrentLocation((prev) => {
        // Move along the route
        const nextIndex = routeCoordinates.findIndex(
          (coord) =>
            coord.latitude > prev.latitude && coord.longitude > prev.longitude
        );

        if (nextIndex >= 0 && nextIndex < routeCoordinates.length) {
          return routeCoordinates[nextIndex];
        }

        // If at destination
        if (
          Math.abs(prev.latitude - destination.latitude) < 0.001 &&
          Math.abs(prev.longitude - destination.longitude) < 0.001
        ) {
          clearInterval(interval);
          Alert.alert(
            "Arrived at Destination",
            "You have arrived at the delivery location.",
            [{ text: "OK", onPress: () => router.back() }]
          );
          return prev;
        }

        return prev;
      });

      // Update time and distance
      if (timeRemaining > 0) {
        setTimeRemaining((prev) => Math.max(0, prev - 0.5));
        setDistanceRemaining((prev) => Math.max(0, prev - 0.1));
      }
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [navigationStarted, timeRemaining]);

  const handleStartNavigation = () => {
    setNavigationStarted(true);

    // Fit map to route
    if (mapRef.current) {
      mapRef.current.fitToCoordinates(routeCoordinates, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  };

  const handleArrived = () => {
    Alert.alert(
      "Arrived at Destination",
      "Have you arrived at the delivery location?",
      [
        { text: "Not Yet", style: "cancel" },
        {
          text: "Yes, Arrived",
          onPress: () => {
            setNavigationStarted(false);
            router.push("/(driver)/order-detail");
          },
        },
      ]
    );
  };

  const handleCallCustomer = () => {
    Alert.alert("Call Customer", "Call customer for delivery instructions?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Call",
        onPress: () => Alert.alert("Calling", "Connecting to customer..."),
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle='light-content' />

      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
        showsCompass={true}
        zoomControlEnabled={true}
      >
        {/* Route Line */}
        <Polyline
          coordinates={routeCoordinates}
          strokeColor={colors.primary}
          strokeWidth={4}
          lineDashPattern={[10, 10]}
        />

        {/* Current Location Marker */}
        <Marker coordinate={currentLocation} title='Your Location'>
          <View style={styles.currentMarker}>
            <View style={styles.currentMarkerInner} />
          </View>
        </Marker>

        {/* Destination Marker */}
        <Marker coordinate={destination} title='Delivery Location'>
          <View style={styles.destinationMarker}>
            <Text style={styles.markerText}>🏠</Text>
          </View>
        </Marker>
      </MapView>

      {/* Navigation Info Overlay */}
      <View style={styles.infoOverlay}>
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Text style={styles.infoTitle}>Delivery Navigation</Text>
            <Text style={styles.orderId}>Order #ORD001</Text>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{timeRemaining.toFixed(0)}</Text>
              <Text style={styles.statLabel}>min</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {distanceRemaining.toFixed(1)}
              </Text>
              <Text style={styles.statLabel}>km</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>2</Text>
              <Text style={styles.statLabel}>stops</Text>
            </View>
          </View>

          <View style={styles.destinationInfo}>
            <Text style={styles.destinationLabel}>Delivering to:</Text>
            <Text style={styles.destinationAddress}>
              123 Main St, New York, NY 10001
            </Text>
            <Text style={styles.customerName}>John Doe • (555) 123-4567</Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionOverlay}>
        {!navigationStarted ? (
          <AnimatedButton
            title='Start Navigation'
            onPress={handleStartNavigation}
            fullWidth
            size='large'
          />
        ) : (
          <View style={styles.navigationActions}>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleCallCustomer}
              >
                <Text style={styles.secondaryButtonText}>📞 Call Customer</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() =>
                  Alert.alert("Instructions", "View delivery instructions")
                }
              >
                <Text style={styles.secondaryButtonText}>📋 Instructions</Text>
              </TouchableOpacity>
            </View>

            <AnimatedButton
              title="✅ I've Arrived"
              onPress={handleArrived}
              fullWidth
            />
          </View>
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
    padding: 20,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  infoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.gray900,
  },
  orderId: {
    fontSize: 14,
    color: colors.gray500,
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: colors.gray50,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.gray600,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.gray200,
  },
  destinationInfo: {
    marginBottom: 10,
  },
  destinationLabel: {
    fontSize: 12,
    color: colors.gray500,
    marginBottom: 4,
  },
  destinationAddress: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.gray800,
    marginBottom: 4,
  },
  customerName: {
    fontSize: 14,
    color: colors.gray600,
  },
  actionOverlay: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
  },
  navigationActions: {
    gap: 12,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: colors.white,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.gray200,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray700,
  },
  currentMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary + "40",
    justifyContent: "center",
    alignItems: "center",
  },
  currentMarkerInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  destinationMarker: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.white,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  markerText: {
    fontSize: 24,
  },
});

export default NavigationScreen;
