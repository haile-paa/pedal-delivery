import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

type Props = { onPick?: () => void; address?: string };

export const LocationPicker: React.FC<Props> = ({ onPick, address }) => (
  <TouchableOpacity
    style={styles.container}
    onPress={onPick}
    activeOpacity={0.8}
  >
    <Text style={{ color: "#333" }}>
      {address ?? "Select delivery location"}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { padding: 12, backgroundColor: "white", borderRadius: 8 },
});

export default LocationPicker;
