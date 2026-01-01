// components/customer/HomeScreen.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  StatusBar,
  Alert,
  TouchableOpacity,
} from "react-native";
import { useAppState } from "../../context/AppStateContext";
import { Restaurant } from "../../types";
import { colors } from "../../theme/colors";
import RestaurantCard from "../../components/customer/RestaurantCard";
import SearchBarWithFilters from "../../components/ui/SearchBarWithFilters";
import CategoryFilter from "../../components/customer/CategoryFilter";
import LoadingSkeleton from "../../components/ui/LoadingSkeleton";
import { useRouter } from "expo-router";
import { restaurantAPI } from "../../../lib/restaurant";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";

const HomeScreen: React.FC = () => {
  const { state, dispatch } = useAppState();
  const router = useRouter();
  const [filteredRestaurants, setFilteredRestaurants] = useState<Restaurant[]>(
    []
  );
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Get user's first name
  const getUserFirstName = () => {
    const user = state.auth.user;
    if (!user) return "Guest";

    if (user.firstName) return user.firstName;
    if (user.profile?.first_name) return user.profile.first_name;
    if (user.username) return user.username;

    return "Guest";
  };

  // Request location permission using Expo Location
  const requestLocationPermission = async () => {
    setLocationLoading(true);
    setLocationError(null);

    try {
      console.log("Requesting location permissions...");

      // First, check if location services are enabled
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        setLocationError("Location services are disabled on your device");
        setLocationLoading(false);
        loadRestaurants();
        return;
      }

      // Request permissions
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status === "granted") {
        console.log("Location permission granted");
        setHasLocationPermission(true);
        getCurrentLocation();
      } else {
        console.log("Location permission denied:", status);
        setLocationError("Location permission denied");
        setHasLocationPermission(false);
        setLocationLoading(false);
        loadRestaurants();
      }
    } catch (error: any) {
      console.error("Error requesting location permission:", error);
      setLocationError(error.message || "Failed to get location permission");
      setHasLocationPermission(false);
      setLocationLoading(false);
      loadRestaurants();
    }
  };

  // Get current location
  const getCurrentLocation = async () => {
    setLocationLoading(true);
    setLocationError(null);

    try {
      console.log("Getting current location...");

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;
      console.log("Got location:", latitude, longitude);

      // Store location in state
      dispatch({
        type: "SET_LOCATION",
        payload: { latitude, longitude },
      });

      setHasLocationPermission(true);
      setLocationError(null);

      // Load restaurants with location
      loadRestaurants(true, { latitude, longitude });
    } catch (error: any) {
      console.error("Error getting location:", error);
      setLocationError(error.message || "Failed to get location");
      setHasLocationPermission(false);
      setLocationLoading(false);

      // Load restaurants without location
      loadRestaurants();
    }
  };

  // Load restaurants from API - SIMPLIFIED VERSION
  const loadRestaurants = async (
    useLocation: boolean = false,
    location?: { latitude: number; longitude: number }
  ) => {
    console.log("Loading restaurants, useLocation:", useLocation);
    setLoading(true);

    try {
      // Build query parameters
      const params: any = {
        page: 1,
        limit: 20,
      };

      // Only add location if we have it and permission is granted
      if (useLocation && location && hasLocationPermission) {
        params.latitude = location.latitude;
        params.longitude = location.longitude;
        params.radius = 10000;
        params.calculate_distance = true;
      }

      console.log("Fetching restaurants with params:", params);

      const response = await restaurantAPI.getAll(params);
      console.log("Restaurants API response:", {
        success: response.success,
        dataLength: response.data?.length,
        error: response.error,
        pagination: response.pagination,
      });

      if (response.success && response.data) {
        // Log the first restaurant to see its structure
        if (response.data.length > 0) {
          console.log(
            "First restaurant data:",
            JSON.stringify(response.data[0], null, 2)
          );
        }

        dispatch({ type: "SET_RESTAURANTS", payload: response.data });

        // Extract unique categories
        const allCategories = ["All"];
        response.data.forEach((restaurant: Restaurant) => {
          if (
            restaurant.cuisine_type &&
            Array.isArray(restaurant.cuisine_type)
          ) {
            restaurant.cuisine_type.forEach((cuisine: string) => {
              if (cuisine && !allCategories.includes(cuisine)) {
                allCategories.push(cuisine);
              }
            });
          }
        });
        setCategories(allCategories.slice(0, 10));
      } else {
        console.error("Failed to load restaurants:", response.error);
        Alert.alert("Error", response.error || "Failed to load restaurants");
      }
    } catch (error: any) {
      console.error("Error loading restaurants:", error);
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        stack: error.stack,
      });

      Alert.alert(
        "Connection Error",
        "Unable to connect to the server. Please check your internet connection and try again."
      );
    } finally {
      setLoading(false);
      setLocationLoading(false);
    }
  };

  // Filter restaurants based on search and category
  useEffect(() => {
    let filtered = state.restaurants.list;

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (restaurant) =>
          restaurant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (restaurant.cuisine_type &&
            restaurant.cuisine_type.some((cuisine: string) =>
              cuisine.toLowerCase().includes(searchQuery.toLowerCase())
            ))
      );
    }

    // Filter by category
    if (selectedCategory !== "All") {
      filtered = filtered.filter(
        (restaurant) =>
          restaurant.cuisine_type &&
          restaurant.cuisine_type.includes(selectedCategory)
      );
    }

    setFilteredRestaurants(filtered);
  }, [searchQuery, selectedCategory, state.restaurants.list]);

  // Initial load
  useEffect(() => {
    const initialize = async () => {
      // Try to get location first, then load restaurants
      await requestLocationPermission();
    };
    initialize();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRestaurants(
      hasLocationPermission,
      state.location.currentLocation || undefined
    );
    setRefreshing(false);
  }, [hasLocationPermission, state.location.currentLocation]);

  const handleRestaurantPress = (restaurant: Restaurant) => {
    dispatch({ type: "SET_CURRENT_RESTAURANT", payload: restaurant });
    router.push({
      pathname: "/(customer)/restaurant/[id]",
      params: { id: restaurant.id },
    });
  };

  const renderRestaurantItem = useCallback(
    ({ item }: { item: Restaurant }) => (
      <RestaurantCard item={item} onPress={handleRestaurantPress} />
    ),
    []
  );

  const renderSkeleton = useCallback(
    () => <LoadingSkeleton type='restaurant' count={3} />,
    []
  );

  const renderLocationHeader = () => {
    if (locationLoading) {
      return (
        <View style={styles.locationContainer}>
          <Ionicons name='location-outline' size={16} color={colors.gray600} />
          <Text style={styles.locationText}>Getting your location...</Text>
        </View>
      );
    }

    if (locationError) {
      return (
        <View style={styles.locationContainer}>
          <Ionicons name='warning-outline' size={16} color={colors.error} />
          <Text style={styles.locationText}>{locationError}</Text>
          <TouchableOpacity
            style={styles.enableLocationButton}
            onPress={requestLocationPermission}
          >
            <Text style={styles.enableLocationText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (hasLocationPermission && state.location.currentLocation) {
      return (
        <View style={styles.locationContainer}>
          <Ionicons name='location' size={16} color={colors.primary} />
          <Text style={styles.locationText}>Showing restaurants near you</Text>
          <TouchableOpacity
            style={styles.refreshLocationButton}
            onPress={getCurrentLocation}
          >
            <Ionicons name='refresh' size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.locationContainer}>
        <Ionicons name='location-outline' size={16} color={colors.gray600} />
        <Text style={styles.locationText}>Location not enabled</Text>
        <TouchableOpacity
          style={styles.enableLocationButton}
          onPress={requestLocationPermission}
        >
          <Text style={styles.enableLocationText}>Enable</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmptyState = () => {
    if (loading || locationLoading) {
      return null;
    }

    return (
      <View style={styles.emptyState}>
        <Ionicons name='restaurant-outline' size={64} color={colors.gray400} />
        <Text style={styles.emptyStateText}>
          {state.restaurants.list.length === 0
            ? "No restaurants available"
            : "No restaurants match your search"}
        </Text>
        <Text style={styles.emptyStateSubtext}>
          {state.restaurants.list.length === 0
            ? "Please check back later or contact support"
            : "Try adjusting your search or filters"}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle='dark-content' backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {getUserFirstName()} 👋</Text>
          <Text style={styles.subtitle}>
            What would you like to order today?
          </Text>
        </View>
        {state.auth.user && (
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.push("/(customer)/profile")}
          >
            <Ionicons
              name='person-circle-outline'
              size={32}
              color={colors.primary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Location Status */}
      {renderLocationHeader()}

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <SearchBarWithFilters
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder='Search restaurants or cuisines...'
          onFiltersPress={() => {
            Alert.alert("Filters", "Filter functionality coming soon!");
          }}
        />
      </View>

      {/* Categories */}
      {categories.length > 1 && (
        <View style={styles.categoriesSection}>
          <CategoryFilter
            categories={categories}
            selectedCategory={selectedCategory}
            onCategorySelect={(setCategory) => {
              setSelectedCategory(setCategory);
              // No need to reload from API, just filter local data
            }}
          />
        </View>
      )}

      {/* Restaurants List */}
      <View style={styles.restaurantsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {selectedCategory === "All" ? "All Restaurants" : selectedCategory}
            <Text style={styles.restaurantCount}>
              {" "}
              ({filteredRestaurants.length})
            </Text>
          </Text>
        </View>

        {loading ? (
          renderSkeleton()
        ) : (
          <FlatList
            data={filteredRestaurants}
            renderItem={renderRestaurantItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={renderEmptyState()}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: colors.white,
  },
  greeting: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.gray900,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: colors.gray600,
  },
  profileButton: {
    padding: 4,
  },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primaryLight + "20",
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    gap: 8,
  },
  locationText: {
    fontSize: 12,
    color: colors.gray700,
    flex: 1,
  },
  refreshLocationButton: {
    padding: 4,
  },
  enableLocationButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  enableLocationText: {
    fontSize: 12,
    color: colors.white,
    fontWeight: "600",
  },
  searchSection: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  categoriesSection: {
    paddingVertical: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  restaurantsSection: {
    flex: 1,
    paddingTop: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginHorizontal: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.gray900,
  },
  restaurantCount: {
    color: colors.gray500,
    fontWeight: "normal",
  },
  sortButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.primaryLight,
    borderRadius: 6,
  },
  sortButtonText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  separator: {
    height: 8,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.gray700,
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.gray500,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  locationButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "600",
  },
});

export default HomeScreen;
