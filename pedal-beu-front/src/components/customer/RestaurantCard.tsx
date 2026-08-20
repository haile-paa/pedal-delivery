// components/customer/RestaurantCard.tsx
import React from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Restaurant } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";

type Props = {
  item: Restaurant;
  onPress?: (restaurant: Restaurant) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (restaurant: Restaurant) => void;
};

const RestaurantCard: React.FC<Props> = ({
  item,
  onPress,
  isFavorite,
  onToggleFavorite,
}) => {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const styles = getStyles(colors, isDark);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(item)}
      activeOpacity={0.8}
    >
      <View style={styles.imageWrap}>
        <Image
          source={{
            uri:
              item.images && item.images.length > 0
                ? item.images[0]
                : "https://via.placeholder.com/64",
          }}
          style={styles.image}
        />
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.35)"]}
          style={[styles.imageShade, { opacity: isDark ? 1 : 0 }]}
        />
      </View>
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name || t("unnamedRestaurant")}
          </Text>
          {onToggleFavorite && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation?.();
                onToggleFavorite(item);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={isFavorite ? "heart" : "heart-outline"}
                size={18}
                color={isFavorite ? colors.error : colors.gray400}
              />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.cuisine} numberOfLines={1}>
          {Array.isArray(item.cuisine_type)
            ? item.cuisine_type.join(", ")
            : t("noCuisineType")}
        </Text>
        {item.distance_km !== undefined && (
          <Text style={styles.distance}>
            📍 {item.distance_km.toFixed(1)} km {t("away")}
          </Text>
        )}
        <View style={styles.footer}>
          <View style={styles.ratingPill}>
            <Ionicons name='star' size={11} color={colors.warning} />
            <Text style={styles.rating}>
              {item.rating?.toFixed(1) || "N/A"}
            </Text>
          </View>
          <Text style={styles.delivery}>
            {item.delivery_time || 30} {t("minAbbrev")} •{" "}
            {item.delivery_fee?.toFixed(2) || "0.00"} {t("birr")}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 10,
      marginVertical: 6,
      alignItems: "center",
      borderWidth: isDark ? 1 : 0,
      borderColor: isDark ? "rgba(255,255,255,0.08)" : "transparent",
      shadowColor: isDark ? colors.primaryGlow : "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.18 : 0.1,
      shadowRadius: isDark ? 10 : 4,
      elevation: 3,
    },
    imageWrap: {
      width: 80,
      height: 80,
      borderRadius: 12,
      marginRight: 12,
      overflow: "hidden",
    },
    image: {
      width: "100%",
      height: "100%",
      backgroundColor: colors.gray200,
    },
    imageShade: {
      ...StyleSheet.absoluteFillObject,
    },
    content: {
      flex: 1,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    name: {
      flex: 1,
      fontWeight: "700",
      fontSize: 16,
      color: colors.gray900,
      marginBottom: 2,
      marginRight: 8,
    },
    cuisine: {
      fontSize: 12,
      color: colors.gray500,
      marginBottom: 4,
    },
    distance: {
      fontSize: 12,
      color: colors.error,
      fontWeight: "600",
      marginBottom: 4,
    },
    footer: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 4,
    },
    ratingPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: isDark ? "rgba(245,158,11,0.15)" : colors.warningLight,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 8,
    },
    rating: {
      fontSize: 12,
      color: colors.warning,
      fontWeight: "700",
    },
    delivery: {
      fontSize: 12,
      color: colors.gray500,
    },
  });

export default RestaurantCard;
