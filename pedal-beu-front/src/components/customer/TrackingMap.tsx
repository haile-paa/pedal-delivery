import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Dimensions, Text } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { colors } from "../../theme/colors";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface Location {
  latitude: number;
  longitude: number;
}

interface TrackingMapProps {
  driverLocation: Location;
  userLocation: Location;
  restaurantLocation: Location;
  routeCoordinates?: Location[];
}

const TrackingMap: React.FC<TrackingMapProps> = ({
  driverLocation,
  userLocation,
  restaurantLocation,
  routeCoordinates = [],
}) => {
  const mapRef = useRef<MapView>(null);
  const pulseAnim = useSharedValue(1);

  // Pulsing animation for driver marker
  useEffect(() => {
    pulseAnim.value = withRepeat(
      withTiming(1.2, {
        duration: 1000,
        easing: Easing.ease,
      }),
      -1,
      true
    );
  }, []);

  // Fit map to show all markers
  useEffect(() => {
    if (mapRef.current) {
      const coordinates = [driverLocation, userLocation, restaurantLocation];
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  }, [driverLocation, userLocation, restaurantLocation]);

  const driverAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
        showsCompass={true}
        zoomControlEnabled={true}
      >
        {/* Route Line */}
        {routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor={colors.primary}
            strokeWidth={3}
            lineDashPattern={[10, 10]}
          />
        )}

        {/* Restaurant Marker */}
        <Marker
          coordinate={restaurantLocation}
          title='Restaurant'
          description='Pickup location'
        >
          <View style={styles.restaurantMarker}>
            <View style={styles.restaurantIcon}>
              {/* <LottieView
                source={require("../../assets/animations/restaurant.json")}
                autoPlay
                loop
                style={styles.markerAnimation}
              /> */}
            </View>
          </View>
        </Marker>

        {/* Driver Marker */}
        <Marker
          coordinate={driverLocation}
          title='Driver'
          description='Your food is here'
        >
          <Animated.View style={[styles.driverMarker, driverAnimatedStyle]}>
            {/* <LottieView
              source={require("../../assets/animations/moving-bike.json")}
              autoPlay
              loop
              style={styles.markerAnimation}
            /> */}
          </Animated.View>
        </Marker>

        {/* User Marker */}
        <Marker
          coordinate={userLocation}
          title='Your Location'
          description='Delivery destination'
        >
          <View style={styles.userMarker}>
            <View style={styles.userIcon} />
          </View>
        </Marker>
      </MapView>

      {/* Tracking Info Overlay */}
      <View style={styles.infoOverlay}>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={[styles.statusDot, styles.statusPreparing]} />
            <Text style={styles.infoText}>Order Preparing</Text>
          </View>
          <View style={styles.infoRow}>
            <View style={[styles.statusDot, styles.statusOnWay]} />
            <Text style={styles.infoText}>Driver On The Way</Text>
          </View>
          <View style={styles.infoRow}>
            <View style={[styles.statusDot, styles.statusDelivered]} />
            <Text style={styles.infoText}>Delivered</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
  },
  restaurantMarker: {
    alignItems: "center",
  },
  restaurantIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.primary,
  },
  driverMarker: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  userMarker: {
    alignItems: "center",
  },
  userIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markerAnimation: {
    width: 40,
    height: 40,
  },
  infoOverlay: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
  },
  infoCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusPreparing: {
    backgroundColor: colors.warning,
  },
  statusOnWay: {
    backgroundColor: colors.primary,
  },
  statusDelivered: {
    backgroundColor: colors.success,
  },
  infoText: {
    fontSize: 14,
    color: colors.gray700,
    fontWeight: "500",
  },
});

export default TrackingMap;
