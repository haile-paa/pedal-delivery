import React from "react";
import { View, TextInput, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";

interface SearchBarWithFiltersProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onFiltersPress?: () => void;
}

const SearchBarWithFilters: React.FC<SearchBarWithFiltersProps> = ({
  value,
  onChangeText,
  placeholder = "Search...",
  onFiltersPress,
}) => {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name='search' size={20} color={colors.gray400} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          placeholderTextColor={colors.gray400}
        />
      </View>

      <TouchableOpacity style={styles.filterButton} onPress={onFiltersPress}>
        <Ionicons name='options-outline' size={20} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
};

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    searchContainer: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: isDark ? colors.gray100 : colors.gray50,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.1)" : colors.gray200,
    },
    input: {
      flex: 1,
      marginLeft: 8,
      fontSize: 16,
      color: colors.gray900,
    },
    filterButton: {
      backgroundColor: isDark ? colors.gray100 : colors.gray50,
      padding: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.1)" : colors.gray200,
    },
  });

export default SearchBarWithFilters;
