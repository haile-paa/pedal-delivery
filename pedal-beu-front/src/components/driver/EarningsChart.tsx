import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../context/ThemeContext";

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
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
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
                <LinearGradient
                  colors={
                    isDark
                      ? [colors.secondary, colors.primary]
                      : [colors.primary, colors.primaryGlow]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={[styles.barFill, { height }]}
                />
              </View>
              <Text style={styles.barLabel}>{labels[index] ?? ""}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    chartCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      marginHorizontal: 20,
      marginTop: 8,
      borderWidth: isDark ? 1 : 0,
      borderColor: "rgba(255,255,255,0.08)",
      shadowColor: isDark ? colors.primaryGlow : colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.2 : 0.1,
      shadowRadius: isDark ? 12 : 8,
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
      borderRadius: 6,
    },
    barLabel: {
      marginTop: 8,
      fontSize: 11,
      color: colors.gray600,
    },
  });

export default EarningsChart;
