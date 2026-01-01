import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { colors } from "../../theme/colors";
import EarningsChart from "../../components/driver/EarningsChart";
import { useRouter } from "expo-router";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const EarningsScreen: React.FC = () => {
  const router = useRouter();
  const [timeRange, setTimeRange] = useState<"week" | "month" | "year">("week");

  // Sample data
  const weeklyData = [120, 140, 160, 180, 200, 220, 240];
  const weeklyLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const monthlyData = [
    850, 920, 780, 1100, 950, 1200, 1050, 980, 1150, 1250, 1300, 1400,
  ];
  const monthlyLabels = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const yearlyData = [12000, 13500, 12800, 14200, 15000, 16500];
  const yearlyLabels = ["2019", "2020", "2021", "2022", "2023", "2024"];

  const earningsData = {
    week: { data: weeklyData, labels: weeklyLabels },
    month: { data: monthlyData, labels: monthlyLabels },
    year: { data: yearlyData, labels: yearlyLabels },
  };

  const earningsSummary = {
    today: 45.5,
    thisWeek: 320.0,
    thisMonth: 1250.0,
    total: 8560.0,
    completedOrders: 150,
    avgPerOrder: 15.5,
    rating: 4.8,
  };

  const recentTransactions = [
    {
      id: "1",
      date: "Today",
      amount: 18.5,
      orderId: "ORD001",
      status: "completed",
    },
    {
      id: "2",
      date: "Today",
      amount: 22.0,
      orderId: "ORD002",
      status: "completed",
    },
    {
      id: "3",
      date: "Yesterday",
      amount: 15.75,
      orderId: "ORD003",
      status: "completed",
    },
    {
      id: "4",
      date: "2 days ago",
      amount: 28.25,
      orderId: "ORD004",
      status: "completed",
    },
    {
      id: "5",
      date: "3 days ago",
      amount: 12.5,
      orderId: "ORD005",
      status: "pending",
    },
  ];

  const handleWithdraw = () => {
    Alert.alert("Withdraw Earnings", "How much would you like to withdraw?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Withdraw All",
        onPress: () => Alert.alert("Success", "Withdrawal request submitted!"),
      },
      {
        text: "Custom Amount",
        onPress: () =>
          Alert.alert(
            "Custom Amount",
            "Enter withdrawal amount feature coming soon!"
          ),
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle='dark-content' backgroundColor={colors.background} />

      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Earnings</Text>
          <Text style={styles.totalEarnings}>
            ${earningsSummary.total.toFixed(2)}
          </Text>
          <Text style={styles.subtitle}>Total earnings to date</Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              ${earningsSummary.today.toFixed(2)}
            </Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              ${earningsSummary.thisWeek.toFixed(2)}
            </Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {earningsSummary.completedOrders}
            </Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{earningsSummary.rating}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>

        {/* Time Range Selector */}
        <View style={styles.timeRangeContainer}>
          <TouchableOpacity
            style={[
              styles.timeRangeButton,
              timeRange === "week" && styles.timeRangeButtonActive,
            ]}
            onPress={() => setTimeRange("week")}
          >
            <Text
              style={[
                styles.timeRangeText,
                timeRange === "week" && styles.timeRangeTextActive,
              ]}
            >
              Week
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.timeRangeButton,
              timeRange === "month" && styles.timeRangeButtonActive,
            ]}
            onPress={() => setTimeRange("month")}
          >
            <Text
              style={[
                styles.timeRangeText,
                timeRange === "month" && styles.timeRangeTextActive,
              ]}
            >
              Month
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.timeRangeButton,
              timeRange === "year" && styles.timeRangeButtonActive,
            ]}
            onPress={() => setTimeRange("year")}
          >
            <Text
              style={[
                styles.timeRangeText,
                timeRange === "year" && styles.timeRangeTextActive,
              ]}
            >
              Year
            </Text>
          </TouchableOpacity>
        </View>

        {/* Earnings Chart */}
        <EarningsChart
          data={earningsData[timeRange].data}
          labels={earningsData[timeRange].labels}
          title={`${
            timeRange.charAt(0).toUpperCase() + timeRange.slice(1)
          }ly Earnings`}
          showGrid={true}
        />

        {/* Recent Transactions */}
        <View style={styles.transactionsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity
              onPress={() => router.push("/(driver)/documents")}
            >
              <Text style={styles.seeAllButton}>See All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.transactionsList}>
            {recentTransactions.map((transaction) => (
              <View key={transaction.id} style={styles.transactionItem}>
                <View style={styles.transactionInfo}>
                  <Text style={styles.transactionDate}>{transaction.date}</Text>
                  <Text style={styles.transactionId}>
                    Order #{transaction.orderId}
                  </Text>
                </View>
                <View style={styles.transactionAmount}>
                  <Text
                    style={[
                      styles.amount,
                      transaction.status === "pending" && styles.amountPending,
                    ]}
                  >
                    ${transaction.amount.toFixed(2)}
                  </Text>
                  <Text
                    style={[
                      styles.status,
                      transaction.status === "completed"
                        ? styles.statusCompleted
                        : styles.statusPending,
                    ]}
                  >
                    {transaction.status}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Withdrawal Section */}
        <View style={styles.withdrawalSection}>
          <View style={styles.withdrawalCard}>
            <Text style={styles.withdrawalTitle}>Available for Withdrawal</Text>
            <Text style={styles.withdrawalAmount}>
              ${earningsSummary.thisMonth.toFixed(2)}
            </Text>
            <Text style={styles.withdrawalNote}>
              Funds are available for withdrawal 24 hours after delivery
              completion
            </Text>
            <TouchableOpacity
              style={styles.withdrawButton}
              onPress={handleWithdraw}
            >
              <Text style={styles.withdrawButtonText}>Withdraw Earnings</Text>
            </TouchableOpacity>
          </View>
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.white,
    marginBottom: 8,
  },
  totalEarnings: {
    fontSize: 48,
    fontWeight: "bold",
    color: colors.white,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: colors.white + "90",
  },
  quickStats: {
    flexDirection: "row",
    backgroundColor: colors.white,
    marginHorizontal: 20,
    marginTop: -20,
    padding: 20,
    borderRadius: 20,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
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
  timeRangeContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
    marginBottom: 16,
  },
  timeRangeButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.gray200,
    marginHorizontal: 4,
  },
  timeRangeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timeRangeText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray600,
  },
  timeRangeTextActive: {
    color: colors.white,
  },
  transactionsSection: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.gray900,
  },
  seeAllButton: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "600",
  },
  transactionsList: {
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
  transactionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDate: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray800,
    marginBottom: 2,
  },
  transactionId: {
    fontSize: 12,
    color: colors.gray500,
  },
  transactionAmount: {
    alignItems: "flex-end",
  },
  amount: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.success,
    marginBottom: 2,
  },
  amountPending: {
    color: colors.warning,
  },
  status: {
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  statusCompleted: {
    backgroundColor: colors.success + "20",
    color: colors.success,
  },
  statusPending: {
    backgroundColor: colors.warning + "20",
    color: colors.warning,
  },
  withdrawalSection: {
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 40,
  },
  withdrawalCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  withdrawalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.gray800,
    marginBottom: 8,
  },
  withdrawalAmount: {
    fontSize: 36,
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: 12,
  },
  withdrawalNote: {
    fontSize: 14,
    color: colors.gray600,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  withdrawButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  withdrawButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.white,
  },
});

export default EarningsScreen;
