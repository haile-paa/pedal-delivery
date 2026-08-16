import { Tabs } from "expo-router";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/context/ThemeContext";
import { useLanguage } from "../../src/context/LanguageContext";
import GlobalThemeToggle from "../../src/components/ui/GlobalThemeToggle";

export default function CustomerLayout() {
  // Some Android phones reserve a system nav bar (3-button or gesture pill)
  // at the very bottom of the screen and report that space via the bottom
  // safe-area inset; others (gesture-only, no reserved bar) report ~0.
  // Padding the tab bar by that inset keeps it clear of the system bar on
  // phones that have one, while leaving it exactly as-is on phones that
  // don't (insets.bottom is 0 there, so this is a no-op).
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useLanguage();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray400,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopWidth: 1,
          borderTopColor: colors.gray200,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
          height: 60 + insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name='home'
        options={{
          title: t("home"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name='home-outline' size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name='cart'
        options={{
          title: t("cart"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name='cart-outline' size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name='order-history'
        options={{
          title: t("orders"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name='receipt-outline' size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name='profile'
        options={{
          title: t("profile"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name='person-outline' size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name='restaurant/[id]'
        options={{
          href: null, // This hides it from the tab bar
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name='favorites'
        options={{
          href: null, // This hides it from the tab bar
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name='settings'
        options={{
          href: null, // This hides it from the tab bar
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name='order-traking'
        options={{
          href: null, // This hides it from the tab bar
          headerShown: false,
        }}
      />
      </Tabs>
      <GlobalThemeToggle />
    </View>
  );
}
