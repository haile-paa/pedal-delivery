import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import { useAppState } from "../../context/AppStateContext";
import { useRouter } from "expo-router";
import { colors } from "../../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import RatingStars from "../../components/driver/RatingStars";
import AnimatedButton from "../../components/ui/AnimatedButton";

const DriverProfileScreen: React.FC = () => {
  const router = useRouter();
  const { state, dispatch } = useAppState();
  const [loading, setLoading] = useState(false);

  const driver = state.auth.user;
  const driverStats = state.driver;

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

  const menuItems = [
    {
      id: "dashboard",
      title: "Dashboard",
      icon: "speedometer-outline",
      onPress: () => router.push("/(driver)/dashboard"),
    },
    {
      id: "orders",
      title: "Order History",
      icon: "list-outline",
      onPress: () => Alert.alert("Order History", "Order history coming soon!"),
    },
    {
      id: "earnings",
      title: "Earnings & Payments",
      icon: "cash-outline",
      onPress: () => router.push("/(driver)/earnings"),
    },
    {
      id: "documents",
      title: "Documents",
      icon: "document-text-outline",
      onPress: () => router.push("/(driver)/documents"),
    },
    {
      id: "vehicle",
      title: "Vehicle Information",
      icon: "car-outline",
      onPress: () => Alert.alert("Vehicle", "Vehicle information coming soon!"),
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle='dark-content' backgroundColor={colors.background} />

      <ScrollView style={styles.scrollView}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            {driver?.avatar ? (
              <Image source={{ uri: driver.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {driver?.name?.charAt(0) || "D"}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => Alert.alert("Edit", "Edit profile coming soon!")}
            >
              <Ionicons name='camera' size={16} color={colors.white} />
            </TouchableOpacity>
          </View>

          <Text style={styles.userName}>{driver?.name || "Driver"}</Text>

          <View style={styles.ratingContainer}>
            <RatingStars
              rating={driverStats.rating}
              maxRating={5}
              size={20}
              showValue={true}
              animated={true}
            />
            <Text style={styles.ratingText}>
              {driverStats.earnings.completedOrders} deliveries
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

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>${driverStats.earnings.total}</Text>
            <Text style={styles.statLabel}>Total Earnings</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {driverStats.earnings.completedOrders}
            </Text>
            <Text style={styles.statLabel}>Completed Orders</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {driverStats.isOnline ? "Online" : "Offline"}
            </Text>
            <Text style={styles.statLabel}>Status</Text>
          </View>
        </View>

        {/* Vehicle Info */}
        <View style={styles.vehicleSection}>
          <Text style={styles.sectionTitle}>Vehicle Information</Text>
          <View style={styles.vehicleCard}>
            <View style={styles.vehicleRow}>
              <Ionicons name='car' size={20} color={colors.gray600} />
              <Text style={styles.vehicleLabel}>Type:</Text>
              <Text style={styles.vehicleValue}>
                {driverStats.vehicle?.type || "Motorcycle"}
              </Text>
            </View>
            <View style={styles.vehicleRow}>
              <Ionicons name='card' size={20} color={colors.gray600} />
              <Text style={styles.vehicleLabel}>Plate:</Text>
              <Text style={styles.vehicleValue}>
                {driverStats.vehicle?.plateNumber || "ABC-123"}
              </Text>
            </View>
            <View style={styles.vehicleRow}>
              <Ionicons name='color-palette' size={20} color={colors.gray600} />
              <Text style={styles.vehicleLabel}>Color:</Text>
              <Text style={styles.vehicleValue}>
                {driverStats.vehicle?.color || "Red"}
              </Text>
            </View>
          </View>
        </View>

        {/* Menu Items */}
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

        {/* Logout Button */}
        <View style={styles.logoutContainer}>
          <AnimatedButton
            title='Logout'
            onPress={handleLogout}
            variant='outline'
            loading={loading}
            style={styles.logoutButton}
          />

          <Text style={styles.versionText}>FoodDelivery Driver v1.0.0</Text>
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
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
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
  ratingContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  ratingText: {
    fontSize: 14,
    color: colors.gray600,
    marginTop: 4,
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
    fontSize: 12,
    color: colors.gray600,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.gray200,
  },
  vehicleSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
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
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  vehicleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
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

export default DriverProfileScreen;
