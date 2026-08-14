import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";

interface StarRatingInputProps {
  value: number;
  onChange: (value: number) => void;
  size?: number;
  maxRating?: number;
}

// Tappable star row for collecting a 1-5 rating from the customer. Unlike
// RatingStars (driver components — read-only, animated display of an
// existing rating), this one takes taps and reports the selected value.
const StarRatingInput: React.FC<StarRatingInputProps> = ({
  value,
  onChange,
  size = 32,
  maxRating = 5,
}) => {
  return (
    <View style={styles.row}>
      {Array.from({ length: maxRating }).map((_, i) => {
        const starValue = i + 1;
        const filled = starValue <= value;
        return (
          <TouchableOpacity
            key={starValue}
            onPress={() => onChange(starValue)}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            style={styles.star}
          >
            <Ionicons
              name={filled ? "star" : "star-outline"}
              size={size}
              color={filled ? colors.warning : colors.gray300}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  star: { marginHorizontal: 4 },
});

export default StarRatingInput;
