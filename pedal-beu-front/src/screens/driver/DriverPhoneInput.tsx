import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { colors } from "../../theme/colors";
import { authAPI } from "../../../lib/api";

const DriverPhoneInput: React.FC = () => {
  const router = useRouter();
  const [login, setLogin] = useState(""); // username OR phone number
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!login.trim()) {
      Alert.alert(
        "Missing Field",
        "Please enter your username or phone number.",
      );
      return;
    }
    if (!password) {
      Alert.alert("Missing Field", "Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      const result = await authAPI.driverLogin({
        login: login.trim(),
        password,
      });

      if (result.success && result.user && result.tokens) {
        router.replace("/(driver)/dashboard");
      } else {
        Alert.alert("Login Failed", result.error || "Invalid credentials.");
      }
    } catch (error: any) {
      Alert.alert(
        "Error",
        error?.message || "Something went wrong. Please try again.",
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
          <Text style={styles.title}>Driver Login</Text>
          <Text style={styles.subtitle}>
            Log in with the credentials provided by your manager.
          </Text>
        </View>

        <View style={styles.formContainer}>
          {/* Username or Phone */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Username or Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder='Enter username or phone (e.g. +251912345678)'
              placeholderTextColor={colors.gray400}
              autoCapitalize='none'
              autoCorrect={false}
              keyboardType='default'
              value={login}
              onChangeText={setLogin}
              editable={!loading}
            />
          </View>

          {/* Password */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.passwordInput}
                placeholder='Enter your password'
                placeholderTextColor={colors.gray400}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword((v) => !v)}
              >
                <Text style={styles.eyeText}>{showPassword ? "🙈" : "👁️"}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.loginButton,
              (!login.trim() || !password || loading) &&
                styles.loginButtonDisabled,
            ]}
            onPress={handleLogin}
            disabled={!login.trim() || !password || loading}
          >
            <Text style={styles.loginButtonText}>
              {loading ? "Logging in..." : "Log In"}
            </Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            Don't have credentials? Contact your manager to get set up.
          </Text>
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
  fieldContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.gray800,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: colors.gray300,
    fontSize: 16,
    color: colors.gray900,
  },
  passwordWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: colors.gray300,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    color: colors.gray900,
    height: "100%",
  },
  eyeButton: {
    padding: 4,
  },
  eyeText: {
    fontSize: 18,
  },
  loginButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  hint: {
    marginTop: 20,
    fontSize: 14,
    color: colors.gray500,
    textAlign: "center",
    lineHeight: 20,
  },
});

export default DriverPhoneInput;
