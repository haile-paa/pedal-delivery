import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  PanResponder,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { colors } from "../../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { Restaurant, CartItem, Order } from "../../types";
import * as Location from "expo-location";
import { addressAPI } from "../../../lib/api";

interface CheckoutBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  restaurant: Restaurant;
  cartItems: CartItem[];
  cartTotal: number;
  deliveryFee: number;
  serviceCharge: number;
  grandTotal: number;
  onPlaceOrder: (paymentMethod: string, addressId: string) => Promise<Order>;
  address?: {
    id?: string;
    label: string;
    address: string;
  };
  onAddressChange?: () => void;
}

interface UserLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

const CheckoutBottomSheet: React.FC<CheckoutBottomSheetProps> = ({
  visible,
  onClose,
  restaurant,
  cartItems,
  cartTotal,
  deliveryFee,
  serviceCharge,
  grandTotal,
  onPlaceOrder,
  address,
  onAddressChange,
}) => {
  const router = useRouter();
  const translateY = useRef(new Animated.Value(0)).current;
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("cash");
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [distanceToRestaurant, setDistanceToRestaurant] = useState<
    number | null
  >(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [resolvedAddressId, setResolvedAddressId] = useState<string | null>(
    null,
  );
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, gs) => {
      translateY.setValue(Math.max(gs.dy, 0));
    },
    onPanResponderRelease: (_, gs) => {
      if (gs.dy > 100) {
        onClose();
      } else {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }).start();
      }
    },
  });

  useEffect(() => {
    if (visible) {
      setResolvedAddressId(address?.id || null);
      getUserLocation();
    }
  }, [visible]);

  const getUserLocation = async () => {
    try {
      setLocationError(null);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError("Location permission denied");
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = location.coords;

      let addressStr = address?.address || "Current Location";
      try {
        const [rg] = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });
        if (rg) {
          addressStr = `${rg.street || ""}${rg.city ? `, ${rg.city}` : ""}${rg.region ? `, ${rg.region}` : ""}`;
        }
      } catch {}

      setUserLocation({ latitude, longitude, address: addressStr });

      if (restaurant.location?.coordinates?.length >= 2) {
        setDistanceToRestaurant(
          calcDist(
            latitude,
            longitude,
            restaurant.location.coordinates[1],
            restaurant.location.coordinates[0],
          ),
        );
      } else {
        setDistanceToRestaurant(2.5);
      }

      // If no saved address, auto-save current location (but we don't need to wait here)
      if (!address?.id) {
        // Fire and forget – the ID will be captured later if needed
        autoSaveAddress(latitude, longitude, addressStr).then((id) => {
          if (id) setResolvedAddressId(id);
        });
      }
    } catch (error: any) {
      console.error("Location error:", error);
      setLocationError(error.message || "Failed to get location");
      setUserLocation({
        latitude: 9.032,
        longitude: 38.746,
        address: address?.address || "Bole, Addis Ababa, Ethiopia",
      });
      setDistanceToRestaurant(2.5);
    }
  };

  /**
   * Auto-save the current location as a delivery address.
   * Returns the saved address ID or null if failed.
   */
  const autoSaveAddress = async (
    lat: number,
    lng: number,
    addressStr: string,
  ): Promise<string | null> => {
    try {
      setIsSavingAddress(true);
      console.log("📍 Auto-saving current location as delivery address...");

      const saved = await addressAPI.addAddress({
        label: "Current Location",
        address: addressStr,
        latitude: lat,
        longitude: lng,
        is_default: true,
      });

      if (saved?.id) {
        console.log("📍 Address saved with ID:", saved.id);
        return saved.id;
      }
    } catch (error: any) {
      console.error("Auto-save address failed:", error.message);
      // Fallback: try to get any existing address
      try {
        const existing = await addressAPI.getAddresses();
        if (existing.length > 0) {
          const addr = existing.find((a: any) => a.is_default) || existing[0];
          console.log("📍 Using existing address ID:", addr.id);
          return addr.id;
        }
      } catch {}
    } finally {
      setIsSavingAddress(false);
    }
    return null;
  };

  const calcDist = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return (
      Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100
    );
  };

  const handleClose = () => {
    Animated.timing(translateY, {
      toValue: 500,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onClose();
      translateY.setValue(0);
    });
  };

  const handlePlaceOrder = async () => {
    if (restaurant.min_order != null && cartTotal < restaurant.min_order)
      return;
    if (!userLocation) {
      Alert.alert("Location Required", "Please enable location to continue.");
      return;
    }
    if (distanceToRestaurant && distanceToRestaurant > 5) {
      Alert.alert(
        "Out of Delivery Range",
        `You are ${distanceToRestaurant}km away. Max is 5km.`,
      );
      return;
    }
    if (
      selectedPaymentMethod === "telebirr" ||
      selectedPaymentMethod === "cbe"
    ) {
      Alert.alert("Coming Soon", "This payment method is coming soon.");
      return;
    }

    // Resolve address ID
    let finalAddressId = resolvedAddressId || address?.id;
    if (!finalAddressId) {
      // Try to auto-save now and get the ID directly
      if (userLocation) {
        const newId = await autoSaveAddress(
          userLocation.latitude,
          userLocation.longitude,
          userLocation.address || "Current Location",
        );
        if (newId) {
          finalAddressId = newId; // use the returned ID immediately
          setResolvedAddressId(newId); // also update state for UI
        }
      }
      if (!finalAddressId) {
        Alert.alert(
          "Address Required",
          "Unable to save delivery address. Please try again.",
        );
        return;
      }
    }

    setIsPlacingOrder(true);
    try {
      const createdOrder = await onPlaceOrder(
        selectedPaymentMethod,
        finalAddressId,
      );
      if (!createdOrder) {
        throw new Error("No order returned from server");
      }
      router.push({
        pathname: "/(customer)/order-traking",
        params: {
          orderId: createdOrder.id,
          restaurantName: restaurant.name,
          restaurantId: restaurant.id,
        },
      });
      handleClose();
      Alert.alert(
        "Order Placed!",
        `Your order from ${restaurant.name} has been placed.`,
      );
    } catch (error: any) {
      console.error("Order placement error:", error);
      Alert.alert("Order Failed", error.message || "Something went wrong.");
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handlePaymentMethodSelect = (method: string) => {
    if (method === "telebirr" || method === "cbe") {
      Alert.alert("Coming Soon", "This payment method is coming soon.");
    } else {
      setSelectedPaymentMethod(method);
    }
  };

  const isBelowMinOrder =
    restaurant.min_order != null && cartTotal < restaurant.min_order;

  return (
    <Modal
      visible={visible}
      transparent
      animationType='fade'
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={handleClose} />
        <Animated.View
          style={[styles.bottomSheet, { transform: [{ translateY }] }]}
        >
          <View style={styles.handleContainer} {...panResponder.panHandlers}>
            <View style={styles.handle} />
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Checkout</Text>
              <TouchableOpacity onPress={handleClose}>
                <Ionicons name='close' size={24} color={colors.gray600} />
              </TouchableOpacity>
            </View>

            {/* Distance info */}
            {distanceToRestaurant !== null && (
              <View style={styles.section}>
                <View
                  style={[
                    styles.distanceInfo,
                    distanceToRestaurant <= 5
                      ? styles.distanceSuccess
                      : styles.distanceWarning,
                  ]}
                >
                  <Ionicons
                    name={
                      distanceToRestaurant <= 5 ? "checkmark-circle" : "warning"
                    }
                    size={16}
                    color={
                      distanceToRestaurant <= 5
                        ? colors.success
                        : colors.warning
                    }
                  />
                  <Text style={styles.distanceText}>
                    You're {distanceToRestaurant}km away •{" "}
                    {distanceToRestaurant <= 5
                      ? "Within delivery range"
                      : "Outside delivery range (max 5km)"}
                  </Text>
                </View>
              </View>
            )}

            {locationError && (
              <View style={[styles.distanceInfo, styles.distanceWarning]}>
                <Ionicons name='warning' size={16} color={colors.warning} />
                <Text style={styles.distanceText}>{locationError}</Text>
                <TouchableOpacity
                  onPress={getUserLocation}
                  style={styles.retryButton}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {isSavingAddress && (
              <View
                style={[styles.distanceInfo, { backgroundColor: "#e0f2fe" }]}
              >
                <ActivityIndicator size='small' color={colors.primary} />
                <Text style={styles.distanceText}>
                  Saving delivery address...
                </Text>
              </View>
            )}

            {/* Order Summary */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Order Summary</Text>
              {cartItems.map((item, index) => (
                <View key={item.id || index} style={styles.orderItem}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>
                      {item.menu_item.name} × {item.quantity}
                    </Text>
                    <Text style={styles.itemPrice}>
                      {(item.menu_item.price * item.quantity).toFixed(2)} Birr
                    </Text>
                  </View>
                  {item.special_instructions && (
                    <Text style={styles.instructions}>
                      Note: {item.special_instructions}
                    </Text>
                  )}
                </View>
              ))}
              <View style={styles.restaurantInfo}>
                <Ionicons name='restaurant' size={20} color={colors.gray600} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.restaurantName}>{restaurant.name}</Text>
                  {restaurant.address && (
                    <Text style={styles.restaurantAddress}>
                      {restaurant.address}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Payment Methods */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Payment Method</Text>
              {(["telebirr", "cbe", "cash"] as const).map((method) => (
                <TouchableOpacity
                  key={method}
                  style={[
                    styles.paymentOption,
                    selectedPaymentMethod === method &&
                      styles.selectedPaymentOption,
                  ]}
                  onPress={() => handlePaymentMethodSelect(method)}
                >
                  <View style={styles.paymentOptionLeft}>
                    <View
                      style={[
                        styles.paymentIconContainer,
                        method === "cbe" && styles.cbeIconContainer,
                        method === "cash" && styles.cashIconContainer,
                      ]}
                    >
                      {method === "telebirr" && (
                        <Image
                          source={{
                            uri: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Telebirr_Logo.svg/1200px-Telebirr_Logo.svg.png",
                          }}
                          style={styles.paymentIcon}
                        />
                      )}
                      {method === "cbe" && (
                        <Image
                          source={{
                            uri: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/CBE_Logo.svg/2560px-CBE_Logo.svg.png",
                          }}
                          style={[styles.paymentIcon, styles.cbeIcon]}
                        />
                      )}
                      {method === "cash" && (
                        <Ionicons
                          name='cash-outline'
                          size={24}
                          color={colors.warning}
                        />
                      )}
                    </View>
                    <View style={styles.paymentInfo}>
                      <Text style={styles.paymentName}>
                        {method === "telebirr"
                          ? "Telebirr"
                          : method === "cbe"
                            ? "CBE"
                            : "Cash on Delivery"}
                      </Text>
                      <Text style={styles.paymentDescription}>
                        {method === "cash"
                          ? "Pay when you receive"
                          : "Coming Soon"}
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name={
                      selectedPaymentMethod === method
                        ? "radio-button-on"
                        : "radio-button-off"
                    }
                    size={24}
                    color={
                      selectedPaymentMethod === method
                        ? colors.primary
                        : colors.gray400
                    }
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Order Total */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Order Total</Text>
              <View style={styles.summaryContainer}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal</Text>
                  <Text style={styles.summaryValue}>
                    {cartTotal.toFixed(2)} Birr
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Delivery Fee</Text>
                  <Text style={styles.summaryValue}>
                    {deliveryFee.toFixed(2)} Birr
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Service Charge</Text>
                  <Text style={styles.summaryValue}>
                    {serviceCharge.toFixed(2)} Birr
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.grandTotalLabel}>Total</Text>
                  <Text style={styles.grandTotalValue}>
                    {grandTotal.toFixed(2)} Birr
                  </Text>
                </View>
              </View>
              {isBelowMinOrder && (
                <View style={styles.minOrderWarning}>
                  <Ionicons
                    name='alert-circle-outline'
                    size={20}
                    color={colors.warning}
                  />
                  <Text style={styles.minOrderText}>
                    Minimum order is {restaurant.min_order} Birr. Add{" "}
                    {(restaurant.min_order! - cartTotal).toFixed(2)} Birr more.
                  </Text>
                </View>
              )}
            </View>

            {/* Delivery Address */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Delivery Address</Text>
              <View style={styles.addressCard}>
                <Ionicons
                  name='location-outline'
                  size={20}
                  color={colors.primary}
                />
                <View style={styles.addressInfo}>
                  <Text style={styles.addressTitle}>
                    {userLocation?.address
                      ? "Current Location"
                      : address?.label || "Delivery Address"}
                  </Text>
                  <Text style={styles.addressText}>
                    {userLocation?.address ||
                      address?.address ||
                      "Select an address"}
                  </Text>
                  {resolvedAddressId && (
                    <Text
                      style={{
                        fontSize: 11,
                        color: colors.success,
                        marginTop: 4,
                      }}
                    >
                      ✓ Address saved for delivery
                    </Text>
                  )}
                  {onAddressChange && (
                    <TouchableOpacity
                      style={styles.changeAddressButton}
                      onPress={onAddressChange}
                    >
                      <Text style={styles.changeAddressText}>
                        Change Address
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.placeOrderButton,
                (isBelowMinOrder || isPlacingOrder || isSavingAddress) &&
                  styles.disabledButton,
              ]}
              onPress={handlePlaceOrder}
              disabled={isBelowMinOrder || isPlacingOrder || isSavingAddress}
            >
              {isPlacingOrder ? (
                <Text style={styles.placeOrderText}>Processing...</Text>
              ) : (
                <>
                  <Text style={styles.placeOrderText}>
                    Place Order • {grandTotal.toFixed(2)} Birr
                  </Text>
                  <Ionicons
                    name='arrow-forward'
                    size={20}
                    color={colors.white}
                  />
                </>
              )}
            </TouchableOpacity>
            {isBelowMinOrder && (
              <Text style={styles.minOrderNote}>
                Minimum order amount not reached
              </Text>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: 8,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.gray300,
    borderRadius: 2,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: "75%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.gray900,
  },
  section: {
    marginBottom: 24,
  },
  distanceInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.successLight,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  distanceSuccess: {
    backgroundColor: colors.successLight,
  },
  distanceWarning: {
    backgroundColor: colors.warningLight,
  },
  distanceText: {
    fontSize: 14,
    color: colors.gray700,
    flex: 1,
  },
  retryButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  retryText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "500",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.gray900,
    marginBottom: 12,
  },
  orderItem: {
    marginBottom: 12,
  },
  itemInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemName: {
    fontSize: 14,
    color: colors.gray700,
    flex: 1,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray900,
  },
  instructions: {
    fontSize: 12,
    color: colors.gray600,
    fontStyle: "italic",
    marginTop: 4,
  },
  restaurantInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.gray100,
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  restaurantDetails: {
    flex: 1,
  },
  restaurantName: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.gray800,
    marginBottom: 2,
  },
  restaurantAddress: {
    fontSize: 12,
    color: colors.gray600,
  },
  paymentOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  selectedPaymentOption: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  paymentOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  paymentIconContainer: {
    width: 50,
    height: 50,
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  cbeIconContainer: {
    backgroundColor: "#1E3A8A",
  },
  cashIconContainer: {
    backgroundColor: colors.warningLight,
  },
  paymentIcon: {
    width: 30,
    height: 30,
    resizeMode: "contain",
  },
  cbeIcon: {
    width: 40,
    height: 25,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.gray900,
    marginBottom: 4,
  },
  paymentDescription: {
    fontSize: 12,
    color: colors.gray600,
  },
  radioContainer: {
    marginLeft: 12,
  },
  summaryContainer: {
    backgroundColor: colors.gray50,
    padding: 16,
    borderRadius: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.gray600,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.gray900,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray300,
    marginVertical: 12,
  },
  grandTotalLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.gray900,
  },
  grandTotalValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.primary,
  },
  minOrderWarning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.warningLight,
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  minOrderText: {
    fontSize: 14,
    color: colors.warning,
    flex: 1,
  },
  addressCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.gray50,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  addressInfo: {
    flex: 1,
  },
  addressTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray900,
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: colors.gray600,
    marginBottom: 8,
    lineHeight: 20,
  },
  changeAddressButton: {
    alignSelf: "flex-start",
  },
  changeAddressText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.primary,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    backgroundColor: colors.white,
  },
  placeOrderButton: {
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  disabledButton: {
    backgroundColor: colors.gray400,
  },
  placeOrderText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "bold",
  },
  minOrderNote: {
    fontSize: 12,
    color: colors.gray500,
    textAlign: "center",
    marginTop: 8,
  },
});

export default CheckoutBottomSheet;
