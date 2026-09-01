// components/customer/HomeScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  StatusBar,
  Alert,
  TouchableOpacity,
  InteractionManager,
} from "react-native";
import { useAppState } from "../../context/AppStateContext";
import { Restaurant } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import RestaurantCard from "../../components/customer/RestaurantCard";
import SearchBarWithFilters from "../../components/ui/SearchBarWithFilters";
import CategoryFilter from "../../components/customer/CategoryFilter";
import LoadingSkeleton from "../../components/ui/LoadingSkeleton";
import { useRouter } from "expo-router";
import { restaurantAPI } from "../../../lib/restaurant";
import { favoritesAPI } from "../../../lib/api";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";

const HomeScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const styles = getStyles(colors);
  const { state, dispatch } = useAppState();
  const router = useRouter();
  const [filteredRestaurants, setFilteredRestaurants] = useState<Restaurant[]>(
    [],
  );
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const fetchTimeoutRef = useRef<number | null>(null);
  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef<number>(0);
  const shouldFetchRef = useRef(true);

  useEffect(() => {
    console.log("HomeScreen - current user:", state.auth.user);
  }, [state.auth.user]);

  useEffect(() => {
    (async () => {
      const restaurants = await favoritesAPI.getFavorites();
      dispatch({
        type: "SET_FAVORITE_RESTAURANTS",
        payload: restaurants.map((r: any) => r.id),
      });
    })();
  }, []);

  const getUserFirstName = () => {
    const user = state.auth.user;
    if (!user) return t("guest");
    return (
      user.firstName || user.name || user.profile?.first_name || t("guest")
    );
  };

  const cleanupFetch = () => {
    if (fetchTimeoutRef.current !== null) {
      clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = null;
    }
  };

  const loadRestaurantsDebounced = useCallback(
    (
      useLocation: boolean = false,
      location?: { latitude: number; longitude: number },
      forceRefresh: boolean = false,
    ) => {
      cleanupFetch();

      if (isFetchingRef.current && !forceRefresh) {
        console.log("Already fetching, skipping duplicate call");
        return;
      }

      const now = Date.now();
      if (!forceRefresh && now - lastFetchTimeRef.current < 2000) {
        console.log("Too soon since last fetch, debouncing...");
        fetchTimeoutRef.current = setTimeout(
          () => {
            loadRestaurantsDebounced(useLocation, location, forceRefresh);
          },
          2000 - (now - lastFetchTimeRef.current),
        ) as unknown as number;
        return;
      }

      fetchTimeoutRef.current = setTimeout(async () => {
        await loadRestaurants(useLocation, location, forceRefresh);
      }, 300) as unknown as number;
    },
    [],
  );

  const loadRestaurants = async (
    useLocation: boolean = false,
    location?: { latitude: number; longitude: number },
    forceRefresh: boolean = false,
  ) => {
    if (isFetchingRef.current && !forceRefresh) {
      console.log("Already fetching, skipping...");
      return;
    }

    console.log("Loading restaurants, useLocation:", useLocation);
    isFetchingRef.current = true;
    setLoading(true);

    try {
      const params: any = {
        page: 1,
        limit: 20,
      };

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
        if (response.data.length > 0) {
          console.log(
            "First restaurant data:",
            JSON.stringify(response.data[0], null, 2),
          );
        }

        dispatch({ type: "SET_RESTAURANTS", payload: response.data });

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

        lastFetchTimeRef.current = Date.now();
      } else {
        // Silently handle – do not show alert to customer
        console.warn("Failed to load restaurants:", response.error);
      }
    } catch (error: any) {
      // Silently handle network errors – no user‑facing alert
      console.warn("Error loading restaurants:", error.message);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
      setLocationLoading(false);
    }
  };

  const requestLocationPermission = async () => {
    setLocationLoading(true);
    setLocationError(null);

    try {
      console.log("Requesting location permissions...");

      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        setLocationError("Location services are disabled on your device");
        setLocationLoading(false);
        loadRestaurantsDebounced(false, undefined, true);
        return;
      }

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
        loadRestaurantsDebounced(false, undefined, true);
      }
    } catch (error: any) {
      console.error("Error requesting location permission:", error);
      setLocationError(error.message || "Failed to get location permission");
      setHasLocationPermission(false);
      setLocationLoading(false);
      loadRestaurantsDebounced(false, undefined, true);
    }
  };

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

      dispatch({
        type: "SET_LOCATION",
        payload: { latitude, longitude },
      });

      setHasLocationPermission(true);
      setLocationError(null);

      loadRestaurantsDebounced(true, { latitude, longitude }, true);
    } catch (error: any) {
      console.error("Error getting location:", error);
      setLocationError(error.message || "Failed to get location");
      setHasLocationPermission(false);
      setLocationLoading(false);

      loadRestaurantsDebounced(false, undefined, true);
    }
  };

  useEffect(() => {
    let filtered = state.restaurants.list;

    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (restaurant) =>
          restaurant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (restaurant.cuisine_type &&
            restaurant.cuisine_type.some((cuisine: string) =>
              cuisine.toLowerCase().includes(searchQuery.toLowerCase()),
            )),
      );
    }

    if (selectedCategory !== "All") {
      filtered = filtered.filter(
        (restaurant) =>
          restaurant.cuisine_type &&
          restaurant.cuisine_type.includes(selectedCategory),
      );
    }

    setFilteredRestaurants(filtered);
  }, [searchQuery, selectedCategory, state.restaurants.list]);

  useEffect(() => {
    const initialize = async () => {
      await requestLocationPermission();
    };

    if (shouldFetchRef.current) {
      shouldFetchRef.current = false;

      // This screen is reached two ways: signing in / registering (where
      // router.replace() just swapped out the previous screen — auth
      // WelcomeScreen or the email-verification screen — for this one in
      // the same beat as a LOGIN_SUCCESS state update), or navigating here
      // normally once already logged in. In the first case, the OS
      // location-permission dialog is a native overlay, and firing it
      // while that screen-swap's Fabric commit is still in flight is the
      // exact same class of mounting-race crash documented in
      // WelcomeScreen.tsx's handleSignIn ("addViewAt: ... already has a
      // parent") — except here it force-closes the *new* screen's mount
      // instead of the old one's unmount, which is why it was still
      // reproducible after hardening the sign-in side alone. A flat 100ms
      // guess wasn't a reliable enough signal that the transition had
      // actually settled. InteractionManager.runAfterInteractions() is —
      // it's the same primitive already used elsewhere in this app for
      // this exact problem — so wait for that first, then keep a short
      // extra delay after it as cheap additional insurance.
      InteractionManager.runAfterInteractions(() => {
        fetchTimeoutRef.current = setTimeout(() => {
          initialize();
        }, 300) as unknown as number;
      });
    }

    return () => {
      cleanupFetch();
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    loadRestaurantsDebounced(
      hasLocationPermission,
      state.location.currentLocation || undefined,
      true,
    );
    const refreshTimeout = setTimeout(() => {
      setRefreshing(false);
    }, 500) as unknown as number;

    return () => clearTimeout(refreshTimeout);
  }, [
    hasLocationPermission,
    state.location.currentLocation,
    loadRestaurantsDebounced,
  ]);

  const handleRestaurantPress = (restaurant: Restaurant) => {
    dispatch({ type: "SET_CURRENT_RESTAURANT", payload: restaurant });
    router.push({
      pathname: "/(customer)/restaurant/[id]",
      params: { id: restaurant.id },
    });
  };

  const handleToggleFavorite = useCallback(
    async (restaurant: Restaurant) => {
      const isFav = state.customer.favoriteRestaurants.includes(
        restaurant.id,
      );
      try {
        if (isFav) {
          await favoritesAPI.removeFavorite(restaurant.id);
          dispatch({
            type: "SET_FAVORITE_RESTAURANTS",
            payload: state.customer.favoriteRestaurants.filter(
              (id) => id !== restaurant.id,
            ),
          });
        } else {
          await favoritesAPI.addFavorite(restaurant.id);
          dispatch({
            type: "SET_FAVORITE_RESTAURANTS",
            payload: [...state.customer.favoriteRestaurants, restaurant.id],
          });
        }
      } catch (error) {
        console.error("Toggle favorite error:", error);
      }
    },
    [state.customer.favoriteRestaurants],
  );

  const renderRestaurantItem = useCallback(
    ({ item }: { item: Restaurant }) => (
      <RestaurantCard
        item={item}
        onPress={handleRestaurantPress}
        isFavorite={state.customer.favoriteRestaurants.includes(item.id)}
        onToggleFavorite={handleToggleFavorite}
      />
    ),
    [state.customer.favoriteRestaurants, handleToggleFavorite],
  );

  const renderSkeleton = useCallback(
    () => <LoadingSkeleton type='restaurant' count={3} />,
    [],
  );

  const renderLocationHeader = () => {
    if (locationLoading) {
      return (
        <View style={styles.locationContainer}>
          <Ionicons name='location-outline' size={16} color={colors.gray600} />
          <Text style={styles.locationText}>{t("gettingLocation")}</Text>
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
            <Text style={styles.enableLocationText}>{t("retry")}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (hasLocationPermission && state.location.currentLocation) {
      return (
        <View style={styles.locationContainer}>
          <Ionicons name='location' size={16} color={colors.primary} />
          <Text style={styles.locationText}>{t("showingNearby")}</Text>
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
        <Text style={styles.locationText}>{t("locationNotEnabled")}</Text>
        <TouchableOpacity
          style={styles.enableLocationButton}
          onPress={requestLocationPermission}
        >
          <Text style={styles.enableLocationText}>{t("enable")}</Text>
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
            ? t("noRestaurantsAvailable")
            : t("noRestaurantsMatch")}
        </Text>
        <Text style={styles.emptyStateSubtext}>
          {state.restaurants.list.length === 0
            ? t("checkBackLater")
            : t("adjustSearchFilters")}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            {t("helloGreeting")}, {getUserFirstName()} 👋
          </Text>
          <Text style={styles.subtitle}>{t("whatToOrderToday")}</Text>
        </View>
      </View>

      {/* Location Status */}
      {renderLocationHeader()}

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <SearchBarWithFilters
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t("searchRestaurantsPlaceholder")}
          onFiltersPress={() => {
            Alert.alert(t("filters"), t("filtersComingSoon"));
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
            }}
          />
        </View>
      )}

      {/* Restaurants List */}
      <View style={styles.restaurantsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {selectedCategory === "All"
              ? t("allRestaurants")
              : selectedCategory}
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

const getStyles = (colors: any) =>
  StyleSheet.create({
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
