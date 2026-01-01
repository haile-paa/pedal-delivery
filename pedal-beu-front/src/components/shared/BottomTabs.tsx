import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { useRouter, usePathname } from "expo-router";

type TabItem = { label: string; path: `/${string}` };

type Props = { items: TabItem[] };

const BottomTabs: React.FC<Props> = ({ items }) => {
  const router = useRouter();
  const pathname = usePathname() ?? "";

  const navigate = (p: TabItem["path"]) => router.push(p as any);

  return (
    <View style={styles.tabbar}>
      {items.map((it) => {
        const active = pathname.startsWith(it.path.replace(/\/+/g, "/"));
        return (
          <TouchableOpacity
            key={it.path}
            onPress={() => navigate(it.path)}
            style={styles.tab}
            accessibilityRole='button'
          >
            <Text style={[styles.label, active ? styles.active : undefined]}>
              {it.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  tabbar: {
    height: 64,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    backgroundColor: "white",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  tab: { flex: 1, alignItems: "center" },
  label: { color: "#333" },
  active: { color: "#0a84ff", fontWeight: "700" },
});

export default BottomTabs;
