import React from "react";
import { View, Text, StyleSheet } from "react-native";

export const OrderStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const bg =
    status === "delivered"
      ? "#34c759"
      : status === "on_the_way"
      ? "#ff9f0a"
      : "#d1d1d6";
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={styles.text}>{status.replace("_", " ").toUpperCase()}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  text: { color: "white", fontSize: 12, fontWeight: "600" },
});

export default OrderStatusBadge;
