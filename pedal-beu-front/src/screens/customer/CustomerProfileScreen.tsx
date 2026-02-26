import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useAppState } from "../../context/AppStateContext";
import { useRouter } from "expo-router";
import { colors } from "../../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import AnimatedButton from "../../components/ui/AnimatedButton";

const API = "https://pedal-delivery-back.onrender.com/api/v1";

const CustomerProfileScreen = () => {
  const router = useRouter();
  const { state, dispatch } = useAppState();
  const [loading, setLoading] = useState(false);

  const token = state.auth.token;

  // ================================
  // 🔥 FETCH PROFILE FROM BACKEND
  // ================================
  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (res.ok) {
        dispatch({
          type: "UPDATE_USER",
          payload: {
            ...data,
            name: data.profile?.first_name || data.username || "User",
          },
        });
      }
    } catch (error) {
      console.log("Profile fetch error:", error);
    }
  };

  // ================================
  // 🔥 FETCH ADDRESSES
  // ================================
  const fetchAddresses = async () => {
    try {
      const res = await fetch(`${API}/users/addresses`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (res.ok) {
        dispatch({ type: "SET_ADDRESSES", payload: data.addresses });
      }
    } catch (err) {
      console.log("Address fetch:", err);
    }
  };

  // ================================
  // 🔥 FETCH ORDER HISTORY
  // ================================
  const fetchOrders = async () => {
    try {
      const res = await fetch(`${API}/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (res.ok) {
        dispatch({ type: "SET_CUSTOMER_ORDERS", payload: data.orders });
      }
    } catch (e) {
      console.log("Orders fetch error:", e);
    }
  };

  useEffect(() => {
    if (token) {
      fetchProfile();
      fetchAddresses();
      fetchOrders();
    }
  }, [token]);

  // Safely access customer data with fallbacks
  const user = state.auth.user;
  const customer = state.customer || {};
  const addresses = customer.addresses || [];
  const orders = customer.orders || [];
  const favoriteRestaurants = customer.favoriteRestaurants || [];

  const ordersCount = orders.length;
  const favoriteCount = favoriteRestaurants.length;
  const addressesCount = addresses.length;

  // ============================
  // 🔥 UPDATE PROFILE
  // ============================
  const updateProfile = async () => {
    Alert.alert("Update", "Edit profile feature coming soon!");
  };

  // ============================
  // 🔥 LOGOUT
  // ============================
  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => {
          dispatch({ type: "LOGOUT" });
          router.replace("/(auth)/welcome");
        },
      },
    ]);
  };

  // MENU ITEMS
  const menuItems = [
    {
      id: "orders",
      title: "My Orders",
      icon: "receipt-outline" as const,
      onPress: () => router.push("/(customer)/order-history"),
    },
    {
      id: "addresses",
      title: "Saved Addresses",
      icon: "location-outline" as const,
      onPress: () => Alert.alert("Coming Soon"),
      badge: addressesCount,
    },
    {
      id: "favorites",
      title: "Favorite Restaurants",
      icon: "heart-outline" as const,
      onPress: () => Alert.alert("Coming Soon"),
      badge: favoriteCount,
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle='dark-content' backgroundColor={colors.background} />

      <ScrollView style={styles.scrollView}>
        {/* --- Profile Header --- */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0) || "U"}
              </Text>
            </View>
          </View>

          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <Text style={styles.userPhone}>{user?.phone}</Text>

          <TouchableOpacity
            style={styles.editProfileButton}
            onPress={updateProfile}
          >
            <Text style={styles.editProfileText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* --- Stats --- */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{ordersCount}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Text style={styles.statValue}>{favoriteCount}</Text>
            <Text style={styles.statLabel}>Favorites</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <Text style={styles.statValue}>{addressesCount}</Text>
            <Text style={styles.statLabel}>Addresses</Text>
          </View>
        </View>

        {/* --- Menu Items --- */}
        <View style={styles.menuContainer}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              onPress={item.onPress}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name={item.icon} size={24} color={colors.gray600} />
                <Text style={styles.menuItemText}>{item.title}</Text>
              </View>

              <View style={styles.menuItemRight}>
                {item.badge !== undefined && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.badge}</Text>
                  </View>
                )}
                <Ionicons
                  name='chevron-forward'
                  size={20}
                  color={colors.gray400}
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* --- Logout --- */}
        <View style={styles.logoutContainer}>
          <AnimatedButton
            title='Logout'
            onPress={handleLogout}
            variant='outline'
            loading={loading}
            style={styles.logoutButton}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  profileHeader: {
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 24,
    backgroundColor: colors.white,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 40,
    fontWeight: "bold",
    color: colors.white,
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.gray900,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: colors.gray600,
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 14,
    color: colors.gray500,
    marginBottom: 16,
  },
  editProfileButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: colors.primary + "10",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  editProfileText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: colors.white,
    paddingVertical: 24,
    marginBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: colors.gray600,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.gray200,
  },
  menuContainer: {
    backgroundColor: colors.white,
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  menuItemText: {
    fontSize: 16,
    color: colors.gray800,
    marginLeft: 16,
  },
  menuItemRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 8,
    minWidth: 24,
    alignItems: "center",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.white,
  },
  logoutContainer: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  logoutButton: {
    minWidth: 200,
    marginBottom: 16,
  },
  versionText: {
    fontSize: 12,
    color: colors.gray500,
  },
});

export default CustomerProfileScreen;
