import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme/colors";

// Use your global app types:
import { Address, Location } from "../../types";

interface LocationPickerProps {
  onLocationSelect: (address: Address) => void;
  recentLocations?: Address[];
  placeholder?: string;
}

const LocationPicker: React.FC<LocationPickerProps> = ({
  onLocationSelect,
  recentLocations = [],
  placeholder = "Enter your address",
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<Address[]>([]);

  const scaleAnim = useSharedValue(1);
  const heightAnim = useSharedValue(0);

  const handleFocus = () => {
    setIsFocused(true);
    scaleAnim.value = withSpring(1.02);
    heightAnim.value = withSpring(200);
  };

  const handleBlur = () => {
    setIsFocused(false);
    scaleAnim.value = withSpring(1);
    heightAnim.value = withSpring(0);
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);

    if (text.length > 2) {
      const mock: Address[] = [
        {
          id: "1",
          name: "Home",
          address: "123 Main St, New York, NY",
          isDefault: false,
          location: { latitude: 0, longitude: 0 },
        },
        {
          id: "2",
          name: "Work",
          address: "456 Business Ave, New York, NY",
          isDefault: false,
          location: { latitude: 0, longitude: 0 },
        },
        {
          id: "3",
          name: text,
          address: `${text}, New York, NY`,
          isDefault: false,
          location: { latitude: 0, longitude: 0 },
        },
      ];
      setSuggestions(mock);
    } else {
      setSuggestions([]);
    }
  };

  const handleLocationSelect = (address: Address) => {
    onLocationSelect(address);
    setSearchQuery(address.address);
    setSuggestions([]);
    handleBlur();
  };

  const handleUseCurrentLocation = () => {
    const current: Address = {
      id: "current",
      name: "Current Location",
      address: "Using your current location",
      isDefault: false,
      location: {
        latitude: 0,
        longitude: 0,
      },
    };

    onLocationSelect(current);
    setSearchQuery("Current Location");
  };

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
  }));

  const suggestionsAnimatedStyle = useAnimatedStyle(() => ({
    height: heightAnim.value,
  }));

  const renderLocationItem = ({ item }: { item: Address }) => (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={() => handleLocationSelect(item)}
    >
      <Ionicons name='location' size={20} color={colors.gray600} />
      <View style={styles.suggestionContent}>
        <Text style={styles.suggestionName}>{item.name}</Text>
        <Text style={styles.suggestionAddress}>{item.address}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.inputContainer, containerAnimatedStyle]}>
        <View style={styles.searchIcon}>
          <Ionicons name='search' size={20} color={colors.gray400} />
        </View>

        <TextInput
          style={styles.input}
          placeholder={placeholder}
          value={searchQuery}
          onChangeText={handleSearch}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholderTextColor={colors.gray400}
        />

        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setSearchQuery("")}
          >
            <Ionicons name='close-circle' size={20} color={colors.gray400} />
          </TouchableOpacity>
        )}
      </Animated.View>

      <TouchableOpacity
        style={styles.currentLocationButton}
        onPress={handleUseCurrentLocation}
      >
        <Ionicons name='locate' size={20} color={colors.primary} />
        <Text style={styles.currentLocationText}>Use Current Location</Text>
      </TouchableOpacity>

      <Animated.View
        style={[styles.suggestionsContainer, suggestionsAnimatedStyle]}
      >
        {suggestions.length > 0 ? (
          <FlatList
            data={suggestions}
            renderItem={renderLocationItem}
            keyExtractor={(item) => item.id}
          />
        ) : recentLocations.length > 0 && searchQuery.length === 0 ? (
          <>
            <Text style={styles.sectionTitle}>Recent Locations</Text>
            <FlatList
              data={recentLocations}
              renderItem={renderLocationItem}
              keyExtractor={(item) => item.id}
            />
          </>
        ) : null}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginHorizontal: 16 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.gray300,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: { marginRight: 8 },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.gray800,
    paddingVertical: 12,
  },
  clearButton: { padding: 4 },
  currentLocationButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary + "10",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  currentLocationText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
    marginLeft: 8,
  },
  suggestionsContainer: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray200,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.gray500,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: colors.gray50,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  suggestionContent: { flex: 1, marginLeft: 12 },
  suggestionName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray800,
    marginBottom: 2,
  },
  suggestionAddress: { fontSize: 12, color: colors.gray600 },
});

export default LocationPicker;
