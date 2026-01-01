import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from "react-native-reanimated";
import { colors } from "../../theme/colors";

const { width: screenWidth } = Dimensions.get("window");

interface LoadingSkeletonProps {
  type: "restaurant" | "food-item" | "text";
  count?: number;
}

const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  type = "restaurant",
  count = 1,
}) => {
  if (type === "restaurant") {
    return (
      <View style={styles.container}>
        {Array.from({ length: count }).map((_, index) => (
          <RestaurantSkeleton key={index} />
        ))}
      </View>
    );
  }

  return null;
};

const RestaurantSkeleton: React.FC = () => {
  const opacity = useSharedValue(0.3);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  React.useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800 }),
        withTiming(0.3, { duration: 800 })
      ),
      -1,
      true
    );
  }, []);

  return (
    <Animated.View style={[styles.restaurantContainer, animatedStyle]}>
      <View style={styles.imageSkeleton} />
      <View style={styles.content}>
        <View style={styles.titleSkeleton} />
        <View style={styles.subtitleSkeleton} />
        <View style={styles.tagsContainer}>
          <View style={styles.tagSkeleton} />
          <View style={styles.tagSkeleton} />
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  restaurantContainer: {
    backgroundColor: colors.gray200,
    borderRadius: 16,
    marginVertical: 8,
    overflow: "hidden",
  },
  imageSkeleton: {
    width: "100%",
    height: 160,
    backgroundColor: colors.gray300,
  },
  content: {
    padding: 16,
  },
  titleSkeleton: {
    height: 20,
    backgroundColor: colors.gray300,
    borderRadius: 4,
    marginBottom: 8,
    width: "70%",
  },
  subtitleSkeleton: {
    height: 16,
    backgroundColor: colors.gray300,
    borderRadius: 4,
    marginBottom: 12,
    width: "50%",
  },
  tagsContainer: {
    flexDirection: "row",
  },
  tagSkeleton: {
    height: 20,
    width: 60,
    backgroundColor: colors.gray300,
    borderRadius: 10,
    marginRight: 8,
  },
});

export default LoadingSkeleton;
