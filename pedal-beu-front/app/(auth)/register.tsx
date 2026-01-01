import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { colors } from "../../src/theme/colors";
import { authAPI } from "../../lib/api";
import { LinearGradient } from "expo-linear-gradient";
import type { RegisterRequest } from "../../src/types"; // Import the type

const RegisterScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { phone, role = "customer" } = params as {
    phone: string;
    role: "customer" | "driver";
  };

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: "", // Changed to snake_case to match API
    email: "",
  });

  // Generate a random password for drivers
  const [generatedPassword, setGeneratedPassword] = useState("");

  useEffect(() => {
    if (role === "driver") {
      // Generate a secure random password for drivers
      const randomPassword = generateSecurePassword();
      setGeneratedPassword(randomPassword);
    }
  }, [role]);

  const generateSecurePassword = () => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleRegister = async () => {
    // Validation
    if (!formData.first_name.trim()) {
      Alert.alert("Error", "Please enter your first name");
      return;
    }

    setLoading(true);
    try {
      // Format phone for backend
      let formattedPhone = phone;
      if (phone.startsWith("9")) {
        formattedPhone = `+251${phone}`;
      } else if (phone.startsWith("0")) {
        formattedPhone = `+251${phone.substring(1)}`;
      }

      // For drivers, use generated password
      // For customers, they'll use OTP only (no password needed for login)
      const password = role === "driver" ? generatedPassword : "otp_only_auth";

      // Create register data matching the RegisterRequest type
      const registerData: RegisterRequest = {
        phone: formattedPhone,
        email: formData.email || undefined,
        first_name: formData.first_name, // Use snake_case
        password: password,
        role: role,
      };

      const response = await authAPI.register(registerData);

      if (response.success) {
        Alert.alert("Success", "Registration successful!", [
          {
            text: "OK",
            onPress: () => {
              // Navigate based on role
              if (role === "driver") {
                router.push({
                  pathname: "/(driver)/dashboard" as any,
                  params: {
                    phone: formattedPhone,
                    role,
                  },
                });
              } else {
                router.push({
                  pathname: "/(customer)/home" as any,
                  params: {
                    phone: formattedPhone,
                    role,
                  },
                });
              }
            },
          },
        ]);
      } else {
        Alert.alert("Error", response.error || "Registration failed");
      }
    } catch (error: any) {
      console.error("Registration error:", error);
      Alert.alert(
        "Error",
        error.message || "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={["#667eea", "#764ba2"]}
          style={styles.headerGradient}
        >
          <Text style={styles.headerTitle}>Create Account</Text>
          <Text style={styles.headerSubtitle}>
            Register as a {role === "driver" ? "driver" : "customer"}
          </Text>
          {role === "driver" && (
            <Text style={styles.driverNote}>
              🚗 Password will be auto-generated for driver account
            </Text>
          )}
        </LinearGradient>

        <View style={styles.formContainer}>
          <View style={styles.phoneDisplay}>
            <Text style={styles.phoneLabel}>Phone Number</Text>
            <Text style={styles.phoneValue}>+251 {phone}</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>First Name *</Text>
            <TextInput
              style={styles.input}
              placeholder='Enter your first name'
              value={formData.first_name}
              onChangeText={(text) => updateFormData("first_name", text)}
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder='Enter your email'
              value={formData.email}
              onChangeText={(text) => updateFormData("email", text)}
              keyboardType='email-address'
              autoCapitalize='none'
              editable={!loading}
            />
          </View>

          {role === "driver" && (
            <View style={styles.passwordInfo}>
              <Text style={styles.passwordLabel}>Auto-generated Password:</Text>
              <Text style={styles.passwordValue}>{generatedPassword}</Text>
              <Text style={styles.passwordHint}>
                This password is automatically generated. You'll use OTP for
                login.
              </Text>
            </View>
          )}

          <View style={styles.noteContainer}>
            <Text style={styles.noteText}>
              <Text style={styles.noteBold}>Note:</Text> You'll use OTP
              verification to login. No password needed for customers.
            </Text>
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
  },
  headerGradient: {
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
    marginBottom: 4,
  },
  driverNote: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
    fontStyle: "italic",
    marginTop: 8,
  },
  formContainer: {
    padding: 24,
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
  passwordInfo: {
    backgroundColor: colors.gray50,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  passwordLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray700,
    marginBottom: 4,
  },
  passwordValue: {
    fontSize: 16,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: colors.primary,
    marginBottom: 8,
  },
  passwordHint: {
    fontSize: 12,
    color: colors.gray600,
    fontStyle: "italic",
  },
  noteContainer: {
    backgroundColor: colors.primary + "10",
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  noteText: {
    fontSize: 14,
    color: colors.gray700,
    lineHeight: 20,
  },
  noteBold: {
    fontWeight: "bold",
    color: colors.primary,
  },
  registerButton: {
    marginTop: 10,
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
});

export default RegisterScreen;
