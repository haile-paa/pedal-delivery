import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { LineChart } from "react-native-chart-kit";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { colors } from "../../theme/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface EarningsChartProps {
  data: number[];
  labels: string[];
  title?: string;
  showGrid?: boolean;
}

const EarningsChart: React.FC<EarningsChartProps> = ({
  data,
  labels,
  title = "Earnings Trend",
  showGrid = true,
}) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  React.useEffect(() => {
    opacity.value = withTiming(1, { duration: 1000 });
    translateY.value = withTiming(0, { duration: 1000 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const chartData = {
    labels: labels,
    datasets: [
      {
        data: data,
        color: (opacity = 1) => colors.primary,
        strokeWidth: 3,
      },
    ],
  };

  const chartConfig = {
    backgroundColor: colors.white,
    backgroundGradientFrom: colors.white,
    backgroundGradientTo: colors.white,
    decimalPlaces: 0,
    color: (opacity = 1) => colors.primary,
    labelColor: (opacity = 1) => colors.gray600,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: "6",
      strokeWidth: "2",
      stroke: colors.primary,
    },
    propsForBackgroundLines: {
      strokeDasharray: "",
      stroke: colors.gray200,
      strokeWidth: 1,
    },
  };

  // Calculate statistics
  const total = data.reduce((sum, value) => sum + value, 0);
  const average = total / data.length;
  const max = Math.max(...data);
  const min = Math.min(...data);

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.total}>${total.toFixed(2)}</Text>
      </View>

      <LineChart
        data={chartData}
        width={SCREEN_WIDTH - 48}
        height={220}
        chartConfig={chartConfig}
        bezier
        style={styles.chart}
        withHorizontalLines={showGrid}
        withVerticalLines={showGrid}
        withShadow={false}
        withInnerLines={true}
        withOuterLines={true}
        segments={5}
        fromZero={true}
      />

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Average</Text>
          <Text style={styles.statValue}>${average.toFixed(2)}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Highest</Text>
          <Text style={styles.statValue}>${max.toFixed(2)}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Lowest</Text>
          <Text style={styles.statValue}>${min.toFixed(2)}</Text>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.gray800,
  },
  total: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.primary,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    color: colors.gray600,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.gray800,
  },
});

export default EarningsChart;
