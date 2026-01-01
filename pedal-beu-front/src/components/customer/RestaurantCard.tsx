// components/customer/RestaurantCard.tsx - Simple version for debugging
import React from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import { Restaurant } from "../../types";

type Props = {
  item: Restaurant;
  onPress?: (restaurant: Restaurant) => void;
};

const RestaurantCard: React.FC<Props> = ({ item, onPress }) => {
  console.log("Rendering restaurant:", item.name, item.id);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress?.(item)}
      activeOpacity={0.8}
    >
      <Image
        source={{
          uri:
            item.images && item.images.length > 0
              ? item.images[0]
              : "https://via.placeholder.com/64",
        }}
        style={styles.image}
        onError={(e) => console.log("Image error:", e.nativeEvent.error)}
      />
      <View style={styles.content}>
        <Text style={styles.name}>{item.name || "Unnamed Restaurant"}</Text>
        <Text style={styles.cuisine}>
          {Array.isArray(item.cuisine_type)
            ? item.cuisine_type.join(", ")
            : "No cuisine type"}
        </Text>
        {item.distance_km !== undefined && (
          <Text style={styles.distance}>
            📍 {item.distance_km.toFixed(1)} km away
          </Text>
        )}
        <View style={styles.footer}>
          <Text style={styles.rating}>
            ⭐ {item.rating?.toFixed(1) || "N/A"}
          </Text>
          <Text style={styles.delivery}>
            {item.delivery_time || 30} min •{" "}
            {item.delivery_fee?.toFixed(2) || "0.00"}Birr
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 10,
    padding: 10,
    marginVertical: 6,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: "#ddd",
  },
  content: {
    flex: 1,
  },
  name: {
    fontWeight: "700",
    fontSize: 16,
    color: "#333",
    marginBottom: 2,
  },
  cuisine: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  distance: {
    fontSize: 12,
    color: "#FF6B6B",
    fontWeight: "600",
    marginBottom: 4,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  rating: {
    fontSize: 12,
    color: "#FFA500",
    fontWeight: "600",
  },
  delivery: {
    fontSize: 12,
    color: "#666",
  },
});

export default RestaurantCard;
