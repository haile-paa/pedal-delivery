import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAppState } from "../../context/AppStateContext";
import { favoritesAPI } from "../../../lib/api";
import { Restaurant } from "../../types";
import RestaurantCard from "../../components/customer/RestaurantCard";

const FavoritesScreen: React.FC = () => {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  // The header previously used a fixed paddingVertical with no regard for
  // the status bar / notch height, so on phones with a taller safe area
  // the top of "Favorite Restaurants" and the back button rendered partly
  // under the status bar. Padding by insets.top fixes it across devices.
  const insets = useSafeAreaInsets();
  const styles = getStyles(colors, insets.top);
  const { dispatch } = useAppState();
  const [favorites, setFavorites] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFavorites = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const restaurants = await favoritesAPI.getFavorites();
      setFavorites(restaurants);
      dispatch({
        type: "SET_FAVORITE_RESTAURANTS",
        payload: restaurants.map((r: any) => r.id),
      });
    } catch (error) {
      console.error("Failed to load favorites:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [loadFavorites]),
  );

  const handleRestaurantPress = (restaurant: Restaurant) => {
    router.push(`/(customer)/restaurant/${restaurant.id}` as any);
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.white}
      />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name='arrow-back' size={24} color={colors.gray900} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("favoriteRestaurants")}</Text>
        <View style={styles.headerRight} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size='large' color={colors.primary} />
        </View>
      ) : favorites.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name='heart-outline' size={64} color={colors.gray300} />
          <Text style={styles.emptyTitle}>{t("noFavoritesYet")}</Text>
          <Text style={styles.emptySubtitle}>{t("noFavoritesDesc")}</Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadFavorites(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <RestaurantCard item={item} onPress={handleRestaurantPress} />
          )}
        />
      )}
    </View>
  );
};

const getStyles = (colors: any, insetTop: number) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: insetTop + 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
    backgroundColor: colors.white,
  },
  backBtn: {
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.gray900,
  },
  headerRight: {
    width: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.gray900,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.gray500,
    marginTop: 8,
    textAlign: "center",
  },
  listContent: {
    padding: 12,
  },
});

export default FavoritesScreen;
