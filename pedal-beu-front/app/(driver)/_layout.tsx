import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../src/theme/colors";

export default function DriverLayout() {
  // See app/(customer)/_layout.tsx — same reasoning: pad by the bottom
  // safe-area inset so the tab bar clears a phone's on-screen system nav
  // bar where one is reserved, and stays unchanged where it isn't.
  const insets = useSafeAreaInsets();

  return (
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
        name='dashboard'
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name='speedometer-outline' size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name='available-orders'
        options={{
          title: "Orders",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name='list-outline' size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name='earnings'
        options={{
          title: "Earnings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name='cash-outline' size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name='profile'
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name='person-outline' size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name='navigation'
        options={{
          href: null, // This hides it from the tab bar
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name='driver-phone-input'
        options={{
          href: null, // This hides it from the tab bar
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name='order-history'
        options={{
          href: null, // This hides it from the tab bar
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name='order-detail'
        options={{
          href: null, // This hides it from the tab bar
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
