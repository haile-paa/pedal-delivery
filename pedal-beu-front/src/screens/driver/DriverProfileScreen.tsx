import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useAppState } from "../../context/AppStateContext";
import { useRouter } from "expo-router";
import { useTheme } from "../../context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import RatingStars from "../../components/driver/RatingStars";
import AnimatedButton from "../../components/ui/AnimatedButton";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../../utils/constants";
import { fetchWithTimeout } from "../../utils/fetchWithTimeout";
import { authAPI } from "../../../lib/api";

interface DriverProfile {
  id: string;
  name: string;
  phone: string;
  email?: string;
  avatar?: string;
  rating: number;
  ratingCount: number;
  totalDeliveries: number;
  vehicle?: {
    type: string;
    plateNumber?: string;
    color?: string;
    model?: string;
  };
  earnings: {
    total: number;
    thisMonth: number;
    today: number;
  };
}

const DriverProfileScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);
  const router = useRouter();
  const { state, dispatch, actions } = useAppState();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("accessToken");

      // fetchWithTimeout: plain fetch() has no timeout, and Render's free
      // tier can take 30-90s to wake from a cold start — without a
      // timeout, a hung request here means "Loading profile..." (gated on
      // the `loading` state this whole function wraps) never clears.
      // fetchWithTimeout: plain fetch() has no timeout, and Render's free
      // tier can take 30-90s to wake from a cold start — without a
      // timeout, a hung request here means "Loading profile..." (gated on
      // the `loading` state this whole function wraps) never clears.
      // userRes and statsRes don't depend on each other, so they're fired
      // together — awaiting them one after another meant up to ~40s
      // stacked on a cold instance even when neither one individually hit
      // the 20s timeout.
      const [userRes, statsRes] = await Promise.all([
        fetchWithTimeout(`${API_BASE_URL}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetchWithTimeout(`${API_BASE_URL}/driver/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (!userRes.ok) throw new Error("Failed to fetch profile");
      const userData = await userRes.json();

      let stats: {
        totalDeliveries: number;
        rating: number;
        ratingCount: number;
        earnings: { total: number; thisMonth: number; today: number };
      } = {
        totalDeliveries: 0,
        rating: 5.0,
        ratingCount: 0,
        earnings: { total: 0, thisMonth: 0, today: 0 },
      };
      if (statsRes.ok) {
        stats = await statsRes.json();
      }

      setProfile({
        id: userData.id,
        name: userData.name || userData.profile?.first_name || "Driver",
        phone: userData.phone,
        email: userData.email,
        avatar: userData.profile?.avatar,
        rating: stats.rating ?? 5.0,
        ratingCount: stats.ratingCount ?? 0,
        totalDeliveries: stats.totalDeliveries || 0,
        vehicle: userData.vehicle,
        earnings: stats.earnings || { total: 0, thisMonth: 0, today: 0 },
      });
    } catch (error) {
      console.error("Fetch profile error:", error);
      Alert.alert("Error", "Could not load profile");
    } finally {
      setLoading(false);
    }
  };

  const handlePickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow photo access to update your profile picture.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];

    try {
      setUploadingAvatar(true);
      const uploaded = await authAPI.uploadAvatar({
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
      });
      await authAPI.updateProfile({ avatar: uploaded.url });
      setProfile((prev) => (prev ? { ...prev, avatar: uploaded.url } : prev));
      dispatch({
        type: "UPDATE_USER",
        payload: {
          ...state.auth.user,
          profile: { ...state.auth.user?.profile, avatar: uploaded.url },
        } as any,
      });
    } catch (error) {
      console.error("Avatar upload error:", error);
      Alert.alert("Error", "Could not update your profile picture. Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => {
          // Use the shared logout action (disconnects the WebSocket +
          // clears stored tokens) instead of dispatching LOGOUT directly.
          // For drivers this matters even more than for customers: the
          // socket is what carries live GPS updates, so leaving it
          // connected after "logging out" kept broadcasting location
          // under the old session and could collide with the next
          // login's screens as they were still mounting.
          actions.logout();
        },
      },
    ]);
  };

  const menuItems = [
    {
      id: "dashboard",
      title: "Dashboard",
      icon: "speedometer-outline",
      onPress: () => router.push("/(driver)/dashboard" as any),
    },
    {
      id: "orders",
      title: "Order History",
      icon: "list-outline",
      onPress: () => router.push("/(driver)/order-history" as any),
    },
    {
      id: "earnings",
      title: "Earnings & Payments",
      icon: "cash-outline",
      onPress: () => router.push("/(driver)/earnings" as any),
    },
    {
      id: "support",
      title: "Help & Support",
      icon: "help-circle-outline",
      onPress: () =>
        Alert.alert(
          "Help & Support",
          "Need a hand? Reach us any time:\n\n📞 Call: +251 909 585 090\n✉️ Email: wubealuke888@gmail.com\n💬 Live chat: available 8am–10pm daily",
          [
            {
              text: "Call Support",
              onPress: () => Linking.openURL("tel:+251909585090"),
            },
            {
              text: "Email Support",
              onPress: () => Linking.openURL("mailto:wubealuke888@gmail.com"),
            },
            { text: "Close", style: "cancel" },
          ],
        ),
    },
    {
      id: "settings",
      title: "Settings",
      icon: "settings-outline",
      onPress: () => router.push("/(driver)/settings" as any),
    },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size='large' color={colors.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Could not load profile</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <ScrollView style={styles.scrollView}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {profile.avatar ? (
              <Image source={{ uri: profile.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{profile.name.charAt(0)}</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.editButton}
              onPress={handlePickAvatar}
              disabled={uploadingAvatar}
            >
              {uploadingAvatar ? (
                <ActivityIndicator size='small' color={colors.white} />
              ) : (
                <Ionicons name='camera' size={16} color={colors.white} />
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.userName}>{profile.name}</Text>

          <View style={styles.ratingContainer}>
            <RatingStars
              rating={profile.rating}
              maxRating={5}
              size={20}
              showValue={true}
              animated={true}
              label={profile.ratingCount === 0 ? "New" : undefined}
            />
            <Text style={styles.ratingText}>
              {profile.totalDeliveries} deliveries
            </Text>
          </View>

          <TouchableOpacity
            style={styles.editProfileButton}
            onPress={() =>
              Alert.alert("Edit Profile", "Edit profile feature coming soon!")
            }
          >
            <Text style={styles.editProfileText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {profile.earnings.total.toFixed(2)} Birr
            </Text>
            <Text style={styles.statLabel}>Total Earnings</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.totalDeliveries}</Text>
            <Text style={styles.statLabel}>Completed Orders</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {state.driver.isOnline ? "Online" : "Offline"}
            </Text>
            <Text style={styles.statLabel}>Status</Text>
          </View>
        </View>

        {profile.vehicle && (
          <View style={styles.vehicleSection}>
            <Text style={styles.sectionTitle}>Vehicle Information</Text>
            <View style={styles.vehicleCard}>
              <View style={styles.vehicleRow}>
                <Ionicons name='car' size={20} color={colors.gray600} />
                <Text style={styles.vehicleLabel}>Type:</Text>
                <Text style={styles.vehicleValue}>
                  {profile.vehicle.type || "Motorcycle"}
                </Text>
              </View>
              {profile.vehicle.plateNumber && (
                <View style={styles.vehicleRow}>
                  <Ionicons name='card' size={20} color={colors.gray600} />
                  <Text style={styles.vehicleLabel}>Plate:</Text>
                  <Text style={styles.vehicleValue}>
                    {profile.vehicle.plateNumber}
                  </Text>
                </View>
              )}
              {profile.vehicle.color && (
                <View style={styles.vehicleRow}>
                  <Ionicons
                    name='color-palette'
                    size={20}
                    color={colors.gray600}
                  />
                  <Text style={styles.vehicleLabel}>Color:</Text>
                  <Text style={styles.vehicleValue}>
                    {profile.vehicle.color}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={styles.menuContainer}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons
                  name={item.icon as any}
                  size={24}
                  color={colors.gray600}
                />
                <Text style={styles.menuItemText}>{item.title}</Text>
              </View>
              <Ionicons
                name='chevron-forward'
                size={20}
                color={colors.gray400}
              />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.logoutContainer}>
          <AnimatedButton
            title='Logout'
            onPress={handleLogout}
            variant='outline'
            style={styles.logoutButton}
          />
          <Text style={styles.versionText}>FoodDelivery Driver v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const getStyles = (colors: any) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 16, color: colors.gray600 },
  errorContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { fontSize: 18, color: colors.error },
  profileHeader: {
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 24,
    backgroundColor: colors.white,
  },
  avatarContainer: { position: "relative", marginBottom: 16 },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontSize: 40, fontWeight: "bold", color: colors.white },
  editButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: colors.white,
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.gray900,
    marginBottom: 8,
  },
  ratingContainer: { alignItems: "center", marginBottom: 16 },
  ratingText: { fontSize: 14, color: colors.gray600, marginTop: 4 },
  editProfileButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: colors.primary + "10",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  editProfileText: { fontSize: 14, fontWeight: "600", color: colors.primary },
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
  statItem: { flex: 1, alignItems: "center" },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: { fontSize: 12, color: colors.gray600 },
  statDivider: { width: 1, backgroundColor: colors.gray200 },
  vehicleSection: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.gray900,
    marginBottom: 12,
  },
  vehicleCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  vehicleRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  vehicleLabel: {
    fontSize: 14,
    color: colors.gray600,
    marginLeft: 12,
    marginRight: 8,
    width: 60,
  },
  vehicleValue: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.gray800,
    flex: 1,
  },
  menuContainer: { backgroundColor: colors.white, marginBottom: 24 },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  menuItemLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  menuItemText: { fontSize: 16, color: colors.gray800, marginLeft: 16 },
  logoutContainer: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  logoutButton: { minWidth: 200, marginBottom: 16 },
  versionText: { fontSize: 12, color: colors.gray500 },
});

export default DriverProfileScreen;
