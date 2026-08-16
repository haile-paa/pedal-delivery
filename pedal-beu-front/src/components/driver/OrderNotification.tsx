import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
  runOnJS,
} from "react-native-reanimated";
import { useTheme } from "../../context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";

interface OrderNotificationProps {
  order: {
    id: string;
    restaurantName: string;
    amount: number;
    distance: string;
    itemsCount: number;
    estimatedDeliveryTime: string;
  };
  onAccept: () => void;
  onReject: () => void;
  index: number;
}

const OrderNotification: React.FC<OrderNotificationProps> = ({
  order,
  onAccept,
  onReject,
  index,
}) => {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const slideAnim = useSharedValue(-300);
  const scaleAnim = useSharedValue(0.9);
  const pulseAnim = useSharedValue(1);
  const [timeLeft, setTimeLeft] = useState(30);

  // Entrance animation
  useEffect(() => {
    const delay = index * 100;
    slideAnim.value = withDelay(
      delay,
      withSpring(0, { damping: 15, stiffness: 100 }),
    );
    scaleAnim.value = withDelay(
      delay,
      withSequence(
        withSpring(1.05, { damping: 15 }),
        withSpring(1, { damping: 15 }),
      ),
    );
    pulseAnim.value = withSequence(
      withDelay(delay + 500, withSpring(1.1, { damping: 2 })),
      withSpring(1, { damping: 2 }),
    );
  }, []);

  // Timer countdown
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      onReject();
    }
  }, [timeLeft]);

  const handleAccept = () => {
    slideAnim.value = withSpring(300, {}, () => runOnJS(onAccept)());
  };

  const handleReject = () => {
    slideAnim.value = withSpring(-300, {}, () => runOnJS(onReject)());
  };

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideAnim.value }, { scale: scaleAnim.value }],
  }));

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  return (
    <Animated.View style={[styles.container, containerAnimatedStyle]}>
      {/* Timer Badge */}
      <Animated.View style={[styles.timerBadge, pulseAnimatedStyle]}>
        <Text style={styles.timerText}>{timeLeft}s</Text>
      </Animated.View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.restaurantName}>{order.restaurantName}</Text>
          <Text style={styles.amount}>
            {order.amount.toFixed(2)} Birr
          </Text>
        </View>

        <View style={styles.details}>
          <View style={styles.detailRow}>
            <Ionicons name='location' size={16} color={colors.gray500} />
            <Text style={styles.detailText}>
              {order.distance} away
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name='fast-food' size={16} color={colors.gray500} />
            <Text style={styles.detailText}>
              {order.itemsCount} items
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name='time' size={16} color={colors.gray500} />
            <Text style={styles.detailText}>
              ETA: {order.estimatedDeliveryTime}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={handleReject}
          >
            <Ionicons name='close' size={20} color={colors.error} />
            <Text style={[styles.actionText, styles.rejectText]}>
              Reject
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={handleAccept}
          >
            <Ionicons name='checkmark' size={20} color={colors.success} />
            <Text style={[styles.actionText, styles.acceptText]}>
              Accept
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: 16,
      marginHorizontal: 16,
      marginVertical: 8,
      padding: 16,
      shadowColor: isDark ? colors.primaryGlow : colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.3 : 0.2,
      shadowRadius: isDark ? 14 : 8,
      elevation: 8,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    timerBadge: {
      position: "absolute",
      top: -10,
      right: 16,
      backgroundColor: colors.error,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      zIndex: 1,
    },
    // Sits on a solid error-red badge in both themes, so this must stay a
    // literal white rather than following colors.white (which inverts to
    // a dark shade in dark mode and would make the countdown unreadable).
    timerText: { fontSize: 12, fontWeight: "bold", color: "#FFFFFF" },
    content: { flex: 1 },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    restaurantName: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.gray900,
      flex: 1,
    },
    amount: {
      fontSize: 20,
      fontWeight: "bold",
      color: colors.primary,
      marginLeft: 8,
    },
    details: { marginBottom: 16 },
    detailRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
    detailText: { fontSize: 14, color: colors.gray600, marginLeft: 8 },
    actions: { flexDirection: "row", justifyContent: "space-between" },
    actionButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 12,
      flex: 1,
      marginHorizontal: 4,
      borderWidth: 2,
    },
    rejectButton: { backgroundColor: colors.card, borderColor: colors.error },
    acceptButton: {
      backgroundColor: colors.card,
      borderColor: colors.success,
    },
    actionText: { fontSize: 16, fontWeight: "600", marginLeft: 8 },
    rejectText: { color: colors.error },
    acceptText: { color: colors.success },
  });

export default OrderNotification;
