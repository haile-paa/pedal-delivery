import React from "react";
import { View, Text, StyleSheet } from "react-native";

type Props = { title?: string };

export const Header: React.FC<Props> = ({ title }) => (
  <View style={styles.header}>
    <Text style={styles.title}>{title ?? "Pedal Beu"}</Text>
  </View>
);

const styles = StyleSheet.create({
  header: {
    height: 64,
    paddingHorizontal: 16,
    justifyContent: "center",
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#f2f2f2",
  },
  title: { fontSize: 18, fontWeight: "700" },
});

export default Header;
