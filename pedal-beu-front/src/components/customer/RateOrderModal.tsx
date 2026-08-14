import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "../../theme/colors";
import { API_BASE_URL } from "../../utils/constants";
import StarRatingInput from "./StarRatingInput";
import AnimatedButton from "../ui/AnimatedButton";

interface RateOrderModalProps {
  visible: boolean;
  orderId: string;
  onClose: () => void;
  onSubmitted: (rating: {
    food_rating: number;
    delivery_rating: number;
    restaurant_rating: number;
  }) => void;
}

// Lets a customer rate a delivered order — food, delivery, and restaurant
// experience, each 1-5 stars — and submits it to POST /orders/:id/rate.
// That endpoint also recomputes and persists the driver's and restaurant's
// average rating, so this is what feeds the "real" ratings shown on the
// driver's profile/dashboard and the restaurant listing.
const RateOrderModal: React.FC<RateOrderModalProps> = ({
  visible,
  orderId,
  onClose,
  onSubmitted,
}) => {
  const [foodRating, setFoodRating] = useState(0);
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [restaurantRating, setRestaurantRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setFoodRating(0);
    setDeliveryRating(0);
    setRestaurantRating(0);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (foodRating === 0 || deliveryRating === 0 || restaurantRating === 0) {
      Alert.alert(
        "Almost done",
        "Please rate the food, delivery, and restaurant before submitting.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem("accessToken");
      if (!token) {
        throw new Error("You are not logged in");
      }

      const body = {
        food_rating: foodRating,
        delivery_rating: deliveryRating,
        restaurant_rating: restaurantRating,
      };

      const res = await fetch(`${API_BASE_URL}/orders/${orderId}/rate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit rating");
      }

      onSubmitted(body);
      reset();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to submit rating");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType='slide'
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Rate Your Order</Text>
            <TouchableOpacity onPress={handleClose} disabled={submitting}>
              <Ionicons name='close' size={24} color={colors.gray600} />
            </TouchableOpacity>
          </View>

          <View style={styles.category}>
            <Text style={styles.categoryLabel}>Food Quality</Text>
            <StarRatingInput value={foodRating} onChange={setFoodRating} />
          </View>

          <View style={styles.category}>
            <Text style={styles.categoryLabel}>Delivery Experience</Text>
            <StarRatingInput
              value={deliveryRating}
              onChange={setDeliveryRating}
            />
          </View>

          <View style={styles.category}>
            <Text style={styles.categoryLabel}>Restaurant Service</Text>
            <StarRatingInput
              value={restaurantRating}
              onChange={setRestaurantRating}
            />
          </View>

          {submitting ? (
            <ActivityIndicator
              size='small'
              color={colors.primary}
              style={styles.spinner}
            />
          ) : (
            <AnimatedButton
              title='Submit Rating'
              onPress={handleSubmit}
              fullWidth
              style={styles.submitButton}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: "bold", color: colors.gray800 },
  category: { marginBottom: 20 },
  categoryLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.gray700,
    marginBottom: 8,
  },
  spinner: { marginTop: 8 },
  submitButton: { marginTop: 8 },
});

export default RateOrderModal;
