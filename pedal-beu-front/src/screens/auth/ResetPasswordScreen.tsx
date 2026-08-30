import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../context/ThemeContext";
import { authAPI } from "../../../lib/api";

// Step 2 of "Forgot password?": enter the OTP that was emailed (see
// ForgotPasswordScreen) plus a new password. Shared by both customers and
// drivers, same reasoning as ForgotPasswordScreen — no role branching
// needed since it's the same backend endpoint and User record either way.
//
// On success this goes back to Sign In with router.replace (not push) so
// the person can't swipe/back-button their way back into this OTP screen
// after their password has already been changed.
const ResetPasswordScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const router = useRouter();
  const params = useLocalSearchParams();
  const { email } = params as { email: string };

  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  // Same double-submit guard as ForgotPasswordScreen/WelcomeScreen — the
  // confirm-password field's onSubmitEditing and the button's onPress
  // both call this.
  const isResettingRef = React.useRef(false);

  const handleReset = async () => {
    if (isResettingRef.current) {
      return;
    }

    Keyboard.dismiss();

    if (!otp.trim() || otp.trim().length !== 6) {
      Alert.alert("Error", "Please enter the 6-digit code from your email");
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    isResettingRef.current = true;
    setLoading(true);

    try {
      const result = await authAPI.resetPassword(
        email,
        otp.trim(),
        newPassword,
      );

      if (result.success) {
        Alert.alert(
          "Password Reset",
          "Your password has been reset. Please sign in with your new password.",
          [
            {
              text: "OK",
              onPress: () => router.replace("/(auth)/welcome"),
            },
          ],
        );
      } else {
        Alert.alert("Error", result.error || "Failed to reset password");
      }
    } catch (err) {
      Alert.alert("Error", "Server error. Please try again.");
    } finally {
      setLoading(false);
      isResettingRef.current = false;
    }
  };

  const handleResend = async () => {
    if (!email) return;
    const result = await authAPI.forgotPassword(email);
    if (result.success) {
      Alert.alert("Code Sent", "A new code has been sent to your email.");
    } else {
      Alert.alert("Error", result.error || "Failed to resend code");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name='arrow-back' size={22} color={colors.gray800} />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name='key-outline' size={32} color={colors.primary} />
        </View>

        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code sent to{" "}
          <Text style={styles.emailText}>{email}</Text> and choose a new
          password.
        </Text>

        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder='6-digit code'
            placeholderTextColor={colors.gray400}
            value={otp}
            onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, ""))}
            keyboardType='number-pad'
            maxLength={6}
            editable={!loading}
            returnKeyType='next'
          />
        </View>

        <View style={styles.inputWrapper}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder='New password'
            placeholderTextColor={colors.gray400}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showPassword}
            editable={!loading}
            returnKeyType='next'
          />
        </View>

        <View style={styles.inputWrapperRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder='Confirm new password'
            placeholderTextColor={colors.gray400}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showPassword}
            editable={!loading}
            returnKeyType='done'
            onSubmitEditing={handleReset}
          />
          <TouchableOpacity
            onPress={() => setShowPassword((prev) => !prev)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={22}
              color={colors.gray500}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            (!otp.trim() || !newPassword || !confirmPassword || loading) &&
              styles.buttonDisabled,
          ]}
          onPress={handleReset}
          disabled={!otp.trim() || !newPassword || !confirmPassword || loading}
        >
          <LinearGradient
            colors={["#667eea", "#764ba2"]}
            style={styles.buttonGradient}
          >
            {loading ? (
              <ActivityIndicator color='#fff' />
            ) : (
              <Text style={styles.buttonText}>Reset Password</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={handleResend}
          disabled={loading}
        >
          <Text style={styles.linkText}>Didn't get a code? Resend</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const getStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    backButton: {
      position: "absolute",
      top: 60,
      left: 24,
      zIndex: 10,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.white,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    content: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    iconCircle: {
      alignSelf: "center",
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.gray50,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 24,
    },
    title: {
      fontSize: 26,
      fontWeight: "800",
      color: colors.gray900,
      textAlign: "center",
      marginBottom: 12,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 14,
      color: colors.gray600,
      textAlign: "center",
      lineHeight: 20,
      marginBottom: 32,
      paddingHorizontal: 8,
    },
    emailText: {
      fontWeight: "700",
      color: colors.gray800,
    },
    inputWrapper: {
      backgroundColor: colors.white,
      borderRadius: 16,
      paddingHorizontal: 16,
      height: 56,
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.gray200,
      marginBottom: 16,
    },
    inputWrapperRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.white,
      borderRadius: 16,
      paddingHorizontal: 16,
      height: 56,
      borderWidth: 1,
      borderColor: colors.gray200,
      marginBottom: 24,
    },
    input: {
      fontSize: 16,
      color: colors.gray900,
      padding: 0,
      margin: 0,
    },
    button: {
      borderRadius: 16,
      overflow: "hidden",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 8,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonGradient: {
      height: 56,
      justifyContent: "center",
      alignItems: "center",
    },
    buttonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "700",
    },
    linkButton: {
      marginTop: 20,
      alignItems: "center",
    },
    linkText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "600",
    },
  });

export default ResetPasswordScreen;
