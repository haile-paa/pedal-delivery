// NOTE: This screen is superseded by the phone+password Sign In flow now
// built into WelcomeScreen.tsx (see /(auth)/welcome). It's no longer linked
// to from anywhere in the app (both callers now redirect to /(auth)/welcome
// instead) and has known bugs (authAPI.forgotPassword doesn't exist,
// user.is_approved isn't a real field on User) — kept here rather than
// deleted, but not recommended for active use.
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
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/context/ThemeContext";
import { useLanguage } from "../../src/context/LanguageContext";
import { authAPI } from "../../lib/api";
import { LinearGradient } from "expo-linear-gradient";
import { useAppState } from "../../src/context/AppStateContext";
import { API_BASE_URL } from "../../src/utils/constants";

const LoginScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const styles = getStyles(colors, isDark);

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
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!password) {
      Alert.alert(t("errorTitle"), t("enterPasswordPrompt"));
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

      if (response.success && response.user && response.tokens) {
        const { user, tokens } = response;
        const accessToken = tokens.accessToken || tokens.access_token;

        if (!accessToken) {
          Alert.alert(t("errorTitle"), t("loginNoTokenError"));
          return;
        }

        // Update app state — this screen only supports customer/driver
        // (matches the rest of the mobile app's role scope; admins sign in
        // through the admin site instead).
        const userRole = user.role === "driver" ? "driver" : "customer";

        dispatch({
          type: "LOGIN_SUCCESS",
          payload: {
            user,
            token: accessToken,
            role: userRole,
          },
        });

        // Navigate based on role
        if (userRole === "driver") {
          router.push("/(driver)/dashboard" as any);
        } else {
          router.push("/(customer)/home" as any);
        }
      } else {
        Alert.alert(t("errorTitle"), response.error || t("loginFailed"));
      }
    } catch (error: any) {
      console.error("Login error:", error);
      Alert.alert(t("errorTitle"), error.message || t("loginFailedRetry"));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.prompt(
      t("forgotPasswordTitle"),
      t("forgotPasswordPrompt"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("sendOtp"),
          onPress: (value?: string) => {
            if (value) {
              (async () => {
                try {
                  const res = await fetch(
                    `${API_BASE_URL}/auth/forgot-password`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ email: value }),
                    },
                  );
                  const data = await res.json();
                  if (res.ok) {
                    Alert.alert(t("successTitle"), t("resetCodeSent"));
                  } else {
                    Alert.alert(
                      t("errorTitle"),
                      data.error || t("resetCodeFailed"),
                    );
                  }
                } catch (error: any) {
                  Alert.alert(t("errorTitle"), t("serverErrorRetry"));
                }
              })();
            }
          },
        },
      ],
      "plain-text",
      "",
      "email-address",
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.header}>
        <Text style={styles.headerTitle}>{t("welcomeBack")}</Text>
        <Text style={styles.headerSubtitle}>
          {t("loginAs")} {role === "driver" ? t("driverLabel") : t("customerLabel")}
        </Text>
      </LinearGradient>

      <View style={styles.formContainer}>
        <View style={styles.phoneDisplay}>
          <Text style={styles.phoneLabel}>{t("phoneNumber")}</Text>
          <Text style={styles.phoneValue}>+251 {phone}</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t("passwordLabel")}</Text>
          <View style={styles.passwordWrapper}>
            <TextInput
              style={styles.passwordInput}
              placeholder={t("enterPasswordPlaceholder")}
              placeholderTextColor={colors.gray400}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              editable={!loading}
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
        </View>

        <TouchableOpacity
          style={styles.forgotPassword}
          onPress={handleForgotPassword}
          disabled={loading}
        >
          <Text style={styles.forgotPasswordText}>{t("forgotPasswordLink")}</Text>
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
              <ActivityIndicator color="#FFFFFF" size='small' />
            ) : (
              <Text style={styles.loginButtonText}>{t("loginButton")}</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={styles.backButtonText}>← {t("back")}</Text>
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
            {t("noAccountPrompt")}{" "}
            <Text style={styles.registerLinkText}>{t("registerLink")}</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const getStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
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
      // Sits on a fixed purple gradient in both themes, so this stays a
      // literal white rather than following colors.white (which inverts
      // to a dark shade in dark mode).
      color: "#FFFFFF",
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
      backgroundColor: colors.card,
      padding: 16,
      borderRadius: 12,
      marginBottom: 24,
      borderWidth: isDark ? 1 : 0,
      borderColor: "rgba(255,255,255,0.08)",
      shadowColor: isDark ? colors.primaryGlow : colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.2 : 0.1,
      shadowRadius: isDark ? 10 : 8,
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
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.gray300,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      color: colors.gray900,
    },
    passwordWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.gray300,
      borderRadius: 12,
      paddingHorizontal: 16,
    },
    passwordInput: {
      flex: 1,
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
      shadowOpacity: isDark ? 0.45 : 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    loginButtonGradient: {
      paddingVertical: 16,
      alignItems: "center",
    },
    loginButtonText: {
      color: "#FFFFFF",
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
