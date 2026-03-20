import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { colors } from "../../theme/colors";
import EarningsChart from "../../components/driver/EarningsChart";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface EarningsSummary {
  today: number;
  thisWeek: number;
  thisMonth: number;
  total: number;
  completedOrders: number;
  avgPerOrder: number;
  rating: number;
}

interface Transaction {
  id: string;
  date: string;
  amount: number;
  orderId: string;
  status: "completed" | "pending" | "failed";
}

const EarningsScreen: React.FC = () => {
  const router = useRouter();
  const [timeRange, setTimeRange] = useState<"week" | "month" | "year">("week");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<EarningsSummary>({
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    total: 0,
    completedOrders: 0,
    avgPerOrder: 0,
    rating: 5.0,
  });
  const [chartData, setChartData] = useState<{
    data: number[];
    labels: string[];
  }>({
    data: [],
    labels: [],
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [chartError, setChartError] = useState(false);

  useEffect(() => {
    fetchEarningsData();
  }, [timeRange]);

  const fetchEarningsData = async () => {
    setLoading(true);
    setChartError(false);
    try {
      const token = await AsyncStorage.getItem("accessToken");

      const summaryRes = await fetch(
        "https://pedal-delivery-back.onrender.com/api/v1/driver/earnings/summary",
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSummary(data);
      }

      const chartRes = await fetch(
        `https://pedal-delivery-back.onrender.com/api/v1/driver/earnings/chart?range=${timeRange}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (chartRes.ok) {
        const data = await chartRes.json();
        setChartData({
          data: data.data || [],
          labels: data.labels || [],
        });
      } else {
        setChartError(true);
      }

      const txRes = await fetch(
        "https://pedal-delivery-back.onrender.com/api/v1/driver/earnings/transactions?limit=5",
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (txRes.ok) {
        const data = await txRes.json();
        setTransactions(data);
      }
    } catch (error) {
      console.error("Fetch earnings error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = () => {
    Alert.alert("Withdraw Earnings", "How much would you like to withdraw?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Withdraw All",
        onPress: () =>
          Alert.alert("Success", "Withdrawal request submitted! (Demo)"),
      },
      {
        text: "Custom Amount",
        onPress: () =>
          Alert.alert(
            "Custom Amount",
            "Enter withdrawal amount feature coming soon!",
          ),
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size='large' color={colors.primary} />
        <Text style={styles.loadingText}>Loading earnings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle='dark-content' backgroundColor={colors.background} />
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>Earnings</Text>
          <Text style={styles.totalEarnings}>
            {summary.total.toFixed(2)} Birr
          </Text>
          <Text style={styles.subtitle}>Total earnings to date</Text>
        </View>

        <View style={styles.quickStats}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {summary.today.toFixed(2)} Birr
            </Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {summary.thisWeek.toFixed(2)} Birr
            </Text>
            <Text style={styles.statLabel}>This Week</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{summary.completedOrders}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{summary.rating.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>

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

        {chartError ? (
          <View style={styles.chartErrorContainer}>
            <Text style={styles.chartErrorText}>
              Chart data currently unavailable
            </Text>
          </View>
        ) : chartData.data.length > 0 ? (
          <EarningsChart
            data={chartData.data}
            labels={chartData.labels}
            title={`${timeRange.charAt(0).toUpperCase() + timeRange.slice(1)}ly Earnings`}
            showGrid={true}
          />
        ) : (
          <View style={styles.chartErrorContainer}>
            <Text style={styles.chartErrorText}>
              No earnings data for this period
            </Text>
          </View>
        )}

        <View style={styles.transactionsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity
              onPress={() => router.push("/(driver)/documents" as any)}
            >
              <Text style={styles.seeAllButton}>See All</Text>
            </TouchableOpacity>
          </View>

          {transactions.length === 0 ? (
            <View style={styles.emptyTransactions}>
              <Text style={styles.emptyText}>No transactions yet</Text>
            </View>
          ) : (
            <View style={styles.transactionsList}>
              {transactions.map((tx) => (
                <View key={tx.id} style={styles.transactionItem}>
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionDate}>{tx.date}</Text>
                    <Text style={styles.transactionId}>
                      Order #{tx.orderId}
                    </Text>
                  </View>
                  <View style={styles.transactionAmount}>
                    <Text
                      style={[
                        styles.amount,
                        tx.status === "pending" && styles.amountPending,
                      ]}
                    >
                      {tx.amount.toFixed(2)} Birr
                    </Text>
                    <Text
                      style={[
                        styles.status,
                        tx.status === "completed"
                          ? styles.statusCompleted
                          : tx.status === "pending"
                            ? styles.statusPending
                            : styles.statusFailed,
                      ]}
                    >
                      {tx.status}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.withdrawalSection}>
          <View style={styles.withdrawalCard}>
            <Text style={styles.withdrawalTitle}>Available for Withdrawal</Text>
            <Text style={styles.withdrawalAmount}>
              {summary.thisMonth.toFixed(2)} Birr
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
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 16, color: colors.gray600 },
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
  subtitle: { fontSize: 16, color: colors.white + "90" },
  quickStats: {
    flexDirection: "row",
    backgroundColor: colors.white,
    marginHorizontal: 20,
    marginTop: -20,
    padding: 20,
    borderRadius: 20,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  statCard: { flex: 1, alignItems: "center" },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: { fontSize: 12, color: colors.gray600 },
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
  timeRangeText: { fontSize: 14, fontWeight: "600", color: colors.gray600 },
  timeRangeTextActive: { color: colors.white },
  chartErrorContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    marginHorizontal: 20,
    backgroundColor: colors.gray100,
    borderRadius: 16,
  },
  chartErrorText: { fontSize: 16, color: colors.gray600 },
  transactionsSection: { paddingHorizontal: 20, marginTop: 24 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: colors.gray900 },
  seeAllButton: { fontSize: 14, color: colors.primary, fontWeight: "600" },
  emptyTransactions: { alignItems: "center", paddingVertical: 20 },
  emptyText: { fontSize: 14, color: colors.gray500 },
  transactionsList: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
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
  transactionInfo: { flex: 1 },
  transactionDate: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray800,
    marginBottom: 2,
  },
  transactionId: { fontSize: 12, color: colors.gray500 },
  transactionAmount: { alignItems: "flex-end" },
  amount: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.success,
    marginBottom: 2,
  },
  amountPending: { color: colors.warning },
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
  statusFailed: { backgroundColor: colors.error + "20", color: colors.error },
  withdrawalSection: { paddingHorizontal: 20, marginTop: 24, marginBottom: 40 },
  withdrawalCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
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
  withdrawButtonText: { fontSize: 16, fontWeight: "bold", color: colors.white },
});

export default EarningsScreen;
