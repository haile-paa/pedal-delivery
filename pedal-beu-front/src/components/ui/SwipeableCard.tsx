import React, { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Animated,
  Dimensions,
} from "react-native";
import { colors } from "../../theme/colors";

interface SwipeableCardProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

const SwipeableCard: React.FC<SwipeableCardProps> = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction,
  rightAction,
}) => {
  const position = useRef(new Animated.ValueXY()).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: 0 });
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD && onSwipeRight) {
          // Swipe right
          Animated.timing(position, {
            toValue: { x: SCREEN_WIDTH, y: 0 },
            duration: 250,
            useNativeDriver: false,
          }).start(() => {
            onSwipeRight();
            position.setValue({ x: 0, y: 0 });
          });
        } else if (gesture.dx < -SWIPE_THRESHOLD && onSwipeLeft) {
          // Swipe left
          Animated.timing(position, {
            toValue: { x: -SCREEN_WIDTH, y: 0 },
            duration: 250,
            useNativeDriver: false,
          }).start(() => {
            onSwipeLeft();
            position.setValue({ x: 0, y: 0 });
          });
        } else {
          // Return to original position
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: ["-10deg", "0deg", "10deg"],
    extrapolate: "clamp",
  });

  const leftActionOpacity = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH, -50, 0],
    outputRange: [1, 0.5, 0],
    extrapolate: "clamp",
  });

  const rightActionOpacity = position.x.interpolate({
    inputRange: [0, 50, SCREEN_WIDTH],
    outputRange: [0, 0.5, 1],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.container}>
      {/* Left Action */}
      {leftAction && (
        <Animated.View
          style={[
            styles.action,
            styles.leftAction,
            { opacity: leftActionOpacity },
          ]}
        >
          {leftAction}
        </Animated.View>
      )}

      {/* Right Action */}
      {rightAction && (
        <Animated.View
          style={[
            styles.action,
            styles.rightAction,
            { opacity: rightActionOpacity },
          ]}
        >
          {rightAction}
        </Animated.View>
      )}

      {/* Card */}
      <Animated.View
        style={[
          styles.card,
          {
            transform: [{ translateX: position.x }, { rotate: rotate }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
    marginVertical: 8,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  action: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 80,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
  },
  leftAction: {
    left: 0,
    backgroundColor: colors.error,
  },
  rightAction: {
    right: 0,
    backgroundColor: colors.success,
  },
});

export default SwipeableCard;
