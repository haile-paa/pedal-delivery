import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  FlatList,
} from "react-native";
import { useAppState } from "../../context/AppStateContext";
import { colors } from "../../theme/colors";
import OrderStatusBadge from "../../components/shared/OrderStatusBadge";
import SwipeableCard from "../../components/ui/SwipeableCard";

const OrderHistoryScreen: React.FC = () => {
  const { state } = useAppState();
  const [selectedFilter, setSelectedFilter] = useState("all");

  const filters = [
    { id: "all", label: "All Orders" },
    { id: "pending", label: "Active" },
    { id: "delivered", label: "Delivered" },
    { id: "cancelled", label: "Cancelled" },
  ];

  // Safely access orders array
  const orders = state.customer?.orders || [];

  const filteredOrders = orders.filter((order) => {
    if (!order || !order.status) return false;

    if (selectedFilter === "all") return true;
    if (selectedFilter === "pending") {
      return [
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "picked_up",
      ].includes(order.status);
    }
    return order.status === selectedFilter;
  });

  const handleReorder = (order: any) => {
    // Implement reorder logic
    console.log("Reorder:", order.id);
  };

  const handleViewDetails = (order: any) => {
    // Implement view details logic
    console.log("View details:", order.id);
  };

  const renderRightAction = () => (
    <View style={styles.rightAction}>
      <Text style={styles.actionText}>Reorder</Text>
    </View>
  );

  const renderOrderItem = ({ item }: { item: any }) => {
    // Format date safely
    const formatDate = (date: any) => {
      if (!date) return "Unknown date";
      try {
        const d = new Date(date);
        return d.toLocaleDateString();
      } catch {
        return "Invalid date";
      }
    };

    const formatTime = (date: any) => {
      if (!date) return "";
      try {
        const d = new Date(date);
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } catch {
        return "";
      }
    };

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
              {item.restaurantName || "Restaurant"}
            </Text>
            <OrderStatusBadge status={item.status || "pending"} />
          </View>

          <View style={styles.orderDetails}>
            <Text style={styles.orderId}>
              Order #{item.id ? item.id.substring(0, 8) : "N/A"}
            </Text>
            <Text style={styles.orderDate}>
              {formatDate(item.createdAt)} • {formatTime(item.createdAt)}
            </Text>
          </View>

          <View style={styles.orderItems}>
            {(item.items || [])
              .slice(0, 2)
              .map((orderItem: any, index: number) => (
                <Text key={index} style={styles.itemText}>
                  {orderItem?.quantity || 0}x {orderItem?.name || "Item"}
                </Text>
              ))}
            {(item.items || []).length > 2 && (
              <Text style={styles.moreItems}>
                +{(item.items || []).length - 2} more items
              </Text>
            )}
          </View>

          <View style={styles.orderFooter}>
            <Text style={styles.totalAmount}>
              ${item.total?.toFixed(2) || "0.00"}
            </Text>
            <TouchableOpacity
              style={styles.detailsButton}
              onPress={() => handleViewDetails(item)}
            >
              <Text style={styles.detailsButtonText}>View Details</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </SwipeableCard>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle='dark-content' backgroundColor={colors.background} />

      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Order History</Text>
          <Text style={styles.subtitle}>
            {filteredOrders.length}{" "}
            {filteredOrders.length === 1 ? "order" : "orders"} found
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
            <Text style={styles.emptyTitle}>No orders found</Text>
            <Text style={styles.emptyMessage}>
              {selectedFilter === "all"
                ? "You haven't placed any orders yet"
                : `You don't have any ${selectedFilter} orders`}
            </Text>
            <TouchableOpacity style={styles.browseButton}>
              <Text style={styles.browseButtonText}>Browse Restaurants</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredOrders}
            renderItem={renderOrderItem}
            keyExtractor={(item) => item.id || Math.random().toString()}
            scrollEnabled={false}
            contentContainerStyle={styles.ordersList}
          />
        )}
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
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray600,
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
  },
  detailsButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
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
