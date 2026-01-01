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
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { colors } from "../../src/theme/colors";
import { authAPI } from "../../lib/api";
import { LinearGradient } from "expo-linear-gradient";
import { useAppState } from "../../src/context/AppStateContext";

const LoginScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Extract and validate params
  const phoneParam = params.phone;
  const roleParam = params.role;

  // Handle phone parameter - could be string or string[]
  const phone = Array.isArray(phoneParam)
    ? phoneParam[0] || ""
    : phoneParam || "";

  // Handle role parameter with type safety
  const role = (roleParam === "driver" ? "driver" : "customer") as
    | "customer"
    | "driver";

  const { dispatch } = useAppState();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    if (!password) {
      Alert.alert("Error", "Please enter your password");
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

      const response = await authAPI.login({
        phone: formattedPhone,
        password,
      });

      if (response.success) {
        const { user, tokens } = response;

        // Update app state
        dispatch({
          type: "LOGIN_SUCCESS",
          payload: {
            user,
            token: tokens.access_token,
            role: user.role,
          },
        });

        // Navigate based on role
        if (user.role === "driver") {
          if (!user.is_approved) {
            // Driver needs approval
            router.push({
              pathname: "/(driver)/pending" as any,
              params: { isPending: true } as any,
            });
          } else {
            router.push("/(driver)/dashboard" as any);
          }
        } else {
          // Customer
          router.push("/(customer)/home" as any);
        }
      } else {
        Alert.alert("Error", response.error || "Login failed");
      }
    } catch (error: any) {
      console.error("Login error:", error);
      Alert.alert("Error", error.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.prompt(
      "Forgot Password",
      "Enter your phone number to reset password:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send OTP",
          onPress: (value?: string) => {
            if (value) {
              // Use async function inside
              (async () => {
                try {
                  const response = await authAPI.forgotPassword(value);
                  if (response.success) {
                    Alert.alert("Success", "OTP sent to reset password", [
                      { text: "OK" },
                    ]);
                  }
                } catch (error: any) {
                  Alert.alert("Error", error.message || "Failed to send OTP");
                }
              })();
            }
          },
        },
      ],
      "plain-text",
      phone,
      "numeric"
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.header}>
        <Text style={styles.headerTitle}>Welcome Back</Text>
        <Text style={styles.headerSubtitle}>
          Login as {role === "driver" ? "driver" : "customer"}
        </Text>
      </LinearGradient>

      <View style={styles.formContainer}>
        <View style={styles.phoneDisplay}>
          <Text style={styles.phoneLabel}>Phone Number</Text>
          <Text style={styles.phoneValue}>+251 {phone}</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder='Enter your password'
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />
        </View>

        <TouchableOpacity
          style={styles.forgotPassword}
          onPress={handleForgotPassword}
          disabled={loading}
        >
          <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.loginButton, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <LinearGradient
            colors={["#667eea", "#764ba2"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.loginButtonGradient}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} size='small' />
            ) : (
              <Text style={styles.loginButtonText}>Login</Text>
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

        <TouchableOpacity
          style={styles.registerLink}
          onPress={() => {
            router.push({
              pathname: "/(auth)/register" as any,
              params: { phone, role } as any,
            });
          }}
          disabled={loading}
        >
          <Text style={styles.registerText}>
            Don't have an account?{" "}
            <Text style={styles.registerLinkText}>Register</Text>
          </Text>
        </TouchableOpacity>
      </View>
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
    marginTop: 20,
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
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "500",
  },
  loginButton: {
    marginBottom: 20,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  loginButtonGradient: {
    paddingVertical: 16,
    alignItems: "center",
  },
  loginButtonText: {
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
    marginBottom: 20,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "500",
  },
  registerLink: {
    alignItems: "center",
  },
  registerText: {
    color: colors.gray600,
    fontSize: 14,
  },
  registerLinkText: {
    color: colors.primary,
    fontWeight: "600",
  },
});

export default LoginScreen;
