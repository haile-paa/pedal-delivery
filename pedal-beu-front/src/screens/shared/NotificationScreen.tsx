import React from "react";
import { View, Text, StyleSheet } from "react-native";

export const NotificationScreen: React.FC = () => (
  <View style={styles.container}>
    <Text>Notifications placeholder</Text>
  </View>
);

const styles = StyleSheet.create({ container: { flex: 1, padding: 12 } });

export default NotificationScreen;
