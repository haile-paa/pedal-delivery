import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Dimensions, Text } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// A muted, low-saturation night map style so the map itself doesn't glow
// bright white/grey and break the surrounding dark UI.
const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1A1A20" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1A1A20" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8A8A99" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#C4B5FD" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8A8A99" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#20261F" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#2B2B33" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8A8A99" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#3A3A45" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#2B2B33" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#0F1420" }],
  },
];

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
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const styles = getStyles(colors, isDark);
  const mapRef = useRef<MapView>(null);
  const pulseAnim = useSharedValue(1);

  // Pulsing animation for driver marker. This runs on an infinite loop
  // (withRepeat) and keeps writing to the UI thread every frame. Order
  // tracking navigates away with router.replace("/(customer)/home") once
  // an order completes/cancels — without cancelling this loop first, a
  // still-in-flight animation frame can land in the same Fabric commit as
  // that navigation's screen swap, which throws "addViewAt: failed to
  // insert view ... already has a parent" on Android. Cancel on unmount so
  // that can't happen.
  useEffect(() => {
    pulseAnim.value = withRepeat(
      withTiming(1.2, {
        duration: 1000,
        easing: Easing.ease,
      }),
      -1,
      true
    );

    return () => {
      cancelAnimation(pulseAnim);
    };
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
        provider={PROVIDER_GOOGLE}
        customMapStyle={isDark ? DARK_MAP_STYLE : []}
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
          title={t("restaurantFallback")}
          description={t("pickupLocation")}
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
          title={t("driverLabel")}
          description={t("foodIsHere")}
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
          title={t("yourLocation")}
          description={t("deliveryDestination")}
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
            <Text style={styles.infoText}>{t("orderPreparing")}</Text>
          </View>
          <View style={styles.infoRow}>
            <View style={[styles.statusDot, styles.statusOnWay]} />
            <Text style={styles.infoText}>{t("driverOnTheWay")}</Text>
          </View>
          <View style={styles.infoRow}>
            <View style={[styles.statusDot, styles.statusDelivered]} />
            <Text style={styles.infoText}>{t("delivered")}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
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
      backgroundColor: colors.card,
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
      borderColor: colors.card,
      shadowColor: isDark ? colors.primaryGlow : colors.shadow,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: isDark ? 0.5 : 0.3,
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
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: isDark ? 1 : 0,
      borderColor: "rgba(255,255,255,0.08)",
      shadowColor: isDark ? colors.primaryGlow : colors.shadow,
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: isDark ? 0.3 : 0.2,
      shadowRadius: isDark ? 12 : 8,
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
