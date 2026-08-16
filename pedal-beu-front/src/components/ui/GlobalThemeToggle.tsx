import React, { useEffect } from "react";
import { View, TouchableOpacity, Text, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  interpolateColor,
  Extrapolation,
} from "react-native-reanimated";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";

const THUMB_SIZE = 26;
const TRACK_WIDTH = 52;
const TRACK_PADDING = 3;

/**
 * A floating glass pill, fixed to the top-right of the screen above
 * everything else, that lets the person flip Dark Mode (an animated
 * sliding sun/moon switch) and, optionally, swap English/Amharic (an
 * animated segmented control) from anywhere in the app.
 *
 * Mounted once per navigator (see app/(driver)/_layout.tsx and
 * app/(customer)/_layout.tsx) as a sibling of the Stack/Tabs, so it renders
 * on top of every screen within that navigator, including screens reached
 * via nested/hidden routes. Intentionally NOT mounted in app/(auth)/_layout
 * — the welcome/sign-in flow stays simple and toggle-free.
 *
 * The driver navigator opts out of the language segment (showLanguageToggle
 * = false) and shows only the dark-mode switch; the customer navigator
 * keeps both by using the default.
 */
interface GlobalThemeToggleProps {
  showLanguageToggle?: boolean;
}

const GlobalThemeToggle: React.FC<GlobalThemeToggleProps> = ({
  showLanguageToggle = true,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleTheme } = useTheme();
  const { language, setLanguage } = useLanguage();

  const isAm = language === "am";

  // --- Dark-mode switch animation ---------------------------------------
  const themeProgress = useSharedValue(isDark ? 1 : 0);
  const themePress = useSharedValue(1);

  useEffect(() => {
    themeProgress.value = withSpring(isDark ? 1 : 0, {
      damping: 14,
      stiffness: 180,
    });
  }, [isDark]);

  const trackAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      themeProgress.value,
      [0, 1],
      ["#E9D8FD", "#3B2E63"],
    ),
    transform: [{ scale: themePress.value }],
  }));

  const thumbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          themeProgress.value,
          [0, 1],
          [0, TRACK_WIDTH - THUMB_SIZE - TRACK_PADDING * 2],
          Extrapolation.CLAMP,
        ),
      },
      { rotate: `${interpolate(themeProgress.value, [0, 1], [0, 180])}deg` },
    ],
  }));

  const sunOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(themeProgress.value, [0, 0.5], [1, 0]),
    transform: [{ scale: interpolate(themeProgress.value, [0, 0.5], [1, 0.4]) }],
  }));
  const moonOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(themeProgress.value, [0.5, 1], [0, 1]),
    transform: [{ scale: interpolate(themeProgress.value, [0.5, 1], [0.4, 1]) }],
  }));

  const handleThemePressIn = () => {
    themePress.value = withSpring(0.9, { damping: 12, stiffness: 300 });
  };
  const handleThemePressOut = () => {
    themePress.value = withSpring(1, { damping: 10, stiffness: 220 });
  };

  // --- Language segmented-control animation -------------------------------
  const langProgress = useSharedValue(isAm ? 1 : 0);

  useEffect(() => {
    langProgress.value = withTiming(isAm ? 1 : 0, { duration: 220 });
  }, [isAm]);

  const langHighlightStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(langProgress.value, [0, 1], [0, 30]),
      },
    ],
  }));

  const enTextStyle = useAnimatedStyle(() => ({
    opacity: interpolate(langProgress.value, [0, 1], [1, 0.45]),
  }));
  const amTextStyle = useAnimatedStyle(() => ({
    opacity: interpolate(langProgress.value, [0, 1], [0.45, 1]),
  }));

  const toggleLanguage = () => setLanguage(isAm ? "en" : "am");

  return (
    <View
      pointerEvents='box-none'
      style={[
        styles.wrapper,
        { top: insets.top + (Platform.OS === "ios" ? 4 : 10) },
      ]}
    >
      <BlurView
        intensity={45}
        tint={isDark ? "dark" : "light"}
        style={[
          styles.pill,
          {
            borderColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.6)",
            shadowColor: isDark ? colors.primaryGlow : "#000",
          },
        ]}
      >
        {/* Dark mode switch */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={toggleTheme}
          onPressIn={handleThemePressIn}
          onPressOut={handleThemePressOut}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Animated.View style={[styles.track, trackAnimatedStyle]}>
            <Animated.View style={[styles.trackIcon, styles.trackIconLeft, sunOpacity]}>
              <Ionicons name='sunny' size={12} color='#F59E0B' />
            </Animated.View>
            <Animated.View style={[styles.trackIcon, styles.trackIconRight, moonOpacity]}>
              <Ionicons name='moon' size={11} color='#C4B5FD' />
            </Animated.View>
            <Animated.View style={thumbAnimatedStyle}>
              <LinearGradient
                colors={isDark ? ["#4C1D95", "#7C3AED"] : ["#FFFFFF", "#FDE68A"]}
                style={styles.thumb}
              >
                <Ionicons
                  name={isDark ? "moon" : "sunny"}
                  size={13}
                  color={isDark ? "#EDE9FE" : "#F59E0B"}
                />
              </LinearGradient>
            </Animated.View>
          </Animated.View>
        </TouchableOpacity>

        {showLanguageToggle && (
          <>
            <View
              style={[
                styles.divider,
                { backgroundColor: isDark ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.08)" },
              ]}
            />

            {/* Language segmented control */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={toggleLanguage}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View
                style={[
                  styles.langTrack,
                  { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" },
                ]}
              >
                <Animated.View
                  style={[
                    styles.langHighlight,
                    langHighlightStyle,
                    { backgroundColor: colors.primary },
                  ]}
                />
                <Animated.Text style={[styles.langText, enTextStyle, { color: isDark ? "#F5F5F7" : colors.gray900 }]}>
                  EN
                </Animated.Text>
                <Animated.Text style={[styles.langText, amTextStyle, { color: isDark ? "#F5F5F7" : colors.gray900 }]}>
                  አማ
                </Animated.Text>
              </View>
            </TouchableOpacity>
          </>
        )}
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    right: 12,
    zIndex: 999,
    elevation: 999, // Android needs an explicit elevation to actually sit above sibling views
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderWidth: 1,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  track: {
    width: TRACK_WIDTH,
    height: THUMB_SIZE + TRACK_PADDING * 2,
    borderRadius: (THUMB_SIZE + TRACK_PADDING * 2) / 2,
    padding: TRACK_PADDING,
    justifyContent: "center",
  },
  trackIcon: {
    position: "absolute",
    top: "50%",
    marginTop: -6,
  },
  trackIconLeft: { left: 6 },
  trackIconRight: { right: 6 },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  divider: {
    width: 1,
    height: 20,
    marginHorizontal: 8,
  },
  langTrack: {
    flexDirection: "row",
    width: 62,
    height: THUMB_SIZE + TRACK_PADDING * 2,
    borderRadius: (THUMB_SIZE + TRACK_PADDING * 2) / 2,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
  },
  langHighlight: {
    position: "absolute",
    left: 3,
    width: 28,
    height: THUMB_SIZE - 4,
    borderRadius: (THUMB_SIZE - 4) / 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  langText: {
    fontSize: 11,
    fontWeight: "700",
    width: 26,
    textAlign: "center",
    zIndex: 1,
  },
});

export default GlobalThemeToggle;
