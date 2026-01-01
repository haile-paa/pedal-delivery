import React from "react";
import { View, TextInput, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";

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

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.gray50,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  input: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: colors.gray800,
  },
  filterButton: {
    backgroundColor: colors.gray50,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
});

export default SearchBarWithFilters;
