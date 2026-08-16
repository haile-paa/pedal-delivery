import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useAppState } from "../../context/AppStateContext";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import OrderStatusBadge from "../../components/shared/OrderStatusBadge";
import SwipeableCard from "../../components/ui/SwipeableCard";
import { useRouter } from "expo-router";
import WebSocketService from "../../services/websocket.service";
import { Order } from "../../types";

const OrderHistoryScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const styles = getStyles(colors);
  const router = useRouter();
  const { state, dispatch, actions } = useAppState();
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [restaurantNames, setRestaurantNames] = useState<
    Record<string, string>
  >({});

  // Load restaurant names for orders
  useEffect(() => {
    const fetchRestaurantNames = async () => {
      const orders = state.customer?.orders || [];
      const names: Record<string, string> = {};
      for (const order of orders) {
        if (!order.restaurant_id) continue;
        if (restaurantNames[order.restaurant_id]) {
          names[order.restaurant_id] = restaurantNames[order.restaurant_id];
        } else {
          try {
            const restaurant = await actions.loadRestaurantDetails(
              order.restaurant_id,
            );
            if (restaurant) {
              names[order.restaurant_id] = restaurant.name;
            }
          } catch (error) {
            console.error("Failed to load restaurant name:", error);
            names[order.restaurant_id] = t("restaurantFallback");
          }
        }
      }
      setRestaurantNames((prev) => ({ ...prev, ...names }));
    };
    fetchRestaurantNames();
  }, [state.customer?.orders]);

  // Refresh orders on mount and setup WebSocket listeners
  useEffect(() => {
    loadOrders();

    // Listen for order updates
    const handleOrderUpdate = (data: any) => {
      console.log("Order update received in history:", data);
      // Refresh orders to get latest status
      loadOrders();
    };

    WebSocketService.on("order:status_update", handleOrderUpdate);
    WebSocketService.on("order_update", handleOrderUpdate); // raw event

    return () => {
      WebSocketService.off("order:status_update", handleOrderUpdate);
      WebSocketService.off("order_update", handleOrderUpdate);
    };
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      await actions.loadCustomerOrders();
    } catch (error) {
      console.error("Failed to load orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const filters = [
    { id: "all", label: t("allOrders") },
    { id: "pending", label: t("active") },
    { id: "delivered", label: t("delivered") },
    { id: "cancelled", label: t("cancelled") },
  ];

  const orders = state.customer?.orders || [];

  const filteredOrders = orders.filter((order) => {
    if (!order || !order.status) return false;
    if (selectedFilter === "all") return true;
    if (selectedFilter === "pending") {
      return [
        "pending",
        "accepted",
        "preparing",
        "ready",
        "picked_up",
      ].includes(order.status);
    }
    return order.status === selectedFilter;
  });

  const handleReorder = (order: Order) => {
    console.log("Reorder:", order.id);
    // Implement reorder logic (maybe navigate to restaurant with items pre-filled)
  };

  const handleViewDetails = (order: Order) => {
    router.push({
      pathname: "/(customer)/order-traking",
      params: {
        orderId: order.id,
        restaurantName:
          restaurantNames[order.restaurant_id] || t("restaurantFallback"),
      },
    });
  };

  const renderRightAction = () => (
    <View style={styles.rightAction}>
      <Text style={styles.actionText}>{t("reorder")}</Text>
    </View>
  );

  const renderOrderItem = ({ item }: { item: Order }) => {
    const formatDate = (dateStr?: string) => {
      if (!dateStr) return t("unknownDate");
      try {
        const d = new Date(dateStr);
        return d.toLocaleDateString();
      } catch {
        return t("invalidDate");
      }
    };

    const formatTime = (dateStr?: string) => {
      if (!dateStr) return "";
      try {
        const d = new Date(dateStr);
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } catch {
        return "";
      }
    };

    const totalAmount = item.total_amount?.total || 0;

    return (
      <SwipeableCard
        rightAction={renderRightAction()}
        onSwipeRight={() => handleReorder(item)}
      >
        <TouchableOpacity
          style={styles.orderItem}
          onPress={() => handleViewDetails(item)}
          activeOpacity={0.8}
        >
          <View style={styles.orderHeader}>
            <Text style={styles.restaurantName}>
              {restaurantNames[item.restaurant_id] || t("restaurantFallback")}
            </Text>
            <OrderStatusBadge status={item.status} />
          </View>

          <View style={styles.orderDetails}>
            <Text style={styles.orderId}>
              {t("orderHash")}
              {item.order_number || item.id.substring(0, 8)}
            </Text>
            <Text style={styles.orderDate}>
              {formatDate(item.created_at)} • {formatTime(item.created_at)}
            </Text>
          </View>

          <View style={styles.orderItems}>
            {(item.items || []).slice(0, 2).map((orderItem, index) => (
              <Text key={index} style={styles.itemText}>
                {orderItem.quantity}x {orderItem.name}
              </Text>
            ))}
            {(item.items || []).length > 2 && (
              <Text style={styles.moreItems}>
                +{(item.items || []).length - 2} {t("moreItems")}
              </Text>
            )}
          </View>

          <View style={styles.orderFooter}>
            <Text style={styles.totalAmount}>
              {totalAmount.toFixed(2)} {t("birr")}
            </Text>
            <TouchableOpacity
              style={styles.detailsButton}
              onPress={() => handleViewDetails(item)}
            >
              <Text style={styles.detailsButtonText}>{t("viewDetails")}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </SwipeableCard>
    );
  };

  if (loading && orders.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor={colors.background}
        />
        <ActivityIndicator size='large' color={colors.primary} />
        <Text style={styles.loadingText}>{t("loadingOrders")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.background}
      />

      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>{t("orderHistory")}</Text>
          <Text style={styles.subtitle}>
            {filteredOrders.length} {t("ordersFound")}
          </Text>
        </View>

        {/* Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersContainer}
          contentContainerStyle={styles.filtersContent}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterButton,
                selectedFilter === filter.id && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedFilter(filter.id)}
            >
              <Text
                style={[
                  styles.filterText,
                  selectedFilter === filter.id && styles.filterTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{t("noOrdersFound")}</Text>
            <Text style={styles.emptyMessage}>
              {selectedFilter === "all"
                ? t("noOrdersYet")
                : t("noFilteredOrders")}
            </Text>
            <TouchableOpacity
              style={styles.browseButton}
              onPress={() => router.push("/(customer)/home")}
            >
              <Text style={styles.browseButtonText}>Browse Restaurants</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredOrders}
            renderItem={renderOrderItem}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={styles.ordersList}
          />
        )}
      </ScrollView>
    </View>
  );
};

const getStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: colors.gray600,
    },
    scrollView: {
      flex: 1,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 20,
    },
    title: {
      fontSize: 28,
      fontWeight: "bold",
      color: colors.gray900,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 16,
      color: colors.gray600,
    },
    filtersContainer: {
      marginBottom: 20,
    },
    filtersContent: {
      paddingHorizontal: 20,
      gap: 12,
    },
    filterButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: colors.white,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: colors.gray200,
      // See AnimatedButton.tsx: Android fake-bolds the Amharic fallback font
      // after measuring at normal weight, so a tight pill clips the tail of
      // the label (e.g. "ንቁ" renders as "ን"). overflow:visible stops the clip.
      overflow: "visible",
    },
    filterButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.gray600,
      includeFontPadding: false,
    },
    filterTextActive: {
      color: colors.white,
    },
    ordersList: {
      paddingHorizontal: 20,
      paddingBottom: 40,
    },
    orderItem: {
      padding: 16,
    },
    orderHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    restaurantName: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.gray800,
      flex: 1,
    },
    orderDetails: {
      marginBottom: 12,
    },
    orderId: {
      fontSize: 14,
      color: colors.gray600,
      marginBottom: 2,
    },
    orderDate: {
      fontSize: 14,
      color: colors.gray500,
    },
    orderItems: {
      marginBottom: 16,
    },
    itemText: {
      fontSize: 14,
      color: colors.gray700,
      marginBottom: 4,
    },
    moreItems: {
      fontSize: 14,
      color: colors.gray500,
      fontStyle: "italic",
    },
    orderFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.gray200,
    },
    totalAmount: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.primary,
    },
    detailsButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: colors.primary + "10",
      borderRadius: 8,
      overflow: "visible",
    },
    detailsButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.primary,
      includeFontPadding: false,
    },
    rightAction: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.success,
      borderRadius: 16,
    },
    actionText: {
      color: colors.white,
      fontWeight: "bold",
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 40,
      paddingVertical: 60,
    },
    emptyTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: colors.gray700,
      marginBottom: 8,
    },
    emptyMessage: {
      fontSize: 16,
      color: colors.gray500,
      textAlign: "center",
      marginBottom: 24,
      lineHeight: 24,
    },
    browseButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
    },
    browseButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.white,
    },
  });

export default OrderHistoryScreen;
