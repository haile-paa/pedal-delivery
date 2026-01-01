import React from "react";
import { View, Text, StyleSheet } from "react-native";

export const SettingsScreen: React.FC = () => (
  <View style={styles.container}>
    <Text>Settings placeholder</Text>
  </View>
);

const styles = StyleSheet.create({ container: { flex: 1, padding: 12 } });

export default SettingsScreen;
