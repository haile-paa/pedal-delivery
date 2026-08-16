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
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";

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
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

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
          colors={colors}
          isDark={isDark}
          styles={styles}
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
  colors: any;
  isDark: boolean;
  styles: ReturnType<typeof getStyles>;
}

const CategoryItem: React.FC<CategoryItemProps> = React.memo(
  ({ category, isSelected, onPress, colors, isDark, styles }) => {
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

    // "All" is an internal sentinel value used for comparisons/filtering
    // throughout HomeScreen — only its displayed label gets translated here.
    // Every other category is a real cuisine name from the restaurant data
    // (e.g. "Mexican", "Pizza") and is intentionally left as-is.
    const { t } = useLanguage();
    const label = category === "All" ? t("allCategory") : category;

    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.85}>
        <Animated.View style={[styles.itemWrap, animatedStyle]}>
          {isSelected ? (
            <LinearGradient
              colors={
                isDark
                  ? [colors.secondary, colors.primary]
                  : [colors.primary, colors.primaryGlow]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.item, styles.itemSelected]}
            >
              <Text style={[styles.text, styles.textSelected]}>{label}</Text>
            </LinearGradient>
          ) : (
            <View style={[styles.item, styles.itemNormal]}>
              <Text style={[styles.text, styles.textNormal]}>{label}</Text>
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>
    );
  },
);

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    itemWrap: {
      marginRight: 8,
      borderRadius: 20,
      shadowColor: isDark ? colors.primaryGlow : "transparent",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: isDark ? 0.35 : 0,
      shadowRadius: 8,
    },
    item: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: isDark ? 1 : 2,
    },
    itemNormal: {
      backgroundColor: colors.card,
      borderColor: isDark ? "rgba(255,255,255,0.1)" : colors.gray200,
    },
    itemSelected: {
      borderColor: "transparent",
    },
    text: {
      fontSize: 14,
      fontWeight: "600",
    },
    textNormal: {
      color: colors.gray600,
    },
    textSelected: {
      color: "#FFFFFF",
    },
  });

export default CategoryFilter;
