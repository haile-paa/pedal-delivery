import React, { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
  runOnJS,
} from "react-native-reanimated";
import { colors } from "../../theme/colors";
import { Ionicons } from "@expo/vector-icons";

interface OrderNotificationProps {
  order: {
    id: string;
    restaurant: string;
    amount: number;
    distance: string;
    items: number;
    eta: string;
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
  const slideAnim = useSharedValue(-300);
  const scaleAnim = useSharedValue(0.9);
  const pulseAnim = useSharedValue(1);

  // Entrance animation with delay based on index
  useEffect(() => {
    const delay = index * 100;

    slideAnim.value = withDelay(
      delay,
      withSpring(0, { damping: 15, stiffness: 100 })
    );

    scaleAnim.value = withDelay(
      delay,
      withSequence(
        withSpring(1.05, { damping: 15 }),
        withSpring(1, { damping: 15 })
      )
    );

    // Pulsing animation
    pulseAnim.value = withSequence(
      withDelay(delay + 500, withSpring(1.1, { damping: 2 })),
      withSpring(1, { damping: 2 })
    );
  }, []);

  // Timer countdown
  const [timeLeft, setTimeLeft] = React.useState(30);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      onReject();
    }
  }, [timeLeft]);

  const handleAccept = () => {
    slideAnim.value = withSpring(300, {}, () => {
      runOnJS(onAccept)();
    });
  };

  const handleReject = () => {
    slideAnim.value = withSpring(-300, {}, () => {
      runOnJS(onReject)();
    });
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
          <Text style={styles.restaurantName}>{order.restaurant}</Text>
          <Text style={styles.amount}>${order.amount.toFixed(2)}</Text>
        </View>

        <View style={styles.details}>
          <View style={styles.detailRow}>
            <Ionicons name='location' size={16} color={colors.gray500} />
            <Text style={styles.detailText}>{order.distance} away</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name='fast-food' size={16} color={colors.gray500} />
            <Text style={styles.detailText}>{order.items} items</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name='time' size={16} color={colors.gray500} />
            <Text style={styles.detailText}>ETA: {order.eta}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={handleReject}
          >
            <Ionicons name='close' size={20} color={colors.error} />
            <Text style={[styles.actionText, styles.rejectText]}>Reject</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={handleAccept}
          >
            <Ionicons name='checkmark' size={20} color={colors.success} />
            <Text style={[styles.actionText, styles.acceptText]}>Accept</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
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
  timerText: {
    fontSize: 12,
    fontWeight: "bold",
    color: colors.white,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.gray800,
    flex: 1,
  },
  amount: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.primary,
    marginLeft: 8,
  },
  details: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  detailText: {
    fontSize: 14,
    color: colors.gray600,
    marginLeft: 8,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
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
  rejectButton: {
    backgroundColor: colors.white,
    borderColor: colors.error,
  },
  acceptButton: {
    backgroundColor: colors.white,
    borderColor: colors.success,
  },
  actionText: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  rejectText: {
    color: colors.error,
  },
  acceptText: {
    color: colors.success,
  },
});

export default OrderNotification;
