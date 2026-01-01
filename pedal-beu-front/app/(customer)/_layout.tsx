import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../src/theme/colors";

export default function CustomerLayout() {
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
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
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
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name='home-outline' size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name='cart'
        options={{
          title: "Cart",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name='cart-outline' size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name='order-history'
        options={{
          title: "Orders",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name='receipt-outline' size={size} color={color} />
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
        name='restaurant/[id]'
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
  );
}
