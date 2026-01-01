import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { colors } from "../../theme/colors";

interface CategoryFilterProps {
  categories: string[];
  selectedCategory: string;
  onCategorySelect: (category: string) => void;
}

const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selectedCategory,
  onCategorySelect,
}) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {categories.map((category, index) => (
        <CategoryItem
          key={category}
          category={category}
          isSelected={category === selectedCategory}
          onPress={() => onCategorySelect(category)}
          index={index}
        />
      ))}
    </ScrollView>
  );
};

interface CategoryItemProps {
  category: string;
  isSelected: boolean;
  onPress: () => void;
  index: number;
}

const CategoryItem: React.FC<CategoryItemProps> = React.memo(
  ({ category, isSelected, onPress, index }) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => {
      return {
        transform: [{ scale: scale.value }],
      };
    });

    const handlePress = () => {
      scale.value = withSpring(0.9, {}, () => {
        scale.value = withSpring(1);
      });
      onPress();
    };

    return (
      <TouchableOpacity onPress={handlePress}>
        <Animated.View
          style={[
            styles.item,
            isSelected ? styles.itemSelected : styles.itemNormal,
            animatedStyle,
          ]}
        >
          <Text
            style={[
              styles.text,
              isSelected ? styles.textSelected : styles.textNormal,
            ]}
          >
            {category}
          </Text>
        </Animated.View>
      </TouchableOpacity>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 2,
  },
  itemNormal: {
    backgroundColor: colors.white,
    borderColor: colors.gray200,
  },
  itemSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
  },
  textNormal: {
    color: colors.gray600,
  },
  textSelected: {
    color: colors.white,
  },
});

export default CategoryFilter;
