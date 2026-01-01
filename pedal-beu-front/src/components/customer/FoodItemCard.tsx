import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from "react-native-reanimated";
import { MenuItem } from "../../types";
import { colors } from "../../theme/colors";
import { Ionicons } from "@expo/vector-icons";

interface FoodItemCardProps {
  item: MenuItem;
  onAddToCart: (item: MenuItem) => void;
  quantity?: number;
}

const FoodItemCard: React.FC<FoodItemCardProps> = React.memo(
  ({ item, onAddToCart, quantity = 0 }) => {
    const scaleAnim = useSharedValue(1);
    const bounceAnim = useSharedValue(0);

    const handleAddToCart = () => {
      // Bounce animation
      bounceAnim.value = withSequence(withSpring(-10), withSpring(0));

      // Scale animation
      scaleAnim.value = withSequence(withSpring(0.95), withSpring(1));

      onAddToCart(item);
    };

    const cardAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scaleAnim.value }],
    }));

    const buttonAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: bounceAnim.value }],
    }));

    return (
      <Animated.View style={[styles.container, cardAnimatedStyle]}>
        <Image
          source={{ uri: item.image }}
          style={styles.image}
          resizeMode='cover'
        />

        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.price}>${item.price.toFixed(2)}</Text>
          </View>

          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>

          <View style={styles.footer}>
            <View style={styles.ingredients}>
              {item.ingredients.slice(0, 2).map((ingredient, idx) => (
                <Text key={idx} style={styles.ingredient}>
                  {ingredient}
                </Text>
              ))}
              {item.ingredients.length > 2 && (
                <Text style={styles.moreIngredients}>
                  +{item.ingredients.length - 2} more
                </Text>
              )}
            </View>

            {!item.isAvailable ? (
              <View style={styles.unavailableBadge}>
                <Text style={styles.unavailableText}>Unavailable</Text>
              </View>
            ) : (
              <Animated.View style={[styles.addButton, buttonAnimatedStyle]}>
                {quantity > 0 ? (
                  <View style={styles.quantityContainer}>
                    <TouchableOpacity style={styles.quantityButton}>
                      <Ionicons
                        name='remove'
                        size={16}
                        color={colors.primary}
                      />
                    </TouchableOpacity>
                    <Text style={styles.quantityText}>{quantity}</Text>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={handleAddToCart}
                    >
                      <Ionicons name='add' size={16} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.addButtonInner}
                    onPress={handleAddToCart}
                  >
                    <Ionicons name='add' size={20} color={colors.primary} />
                    <Text style={styles.addButtonText}>Add</Text>
                  </TouchableOpacity>
                )}
              </Animated.View>
            )}
          </View>
        </View>
      </Animated.View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    flexDirection: "row",
    padding: 12,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  content: {
    flex: 1,
    marginLeft: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.gray800,
    flex: 1,
  },
  price: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.primary,
    marginLeft: 8,
  },
  description: {
    fontSize: 14,
    color: colors.gray600,
    lineHeight: 20,
    marginBottom: 8,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ingredients: {
    flexDirection: "row",
    flexWrap: "wrap",
    flex: 1,
  },
  ingredient: {
    fontSize: 12,
    color: colors.gray500,
    backgroundColor: colors.gray100,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 4,
    marginBottom: 4,
  },
  moreIngredients: {
    fontSize: 12,
    color: colors.gray500,
    fontStyle: "italic",
  },
  unavailableBadge: {
    backgroundColor: colors.error + "20",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  unavailableText: {
    fontSize: 12,
    color: colors.error,
    fontWeight: "600",
  },
  addButton: {
    backgroundColor: colors.primary + "10",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addButtonInner: {
    flexDirection: "row",
    alignItems: "center",
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
    marginLeft: 4,
  },
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  quantityButton: {
    padding: 4,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray700,
    marginHorizontal: 8,
  },
});

export default FoodItemCard;
