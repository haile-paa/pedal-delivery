import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../../theme/colors";

interface ChartProps {
  data: number[];
  labels: string[];
  title: string;
  showGrid?: boolean;
}

const EarningsChart: React.FC<ChartProps> = ({
  data,
  labels,
  title,
  showGrid = false,
}) => {
  const maxValue = data.length > 0 ? Math.max(...data, 0) : 1;

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>{title}</Text>
      {showGrid && <View style={styles.chartGrid} />}
      <View style={styles.chartBarsContainer}>
        {data.map((value, index) => {
          const height: `${number}%` = `${(Math.max(value, 0) / maxValue) * 100}%`;
          return (
            <View key={`${labels[index] ?? index}`} style={styles.barColumn}>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { height }]} />
              </View>
              <Text style={styles.barLabel}>{labels[index] ?? ""}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  chartCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 8,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.gray900,
    marginBottom: 16,
  },
  chartGrid: {
    position: "absolute",
    top: 52,
    left: 20,
    right: 20,
    height: 160,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.gray200,
  },
  chartBarsContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 180,
  },
  barColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    height: "100%",
  },
  barTrack: {
    width: "60%",
    height: "85%",
    justifyContent: "flex-end",
    backgroundColor: colors.gray100,
    borderRadius: 6,
    overflow: "hidden",
  },
  barFill: {
    width: "100%",
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  barLabel: {
    marginTop: 8,
    fontSize: 11,
    color: colors.gray600,
  },
});

export default EarningsChart;
