import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";

interface RatingStarsProps {
  rating: number;
  maxRating?: number;
  size?: number;
  showValue?: boolean;
  animated?: boolean;
}

const RatingStars: React.FC<RatingStarsProps> = ({
  rating,
  maxRating = 5,
  size = 16,
  showValue = true,
  animated = true,
}) => {
  const progress = useSharedValue(0);

  React.useEffect(() => {
    if (animated) {
      progress.value = withTiming(rating / maxRating, {
        duration: 1000,
      });
    } else {
      progress.value = rating / maxRating;
    }
  }, [rating, animated]);

  const fillAnimatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const renderStars = () => {
    const stars = [];

    for (let i = 0; i < maxRating; i++) {
      stars.push(
        <Ionicons
          key={i}
          name='star-outline'
          size={size}
          color={colors.gray300}
          style={styles.star}
        />
      );
    }

    return stars;
  };

  return (
    <View style={styles.container}>
      <View style={styles.starsContainer}>
        {/* Background Stars (outline) */}
        <View style={styles.starsBackground}>{renderStars()}</View>

        {/* Filled Stars */}
        <Animated.View style={[styles.starsFill, fillAnimatedStyle]}>
          {Array.from({ length: maxRating }).map((_, i) => (
            <Ionicons
              key={i}
              name='star'
              size={size}
              color={colors.warning}
              style={styles.star}
            />
          ))}
        </Animated.View>
      </View>

      {showValue && (
        <Text style={styles.ratingText}>
          {rating.toFixed(1)}
          <Text style={styles.maxRating}>/{maxRating}</Text>
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  starsContainer: {
    position: "relative",
    flexDirection: "row",
  },
  starsBackground: {
    flexDirection: "row",
  },
  starsFill: {
    position: "absolute",
    flexDirection: "row",
    overflow: "hidden",
  },
  star: {
    marginHorizontal: 1,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "bold",
    color: colors.gray800,
    marginLeft: 8,
  },
  maxRating: {
    fontSize: 12,
    color: colors.gray500,
    fontWeight: "normal",
  },
});

export default RatingStars;
