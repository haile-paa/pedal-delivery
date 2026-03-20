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
} from "react-native";
import { useAppState } from "../../context/AppStateContext";
import { useRouter } from "expo-router";
import { colors } from "../../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import RatingStars from "../../components/driver/RatingStars";
import AnimatedButton from "../../components/ui/AnimatedButton";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface DriverProfile {
  id: string;
  name: string;
  phone: string;
  email?: string;
  avatar?: string;
  rating: number;
  totalDeliveries: number;
  vehicle?: {
    type: string;
    plateNumber?: string;
    color?: string;
    model?: string;
  };
  documents?: Array<{ type: string; status: string; url?: string }>;
  earnings: {
    total: number;
    thisMonth: number;
    today: number;
  };
}

const DriverProfileScreen: React.FC = () => {
  const router = useRouter();
  const { state, dispatch } = useAppState();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("accessToken");

      const userRes = await fetch(
        "https://pedal-delivery-back.onrender.com/api/v1/users/me",
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!userRes.ok) throw new Error("Failed to fetch profile");
      const userData = await userRes.json();

      const statsRes = await fetch(
        "https://pedal-delivery-back.onrender.com/api/v1/driver/stats",
        { headers: { Authorization: `Bearer ${token}` } },
      );
      let stats = {
        totalDeliveries: 0,
        rating: 5.0,
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
        rating: stats.rating || 5.0,
        totalDeliveries: stats.totalDeliveries || 0,
        vehicle: userData.vehicle,
        documents: userData.documents,
        earnings: stats.earnings || { total: 0, thisMonth: 0, today: 0 },
      });
    } catch (error) {
      console.error("Fetch profile error:", error);
      Alert.alert("Error", "Could not load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: () => {
          dispatch({ type: "LOGOUT" });
          router.replace("/(auth)/welcome" as any);
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
      id: "documents",
      title: "Documents",
      icon: "document-text-outline",
      onPress: () => router.push("/(driver)/documents" as any),
    },
    {
      id: "vehicle",
      title: "Vehicle Information",
      icon: "car-outline",
      onPress: () => Alert.alert("Vehicle", "Vehicle details coming soon!"),
    },
    {
      id: "support",
      title: "Help & Support",
      icon: "help-circle-outline",
      onPress: () => Alert.alert("Support", "Help center coming soon!"),
    },
    {
      id: "settings",
      title: "Settings",
      icon: "settings-outline",
      onPress: () => Alert.alert("Settings", "Settings coming soon!"),
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
      <StatusBar barStyle='dark-content' backgroundColor={colors.background} />
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
              onPress={() => Alert.alert("Edit", "Edit profile coming soon!")}
            >
              <Ionicons name='camera' size={16} color={colors.white} />
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

const styles = StyleSheet.create({
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
    shadowColor: colors.black,
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
