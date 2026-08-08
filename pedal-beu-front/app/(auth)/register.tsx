// app/(auth)/register.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { colors } from "../../src/theme/colors";
import { authAPI } from "../../lib/api";
import { LinearGradient } from "expo-linear-gradient";
import { useAppState } from "../../src/context/AppStateContext";

const RegisterScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{
    phone: string;
    email: string;
    role: "customer" | "driver";
  }>();
  const { dispatch } = useAppState();

  const role = params.role || "customer";

  const [firstName, setFirstName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState(params.phone || "");
  const [email, setEmail] = useState(params.email || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const validatePhoneNumber = (phone: string): boolean => {
    const cleaned = phone.replace(/\D/g, "");
    return cleaned.length === 9;
  };

  const validateEmail = (value: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  };

  const handleRegister = async () => {
    if (!firstName.trim()) {
      Alert.alert("Error", "Please enter your first name");
      return;
    }

    if (!phoneNumber.trim() || !validatePhoneNumber(phoneNumber)) {
      Alert.alert("Error", "Enter a valid 9-digit phone number like 912345678");
      return;
    }

    if (!email.trim() || !validateEmail(email)) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    if (!password.trim() || password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    setLoading(true);
    console.log("🚀 Starting registration process...");

    try {
      const response = await authAPI.register({
        phone: phoneNumber,
        first_name: firstName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
      });

      console.log("📋 Register response object:", response);

      if (response.success && response.user) {
        // Admins are verified immediately and come back with usable tokens.
        // Customers/drivers are unverified — the backend already sent an OTP
        // email, so send them to the verification screen instead of logging
        // them straight in.
        const accessToken =
          response.tokens?.access_token || response.tokens?.accessToken;

        if (accessToken) {
          const userRole = response.user.role as "customer" | "driver";
          dispatch({
            type: "LOGIN_SUCCESS",
            payload: {
              user: response.user,
              token: accessToken,
              role: userRole,
            },
          });
          const targetRoute =
            userRole === "driver" ? "/(driver)/dashboard" : "/(customer)/home";
          router.replace(targetRoute);
          return;
        }

        router.push({
          pathname: "/(auth)/email-verification",
          params: {
            role,
            phone: phoneNumber,
            email: email.trim().toLowerCase(),
          },
        });
      } else {
        console.error("❌ Registration response indicates failure:", response);
        Alert.alert(
          "Registration Failed",
          response.error || "Something went wrong. Please try again.",
        );
      }
    } catch (error: any) {
      console.error("❌ Registration exception:", error);
      Alert.alert(
        "Registration Error",
        error.message || "Unable to complete registration. Please try again.",
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
      <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.header}>
        <Text style={styles.headerTitle}>Complete Your Profile</Text>
        <Text style={styles.headerSubtitle}>
          Register as a {role === "driver" ? "Driver" : "Customer"}
        </Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.formContainer}
        keyboardShouldPersistTaps='handled'
      >
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone Number *</Text>
          <View style={styles.phoneRow}>
            <Text style={styles.phonePrefix}>+251</Text>
            <TextInput
              style={styles.phoneInputField}
              placeholder='912345678'
              value={phoneNumber}
              onChangeText={(text) =>
                setPhoneNumber(text.replace(/[^0-9]/g, ""))
              }
              editable={!loading}
              keyboardType='number-pad'
              maxLength={9}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>First Name *</Text>
          <TextInput
            style={styles.input}
            placeholder='Enter your first name'
            value={firstName}
            onChangeText={setFirstName}
            editable={!loading}
            autoCapitalize='words'
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email *</Text>
          <TextInput
            style={styles.input}
            placeholder='your.email@example.com'
            value={email}
            onChangeText={setEmail}
            editable={!loading}
            keyboardType='email-address'
            autoCapitalize='none'
            autoCorrect={false}
          />
          <Text style={styles.hint}>
            We'll send a verification code to this email
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password *</Text>
          <TextInput
            style={styles.input}
            placeholder='At least 6 characters'
            value={password}
            onChangeText={setPassword}
            editable={!loading}
            secureTextEntry
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Confirm Password *</Text>
          <TextInput
            style={styles.input}
            placeholder='Re-enter your password'
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            editable={!loading}
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          style={[styles.registerButton, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          <LinearGradient
            colors={["#667eea", "#764ba2"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.registerButtonGradient}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} size='small' />
            ) : (
              <Text style={styles.registerButtonText}>Create Account</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.termsText}>
          By creating an account, you agree to our Terms of Service and Privacy
          Policy.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.white,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
  },
  formContainer: {
    padding: 24,
    paddingBottom: 40,
  },
  phoneDisplay: {
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  phoneLabel: {
    fontSize: 14,
    color: colors.gray600,
    marginBottom: 4,
  },
  phoneValue: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.gray900,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  phonePrefix: {
    fontSize: 16,
    color: colors.gray600,
    marginRight: 8,
    fontWeight: "600",
  },
  phoneInputField: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.gray900,
  },
  hint: {
    fontSize: 12,
    color: colors.gray500,
    marginTop: 6,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray700,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.gray900,
  },
  registerButton: {
    marginTop: 24,
    marginBottom: 20,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  registerButtonGradient: {
    paddingVertical: 16,
    alignItems: "center",
  },
  registerButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  backButton: {
    alignItems: "center",
    padding: 12,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "500",
  },
  termsText: {
    fontSize: 12,
    color: colors.gray500,
    textAlign: "center",
    marginTop: 24,
  },
});

export default RegisterScreen;
