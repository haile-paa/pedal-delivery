import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  StatusBar,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../../src/theme/colors";

const DriverFormScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const initialPhone = (params.phone as string) || "";

  const [phoneNumber, setPhoneNumber] = useState(initialPhone);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const validatePhoneNumber = (phone: string): boolean => {
    const cleaned = phone.replace(/\D/g, "");
    return cleaned.length === 9;
  };

  const handleDriverRegistration = async () => {
    // Validate phone number
    if (!phoneNumber.trim()) {
      Alert.alert("Error", "Please enter your phone number");
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      Alert.alert(
        "Error",
        "Please enter a valid 9-digit phone number (e.g., 912345678)"
      );
      return;
    }

    // Validate username
    if (!username.trim()) {
      Alert.alert("Error", "Please enter the username provided by manager");
      return;
    }

    // Validate password
    if (!password.trim()) {
      Alert.alert("Error", "Please enter the password provided by manager");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      // First, register the driver with username/password
      const registerRes = await fetch(
        "http://192.168.1.3:8080/api/v1/auth/register-driver",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: phoneNumber,
            username: username.trim(),
            password: password.trim(),
          }),
        }
      );

      const registerData = await registerRes.json();

      if (registerRes.ok) {
        // Then send OTP for verification
        const otpRes = await fetch(
          "http://192.168.1.3:8080/api/v1/auth/send-otp",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: phoneNumber,
              role: "driver",
            }),
          }
        );

        const otpData = await otpRes.json();

        if (otpRes.ok) {
          router.push(
            `/(auth)/phone-verification?role=driver&phone=${phoneNumber}`
          );
        } else {
          Alert.alert("Error", otpData.message || "Failed to send OTP");
        }
      } else {
        Alert.alert("Error", registerData.message || "Registration failed");
      }
    } catch (err) {
      Alert.alert("Error", "Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <StatusBar barStyle='dark-content' backgroundColor={colors.background} />

      <View style={styles.header}>
        <Text style={styles.title}>Driver Registration</Text>
        <Text style={styles.subtitle}>
          Enter your details provided by the manager
        </Text>
      </View>

      <View style={styles.form}>
        {/* Phone Number Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <View style={styles.phoneInputWrapper}>
            <View style={styles.countryCodeContainer}>
              <Text style={styles.countryCodeText}>+251</Text>
            </View>
            <TextInput
              style={styles.phoneInput}
              placeholder='912345678'
              placeholderTextColor={colors.gray400}
              keyboardType='phone-pad'
              value={phoneNumber}
              onChangeText={(text) => {
                const cleaned = text.replace(/[^0-9]/g, "");
                setPhoneNumber(cleaned);
              }}
              maxLength={9}
              editable={!loading}
            />
          </View>
          <Text style={styles.hint}>
            Enter your 9-digit phone number starting with 9
          </Text>
        </View>

        {/* Username Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            placeholder='Enter username from manager'
            placeholderTextColor={colors.gray400}
            value={username}
            onChangeText={setUsername}
            editable={!loading}
            autoCapitalize='none'
          />
          <Text style={styles.hint}>
            Unique username provided by your manager
          </Text>
        </View>

        {/* Password Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder='Enter password from manager'
            placeholderTextColor={colors.gray400}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />
          <Text style={styles.hint}>
            Secure password provided by your manager
          </Text>
        </View>

        {/* Confirm Password Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={styles.input}
            placeholder='Confirm password'
            placeholderTextColor={colors.gray400}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            editable={!loading}
          />
          <Text style={styles.hint}>Re-enter the password to confirm</Text>
        </View>

        {/* Register Button */}
        <TouchableOpacity
          style={[
            styles.registerButton,
            (!phoneNumber.trim() ||
              !username.trim() ||
              !password.trim() ||
              !confirmPassword.trim() ||
              loading) &&
              styles.registerButtonDisabled,
          ]}
          onPress={handleDriverRegistration}
          disabled={
            !phoneNumber.trim() ||
            !username.trim() ||
            !password.trim() ||
            !confirmPassword.trim() ||
            loading
          }
        >
          <LinearGradient
            colors={["#FF6B6B", "#FF8E53"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.registerButtonGradient}
          >
            <Text style={styles.registerButtonText}>
              {loading ? "Processing..." : "Register & Verify Phone"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={styles.backButtonText}>← Back to Welcome</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.gray900,
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: colors.gray600,
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 300,
  },
  form: {
    width: "100%",
    maxWidth: 350,
    alignSelf: "center",
  },
  inputGroup: {
    marginBottom: 24,
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
  input: {
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    fontSize: 16,
    color: colors.gray900,
    borderWidth: 1,
    borderColor: colors.gray300,
  },
  hint: {
    fontSize: 12,
    color: colors.gray500,
    marginTop: 8,
  },
  registerButton: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 20,
    shadowColor: "#FF6B6B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  registerButtonDisabled: {
    opacity: 0.5,
  },
  registerButtonGradient: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  registerButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  backButton: {
    marginTop: 20,
    paddingVertical: 12,
    alignItems: "center",
  },
  backButtonText: {
    color: colors.gray600,
    fontSize: 16,
    fontWeight: "500",
  },
});

export default DriverFormScreen;
