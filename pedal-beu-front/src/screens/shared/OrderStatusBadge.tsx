import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { colors } from "../../theme/colors";
import { OrderStatus } from "../../types";

interface OrderStatusBadgeProps {
  status: OrderStatus;
  animated?: boolean;
}

const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({
  status,
  animated = true,
}) => {
  const scaleAnim = useSharedValue(1);
  const rotationAnim = useSharedValue(0);

  React.useEffect(() => {
    if (animated) {
      scaleAnim.value = withSequence(
        withTiming(1.1, { duration: 200 }),
        withTiming(1, { duration: 200 })
      );
    }
  }, [status]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scaleAnim.value },
      { rotate: `${rotationAnim.value}deg` },
    ],
  }));

  const getStatusConfig = () => {
    switch (status) {
      case "pending":
        return {
          text: "Pending",
          color: colors.warning,
          backgroundColor: colors.warning + "20",
          icon: "⏳",
        };
      case "confirmed":
        return {
          text: "Confirmed",
          color: colors.info,
          backgroundColor: colors.info + "20",
          icon: "✅",
        };
      case "preparing":
        return {
          text: "Preparing",
          color: colors.primary,
          backgroundColor: colors.primary + "20",
          icon: "👨‍🍳",
        };
      case "ready":
        return {
          text: "Ready",
          color: colors.success,
          backgroundColor: colors.success + "20",
          icon: "📦",
        };
      case "picked_up":
        return {
          text: "On The Way",
          color: colors.secondary,
          backgroundColor: colors.secondary + "20",
          icon: "🚗",
        };
      case "delivered":
        return {
          text: "Delivered",
          color: colors.success,
          backgroundColor: colors.success + "20",
          icon: "🎉",
        };
      case "cancelled":
        return {
          text: "Cancelled",
          color: colors.error,
          backgroundColor: colors.error + "20",
          icon: "❌",
        };
      default:
        return {
          text: "Unknown",
          color: colors.gray500,
          backgroundColor: colors.gray200,
          icon: "❓",
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: config.backgroundColor },
        animatedStyle,
      ]}
    >
      <Text style={styles.icon}>{config.icon}</Text>
      <Text style={[styles.text, { color: config.color }]}>{config.text}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  icon: {
    fontSize: 14,
    marginRight: 6,
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
  },
});

export default OrderStatusBadge;
