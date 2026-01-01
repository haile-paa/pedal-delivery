import React, { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { colors } from "../../theme/colors";
import { Ionicons } from "@expo/vector-icons";

interface OnlineToggleProps {
  isOnline: boolean;
  onToggle: (value: boolean) => void;
  showLabel?: boolean;
}

const OnlineToggle: React.FC<OnlineToggleProps> = ({
  isOnline,
  onToggle,
  showLabel = true,
}) => {
  const translateX = useSharedValue(isOnline ? 40 : 0);
  const scaleAnim = useSharedValue(1);
  const pulseAnim = useSharedValue(1);

  useEffect(() => {
    translateX.value = withSpring(isOnline ? 40 : 0, {
      damping: 15,
      stiffness: 100,
    });

    // Pulsing animation when online
    if (isOnline) {
      pulseAnim.value = withSequence(
        withTiming(1.1, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      );
    }
  }, [isOnline]);

  const handleToggle = () => {
    // Scale animation
    scaleAnim.value = withSequence(withSpring(0.95), withSpring(1));

    onToggle(!isOnline);
  };

  const toggleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { scale: scaleAnim.value }],
  }));

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  return (
    <TouchableOpacity
      onPress={handleToggle}
      activeOpacity={0.8}
      style={styles.container}
    >
      {showLabel && (
        <View style={styles.labelContainer}>
          <Text style={[styles.label, isOnline && styles.labelActive]}>
            {isOnline ? "ONLINE" : "OFFLINE"}
          </Text>
        </View>
      )}

      <View
        style={[
          styles.toggleContainer,
          isOnline ? styles.containerOnline : styles.containerOffline,
        ]}
      >
        {isOnline && (
          <Animated.View style={[styles.pulse, pulseAnimatedStyle]} />
        )}

        <Animated.View style={[styles.toggleCircle, toggleAnimatedStyle]}>
          {isOnline ? (
            <Ionicons name='radio-button-on' size={20} color={colors.success} />
          ) : (
            <Ionicons
              name='radio-button-off'
              size={20}
              color={colors.gray400}
            />
          )}
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  labelContainer: {
    marginRight: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray600,
  },
  labelActive: {
    color: colors.success,
  },
  toggleContainer: {
    width: 80,
    height: 40,
    borderRadius: 20,
    padding: 4,
    position: "relative",
    justifyContent: "center",
  },
  containerOnline: {
    backgroundColor: colors.success + "30",
    borderWidth: 2,
    borderColor: colors.success,
  },
  containerOffline: {
    backgroundColor: colors.gray100,
    borderWidth: 2,
    borderColor: colors.gray300,
  },
  toggleCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.white,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  pulse: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.success,
    borderRadius: 20,
    opacity: 0.3,
  },
});

export default OnlineToggle;
