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
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../context/ThemeContext";
import { authAPI } from "../../../lib/api";

// Step 1 of "Forgot password?": the person enters their account email and
// gets a 6-digit OTP sent to it. Shared by both customers and drivers —
// both sign in from the same WelcomeScreen and both are User records with
// an email on the same backend (see ForgotPasswordByEmail), so there's no
// role branching needed here at all.
//
// Deliberately kept free of Reanimated/looping animations — WelcomeScreen
// in this app has a documented history of Android Fabric crashes
// ("addViewAt: ... already has a parent") tied to animated views racing a
// navigation transition. A plain, static form is the safer choice for an
// auth-flow screen that navigates away as soon as it succeeds.
const ForgotPasswordScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  // Guards against handleSendCode firing twice at once — same class of bug
  // (and same fix) as the double-submit crash fixed in WelcomeScreen's
  // handleSignIn: onSubmitEditing (keyboard "done") and the button's
  // onPress both call this, and nothing else stopped both from landing in
  // the same instant.
  const isSendingRef = React.useRef(false);

  const validateEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value.trim());

  const handleSendCode = async () => {
    if (isSendingRef.current) {
      return;
    }

    Keyboard.dismiss();

    if (!email.trim()) {
      Alert.alert("Error", "Please enter your email address");
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    isSendingRef.current = true;
    setLoading(true);

    try {
      const result = await authAPI.forgotPassword(email.trim());

      if (result.success) {
        router.push({
          pathname: "/(auth)/reset-password",
          params: { email: email.trim() },
        });
      } else {
        Alert.alert("Error", result.error || "Failed to send reset code");
      }
    } catch (err) {
      Alert.alert("Error", "Server error. Please try again.");
    } finally {
      setLoading(false);
      isSendingRef.current = false;
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
          <Ionicons name='lock-closed-outline' size={32} color={colors.primary} />
        </View>

        <Text style={styles.title}>Forgot Password?</Text>
        <Text style={styles.subtitle}>
          Enter the email address on your account and we'll send you a
          6-digit code to reset your password.
        </Text>

        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder='you@example.com'
            placeholderTextColor={colors.gray400}
            value={email}
            onChangeText={setEmail}
            keyboardType='email-address'
            autoCapitalize='none'
            autoCorrect={false}
            editable={!loading}
            returnKeyType='send'
            onSubmitEditing={handleSendCode}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, (!email.trim() || loading) && styles.buttonDisabled]}
          onPress={handleSendCode}
          disabled={!email.trim() || loading}
        >
          <LinearGradient
            colors={["#667eea", "#764ba2"]}
            style={styles.buttonGradient}
          >
            {loading ? (
              <ActivityIndicator color='#fff' />
            ) : (
              <Text style={styles.buttonText}>Send Reset Code</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={styles.linkText}>Back to Sign In</Text>
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
    inputWrapper: {
      backgroundColor: colors.white,
      borderRadius: 16,
      paddingHorizontal: 16,
      height: 60,
      justifyContent: "center",
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

export default ForgotPasswordScreen;
