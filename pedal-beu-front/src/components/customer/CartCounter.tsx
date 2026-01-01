import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";

interface CartCounterProps {
  count: number;
  onIncrement: () => void;
  onDecrement: () => void;
  min?: number;
  max?: number;
}

const CartCounter: React.FC<CartCounterProps> = ({
  count,
  onIncrement,
  onDecrement,
  min = 0,
  max = 99,
}) => {
  const scaleAnim = useSharedValue(1);
  const rotationAnim = useSharedValue(0);

  const handleIncrement = () => {
    if (count < max) {
      // Bounce animation
      scaleAnim.value = withSequence(withSpring(0.9), withSpring(1));

      // Rotation animation
      rotationAnim.value = withSequence(
        withSpring(-5),
        withSpring(5),
        withSpring(0)
      );

      onIncrement();
    }
  };

  const handleDecrement = () => {
    if (count > min) {
      // Shake animation
      rotationAnim.value = withSequence(
        withSpring(-10),
        withSpring(10),
        withSpring(-5),
        withSpring(5),
        withSpring(0)
      );

      onDecrement();
    }
  };

  const counterAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scaleAnim.value },
      { rotate: `${rotationAnim.value}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.container, counterAnimatedStyle]}>
      <TouchableOpacity
        style={[
          styles.button,
          styles.decrementButton,
          count <= min && styles.buttonDisabled,
        ]}
        onPress={handleDecrement}
        disabled={count <= min}
      >
        <Ionicons
          name='remove'
          size={20}
          color={count <= min ? colors.gray400 : colors.primary}
        />
      </TouchableOpacity>

      <View style={styles.countContainer}>
        <Text style={styles.count}>{count}</Text>
      </View>

      <TouchableOpacity
        style={[
          styles.button,
          styles.incrementButton,
          count >= max && styles.buttonDisabled,
        ]}
        onPress={handleIncrement}
        disabled={count >= max}
      >
        <Ionicons
          name='add'
          size={20}
          color={count >= max ? colors.gray400 : colors.primary}
        />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.primary,
    overflow: "hidden",
  },
  button: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  decrementButton: {
    borderRightWidth: 1,
    borderRightColor: colors.gray200,
  },
  incrementButton: {
    borderLeftWidth: 1,
    borderLeftColor: colors.gray200,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  countContainer: {
    minWidth: 40,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  count: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.gray800,
  },
});

export default CartCounter;
