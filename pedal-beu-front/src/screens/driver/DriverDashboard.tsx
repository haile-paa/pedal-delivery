import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
} from "react-native";
import { useAppState } from "../../context/AppStateContext";
import { colors } from "../../theme/colors";
import OnlineToggle from "../../components/driver/OnlineToggle";
import OrderNotification from "../../components/driver/OrderNotification";
import FloatingActionButton from "../../components/ui/FloatingActionButton";
import { useRouter } from "expo-router";

const DriverDashboard: React.FC = () => {
  const router = useRouter();
  const { state, dispatch } = useAppState();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [timeOnline, setTimeOnline] = useState(0);

  // Simulate time online counter
  useEffect(() => {
    let interval: number;

    if (state.driver.isOnline) {
      interval = setInterval(() => {
        setTimeOnline((prev) => prev + 1);
      }, 1000);
    } else {
      setTimeOnline(0);
    }

    return () => clearInterval(interval);
  }, [state.driver.isOnline]);

  // Simulate new orders when online
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (state.driver.isOnline) {
      interval = setInterval(() => {
        const newNotification = {
          id: Math.random().toString(36).substr(2, 9),
          orderId: Math.random().toString(36).substr(2, 9),
          restaurant: ["Burger Palace", "Sushi Garden", "Pizza Heaven"][
            Math.floor(Math.random() * 3)
          ],
          amount: (Math.random() * 50 + 10).toFixed(2),
          distance: `${(Math.random() * 5 + 1).toFixed(1)} km`,
          items: Math.floor(Math.random() * 5) + 1,
          eta: `${Math.floor(Math.random() * 10) + 15}-${
            Math.floor(Math.random() * 10) + 25
          } min`,
        };

        setNotifications((prev) => [newNotification, ...prev.slice(0, 4)]);
      }, 15000); // New order every 15 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
      setNotifications([]);
    };
  }, [state.driver.isOnline]);

  const handleToggleOnline = (isOnline: boolean) => {
    dispatch({ type: "SET_DRIVER_ONLINE", payload: isOnline });
  };

  const handleAcceptOrder = (orderId: string) => {
    // In a real app, you would accept the order and navigate to order details
    console.log("Accept order:", orderId);
    setNotifications((prev) => prev.filter((n) => n.orderId !== orderId));

    // Simulate navigation to order details
    router.push("/(driver)/order-detail");
  };

  const handleRejectOrder = (orderId: string) => {
    console.log("Reject order:", orderId);
    setNotifications((prev) => prev.filter((n) => n.orderId !== orderId));
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const earnings = state.driver.earnings;

  return (
    <View style={styles.container}>
      <StatusBar barStyle='dark-content' backgroundColor={colors.background} />

      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              Welcome back, {state.auth.user?.name || "Driver"}! 🚗
            </Text>
            <Text style={styles.subtitle}>
              {state.driver.isOnline
                ? `Online for ${formatTime(timeOnline)}`
                : "Go online to start earning"}
            </Text>
          </View>

          <OnlineToggle
            isOnline={state.driver.isOnline}
            onToggle={handleToggleOnline}
            showLabel={true}
          />
        </View>

        {/* Earnings Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              ${earnings.today || earnings.daily}
            </Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>${earnings.weekly}</Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{earnings.completedOrders}</Text>
            <Text style={styles.statLabel}>Deliveries</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {state.driver.rating?.toFixed(1) || "4.8"}
            </Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push("/(driver)/available-orders")}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: colors.primary + "20" },
                ]}
              >
                <Text
                  style={[styles.actionIconText, { color: colors.primary }]}
                >
                  📋
                </Text>
              </View>
              <Text style={styles.actionText}>Available Orders</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push("/(driver)/earnings")}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: colors.success + "20" },
                ]}
              >
                <Text
                  style={[styles.actionIconText, { color: colors.success }]}
                >
                  💰
                </Text>
              </View>
              <Text style={styles.actionText}>Earnings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push("./(driver)/documents")}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: colors.info + "20" },
                ]}
              >
                <Text style={[styles.actionIconText, { color: colors.info }]}>
                  📄
                </Text>
              </View>
              <Text style={styles.actionText}>Documents</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push("./(driver)/navigation")}
            >
              <View
                style={[
                  styles.actionIcon,
                  { backgroundColor: colors.secondary + "20" },
                ]}
              >
                <Text
                  style={[styles.actionIconText, { color: colors.secondary }]}
                >
                  🗺️
                </Text>
              </View>
              <Text style={styles.actionText}>Navigation</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Orders */}
        <View style={styles.ordersContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {state.driver.isOnline ? "New Orders" : "Recent Activity"}
            </Text>
            {notifications.length > 0 && (
              <TouchableOpacity onPress={() => setNotifications([])}>
                <Text style={styles.clearButton}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>

          {state.driver.isOnline ? (
            notifications.length > 0 ? (
              notifications.map((notification, index) => (
                <OrderNotification
                  key={notification.id}
                  order={notification}
                  onAccept={() => handleAcceptOrder(notification.orderId)}
                  onReject={() => handleRejectOrder(notification.orderId)}
                  index={index}
                />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No new orders yet</Text>
                <Text style={styles.emptySubtext}>
                  New orders will appear here when available
                </Text>
              </View>
            )
          ) : (
            <View style={styles.offlineState}>
              <Text style={styles.offlineText}>⚠️ You're offline</Text>
              <Text style={styles.offlineSubtext}>
                Go online to receive new delivery requests
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Current Order FAB */}
      {state.driver.currentOrder && (
        <FloatingActionButton
          icon='navigate'
          onPress={() => router.push("./(driver)/navigation")}
          position='bottom-right'
        />
      )}
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: colors.white,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.gray900,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.gray600,
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.gray600,
  },
  actionsContainer: {
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.gray900,
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  actionButton: {
    width: "48%",
    alignItems: "center",
    padding: 16,
    backgroundColor: colors.gray50,
    borderRadius: 16,
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  actionIconText: {
    fontSize: 24,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray800,
    textAlign: "center",
  },
  ordersContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  clearButton: {
    fontSize: 14,
    color: colors.error,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.gray700,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.gray500,
    textAlign: "center",
    lineHeight: 20,
  },
  offlineState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    backgroundColor: colors.warning + "10",
    borderRadius: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.warning + "30",
  },
  offlineText: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.warning,
    marginBottom: 8,
  },
  offlineSubtext: {
    fontSize: 14,
    color: colors.gray600,
    textAlign: "center",
    lineHeight: 20,
  },
});

export default DriverDashboard;
