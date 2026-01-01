import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { colors } from "../../theme/colors";
import api, { authAPI } from "../../../lib/api";

const { width: screenWidth } = Dimensions.get("window");

const DriverPhoneInputScreen: React.FC = () => {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const formatPhoneNumber = (phone: string) => {
    const digits = phone.replace(/\D/g, "");

    if (digits.startsWith("9")) {
      return `+251${digits}`;
    }

    if (digits.startsWith("0")) {
      return `+251${digits.substring(1)}`;
    }

    return phone;
  };

  const handleContinue = async () => {
    // Validate phone number
    const digits = phoneNumber.replace(/\D/g, "");
    if (digits.length !== 10 || !digits.startsWith("9")) {
      Alert.alert(
        "Invalid Phone Number",
        "Please enter a valid Ethiopian phone number starting with 9"
      );
      return;
    }

    setLoading(true);

    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);

      // Request OTP for driver
      const response = await authAPI.sendOTP(formattedPhone, "driver");

      Alert.alert(
        "OTP Sent",
        response.message || "Verification code has been sent to your phone",
        [{ text: "OK" }]
      );

      // Navigate to verification screen
      router.push(
        `/(auth)/phone-verification?role=driver&phone=${formattedPhone}`
      );
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.message || "Failed to send verification code. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle='dark-content' backgroundColor={colors.background} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.backButton} onPress={() => router.back()}>
            ← Back
          </Text>
          <Text style={styles.title}>Driver Registration</Text>
          <Text style={styles.subtitle}>
            Enter your phone number to start the driver registration process
          </Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.phoneInputContainer}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.phoneInputWrapper}>
              <View style={styles.countryCodeContainer}>
                <Text style={styles.countryCodeText}>+251</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                placeholder='9 XXXXXXXX'
                placeholderTextColor={colors.gray400}
                keyboardType='phone-pad'
                value={phoneNumber}
                onChangeText={(text) => {
                  const digits = text.replace(/\D/g, "").slice(0, 9);
                  setPhoneNumber(digits);
                }}
                maxLength={9}
                editable={!loading}
                autoFocus
              />
            </View>
            <Text style={styles.hint}>Enter your 9-digit phone number</Text>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Important Information:</Text>
            <Text style={styles.infoText}>
              • You'll need to provide driver's license and vehicle details
            </Text>
            <Text style={styles.infoText}>
              • Your account needs admin approval before you can start accepting
              deliveries
            </Text>
            <Text style={styles.infoText}>
              • Approval typically takes 24-48 hours
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.continueButton,
              (!phoneNumber.trim() || phoneNumber.length < 9 || loading) &&
                styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            disabled={!phoneNumber.trim() || phoneNumber.length < 9 || loading}
          >
            <Text style={styles.continueButtonText}>
              {loading ? "Sending OTP..." : "Continue"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  backButton: {
    alignSelf: "flex-start",
    fontSize: 16,
    color: colors.primary,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.gray900,
    marginBottom: 12,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: colors.gray600,
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 300,
  },
  formContainer: {
    flex: 1,
  },
  phoneInputContainer: {
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.gray800,
    marginBottom: 8,
  },
  phoneInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: colors.gray300,
  },
  countryCodeContainer: {
    marginRight: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.gray50,
    borderRadius: 8,
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.gray800,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: colors.gray900,
    height: "100%",
  },
  hint: {
    fontSize: 14,
    color: colors.gray500,
    marginTop: 8,
  },
  infoBox: {
    backgroundColor: colors.primary + "10",
    padding: 16,
    borderRadius: 12,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: colors.primary + "30",
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.primary,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.gray700,
    lineHeight: 20,
    marginBottom: 4,
  },
  continueButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: "auto",
  },
  continueButtonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
});

export default DriverPhoneInputScreen;
