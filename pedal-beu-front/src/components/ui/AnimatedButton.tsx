import React from "react";
import {
  TouchableWithoutFeedback,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";

interface AnimatedButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline";
  size?: "small" | "medium" | "large";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  size = "medium",
  loading = false,
  disabled = false,
  style,
  textStyle,
  fullWidth = false,
}) => {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const styles = getStyles(colors, isDark);

  const scaleValue = useSharedValue(1);
  const opacityValue = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scaleValue.value }],
      opacity: opacityValue.value,
    };
  });

  const handlePressIn = () => {
    if (!disabled && !loading) {
      scaleValue.value = withSpring(0.95);
    }
  };

  const handlePressOut = () => {
    if (!disabled && !loading) {
      scaleValue.value = withSpring(1);
    }
  };

  const handlePress = () => {
    if (disabled || loading) return;

    // Press animation
    scaleValue.value = withSequence(withSpring(0.9), withSpring(1));

    onPress();
  };

  React.useEffect(() => {
    opacityValue.value = withTiming(disabled ? 0.6 : 1, { duration: 200 });
  }, [disabled]);

  const getVariantStyle = () => {
    switch (variant) {
      case "primary":
        return styles.primary;
      case "secondary":
        return styles.secondary;
      case "outline":
        return styles.outline;
      default:
        return styles.primary;
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case "small":
        return styles.small;
      case "medium":
        return styles.medium;
      case "large":
        return styles.large;
      default:
        return styles.medium;
    }
  };

  const getVariantTextStyle = () => {
    switch (variant) {
      case "outline":
        return styles.outlineText;
      default:
        return styles.primaryText;
    }
  };

  return (
    <TouchableWithoutFeedback
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled || loading}
    >
      <Animated.View
        style={[
          styles.button,
          getVariantStyle(),
          getSizeStyle(),
          fullWidth && styles.fullWidth,
          style,
          animatedStyle,
        ]}
      >
        {loading ? (
          <Animated.Text
            style={[styles.buttonText, getVariantTextStyle(), textStyle]}
          >
            {t("loadingEllipsis")}
          </Animated.Text>
        ) : (
          <Text style={[styles.buttonText, getVariantTextStyle(), textStyle]}>
            {title}
          </Text>
        )}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    button: {
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "row",
      // Android has no real bold weight for the Ethiopic fallback font, so it
      // "fake-bolds" Amharic glyphs after the (normal-weight) text width has
      // already been measured. Without this, the pill clips off whatever
      // spills past that original measurement (e.g. "ውጣ" renders as "ው").
      overflow: "visible",
    },
    primary: {
      backgroundColor: colors.primary,
      shadowColor: isDark ? colors.primaryGlow : "transparent",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.45 : 0,
      shadowRadius: 12,
      elevation: isDark ? 4 : 0,
    },
    secondary: {
      backgroundColor: colors.secondary,
      shadowColor: isDark ? colors.primaryGlow : "transparent",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.4 : 0,
      shadowRadius: 12,
      elevation: isDark ? 4 : 0,
    },
    outline: {
      backgroundColor: "transparent",
      borderWidth: 2,
      borderColor: colors.primary,
    },
    small: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      minHeight: 36,
    },
    medium: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      minHeight: 48,
    },
    large: {
      paddingHorizontal: 32,
      paddingVertical: 16,
      minHeight: 56,
    },
    fullWidth: {
      width: "100%",
    },
    buttonText: {
      fontSize: 16,
      fontWeight: "600",
      textAlign: "center",
      includeFontPadding: false,
    },
    // Buttons with a solid primary/secondary fill always need light text —
    // that fill color doesn't change between themes, so (unlike most text
    // in the app) this must NOT follow colors.white, which inverts to a
    // dark shade in dark mode and would make the label unreadable.
    primaryText: {
      color: "#FFFFFF",
    },
    outlineText: {
      color: colors.primary,
    },
  });

export default AnimatedButton;
