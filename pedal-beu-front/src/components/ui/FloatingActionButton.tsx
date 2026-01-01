import React from "react";
import { TouchableOpacity, StyleSheet, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";

interface FloatingActionButtonProps {
  onPress: () => void;
  icon: string;
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  style?: ViewStyle;
  size?: number;
  children?: React.ReactNode;
}

const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onPress,
  icon,
  position = "bottom-right",
  style,
  size = 56,
}) => {
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotation.value}deg` }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.9);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
    rotation.value = withSequence(
      withSpring(-10),
      withSpring(10),
      withSpring(0)
    );
  };

  const getPositionStyle = () => {
    const offset = 20;
    switch (position) {
      case "bottom-right":
        return { bottom: offset, right: offset };
      case "bottom-left":
        return { bottom: offset, left: offset };
      case "top-right":
        return { top: offset, right: offset };
      case "top-left":
        return { top: offset, left: offset };
      default:
        return { bottom: offset, right: offset };
    }
  };

  return (
    <TouchableOpacity
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      activeOpacity={0.9}
      style={[styles.container, getPositionStyle(), style]}
    >
      <Animated.View
        style={[
          styles.button,
          { width: size, height: size, borderRadius: size / 2 },
          animatedStyle,
        ]}
      >
        <Ionicons name={icon as any} size={size * 0.5} color={colors.white} />
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    zIndex: 1000,
  },
  button: {
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default FloatingActionButton;
