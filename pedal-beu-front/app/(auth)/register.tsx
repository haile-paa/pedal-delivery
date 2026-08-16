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
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/context/ThemeContext";
import { useLanguage } from "../../src/context/LanguageContext";
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
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const styles = getStyles(colors, isDark);

  const role = params.role || "customer";

  const [firstName, setFirstName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState(params.phone || "");
  const [email, setEmail] = useState(params.email || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
      Alert.alert(t("errorTitle"), t("enterFirstNamePrompt"));
      return;
    }

    if (!phoneNumber.trim() || !validatePhoneNumber(phoneNumber)) {
      Alert.alert(t("errorTitle"), t("invalidPhonePrompt"));
      return;
    }

    if (!email.trim() || !validateEmail(email)) {
      Alert.alert(t("errorTitle"), t("invalidEmailPrompt"));
      return;
    }

    if (!password.trim() || password.length < 6) {
      Alert.alert(t("errorTitle"), t("passwordLengthPrompt"));
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t("errorTitle"), t("passwordsMismatch"));
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
          t("registrationFailedTitle"),
          response.error || t("somethingWentWrongRetry"),
        );
      }
    } catch (error: any) {
      console.error("❌ Registration exception:", error);
      Alert.alert(
        t("registrationErrorTitle"),
        error.message || t("registrationErrorDesc"),
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
        <Text style={styles.headerTitle}>{t("completeYourProfile")}</Text>
        <Text style={styles.headerSubtitle}>
          {t("registerAs")} {role === "driver" ? t("driverRole") : t("customerRole")}
        </Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.formContainer}
        keyboardShouldPersistTaps='handled'
      >
        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t("phoneNumberRequired")}</Text>
          <View style={styles.phoneRow}>
            <Text style={styles.phonePrefix}>+251</Text>
            <TextInput
              style={styles.phoneInputField}
              placeholder='912345678'
              placeholderTextColor={colors.gray400}
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
          <Text style={styles.label}>{t("firstNameRequired")}</Text>
          <TextInput
            style={styles.input}
            placeholder={t("firstNamePlaceholder")}
            placeholderTextColor={colors.gray400}
            value={firstName}
            onChangeText={setFirstName}
            editable={!loading}
            autoCapitalize='words'
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t("emailRequired")}</Text>
          <TextInput
            style={styles.input}
            placeholder='your.email@example.com'
            placeholderTextColor={colors.gray400}
            value={email}
            onChangeText={setEmail}
            editable={!loading}
            keyboardType='email-address'
            autoCapitalize='none'
            autoCorrect={false}
          />
          <Text style={styles.hint}>{t("emailVerificationHint")}</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t("passwordRequired")}</Text>
          <View style={styles.passwordWrapper}>
            <TextInput
              style={styles.passwordInput}
              placeholder={t("atLeast6Chars")}
              placeholderTextColor={colors.gray400}
              value={password}
              onChangeText={setPassword}
              editable={!loading}
              secureTextEntry={!showPassword}
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

        <View style={styles.inputGroup}>
          <Text style={styles.label}>{t("confirmPasswordRequired")}</Text>
          <View style={styles.passwordWrapper}>
            <TextInput
              style={styles.passwordInput}
              placeholder={t("reenterPasswordPlaceholder")}
              placeholderTextColor={colors.gray400}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              editable={!loading}
              secureTextEntry={!showConfirmPassword}
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword((prev) => !prev)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                size={22}
                color={colors.gray500}
              />
            </TouchableOpacity>
          </View>
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
              <ActivityIndicator color="#FFFFFF" size='small' />
            ) : (
              <Text style={styles.registerButtonText}>{t("createAccount")}</Text>
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

        <Text style={styles.termsText}>{t("termsAgreement")}</Text>
      </ScrollView>
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
      // Fixed purple gradient background in both themes — stays literal
      // white rather than colors.white, which inverts in dark mode.
      color: "#FFFFFF",
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
    phoneRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
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
    registerButton: {
      marginTop: 24,
      marginBottom: 20,
      borderRadius: 12,
      overflow: "hidden",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.45 : 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    registerButtonGradient: {
      paddingVertical: 16,
      alignItems: "center",
    },
    registerButtonText: {
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
