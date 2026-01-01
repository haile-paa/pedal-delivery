import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { colors } from "../../theme/colors";

interface RatingComponentProps {
  rating: number;
  maxRating?: number;
  size?: number;
  editable?: boolean;
  onRatingChange?: (rating: number) => void;
  showLabel?: boolean;
}

const RatingComponent: React.FC<RatingComponentProps> = ({
  rating,
  maxRating = 5,
  size = 24,
  editable = false,
  onRatingChange,
  showLabel = false,
}) => {
  const [currentRating, setCurrentRating] = useState(rating);
  const [hoverRating, setHoverRating] = useState(0);

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleStarPress = (starIndex: number) => {
    if (!editable) return;

    scale.value = withSpring(0.9, {}, () => {
      scale.value = withSpring(1);
    });

    const newRating = starIndex + 1;
    setCurrentRating(newRating);
    onRatingChange?.(newRating);
  };

  const handleStarHover = (starIndex: number) => {
    if (!editable) return;
    setHoverRating(starIndex + 1);
  };

  const renderStars = () => {
    const stars = [];
    const displayRating = hoverRating > 0 ? hoverRating : currentRating;

    for (let i = 0; i < maxRating; i++) {
      const isFilled = i < Math.floor(displayRating);
      const isHalf = i === Math.floor(displayRating) && displayRating % 1 !== 0;

      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => handleStarPress(i)}
          onPressIn={() => handleStarHover(i)}
          onPressOut={() => setHoverRating(0)}
          disabled={!editable}
          activeOpacity={editable ? 0.7 : 1}
        >
          <Animated.View style={[styles.starContainer, animatedStyle]}>
            {isFilled ? (
              <Ionicons name='star' size={size} color={colors.warning} />
            ) : isHalf ? (
              <View>
                <Ionicons
                  name='star-outline'
                  size={size}
                  color={colors.gray300}
                />
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    { width: "50%", overflow: "hidden" },
                  ]}
                >
                  <Ionicons name='star' size={size} color={colors.warning} />
                </View>
              </View>
            ) : (
              <Ionicons
                name='star-outline'
                size={size}
                color={colors.gray300}
              />
            )}
          </Animated.View>
        </TouchableOpacity>
      );
    }

    return stars;
  };

  return (
    <View style={styles.container}>
      <View style={styles.starsContainer}>{renderStars()}</View>
      {showLabel && (
        <Text style={styles.ratingText}>
          {currentRating.toFixed(1)} / {maxRating}
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
    flexDirection: "row",
    alignItems: "center",
    marginRight: 8,
  },
  starContainer: {
    marginHorizontal: 2,
  },
  ratingText: {
    fontSize: 14,
    color: colors.gray600,
    fontWeight: "600",
  },
});

export default RatingComponent;
