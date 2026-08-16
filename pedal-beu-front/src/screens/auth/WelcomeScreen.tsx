import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar,
  Image,
  TouchableOpacity,
  TextInput,
  Alert,
  Keyboard,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  interpolate,
  withRepeat,
  Easing,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../context/ThemeContext";
import AnimatedButton from "../../components/ui/AnimatedButton";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppState } from "../../context/AppStateContext";
import { API_BASE_URL } from "../../utils/constants";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const WelcomeScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);
  const router = useRouter();
  const { dispatch } = useAppState();
  const [showPhoneScreen, setShowPhoneScreen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState(""); // used for the phone+password Sign In flow
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState(""); // kept for the old email+phone-first flow — see below (commented out)
  const [loading, setLoading] = useState(false);

  const handlePhoneNumberChange = useCallback((text: string) => {
    const cleaned = text.replace(/[^0-9]/g, "");
    setPhoneNumber(cleaned);
  }, []);

  const handleEmailChange = useCallback((text: string) => {
    setEmail(text.trim());
  }, []);

  // Animation values for welcome screen
  const logoScale = useSharedValue(0.5);
  const logoOpacity = useSharedValue(0);
  const textSlide = useSharedValue(50);
  const pulseAnim = useSharedValue(0);

  React.useEffect(() => {
    logoScale.value = withDelay(
      300,
      withSpring(1, { damping: 12, stiffness: 100 }),
    );
    logoOpacity.value = withDelay(300, withTiming(1, { duration: 800 }));
    textSlide.value = withDelay(
      500,
      withSpring(0, { damping: 15, stiffness: 100 }),
    );

    pulseAnim.value = withDelay(
      1000,
      withRepeat(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, []);

  const goToPhoneScreen = () => {
    setShowPhoneScreen(true);
  };

  const goBackToWelcome = () => {
    Keyboard.dismiss();
    setShowPhoneScreen(false);
  };

  const validatePhoneNumber = (phone: string): boolean => {
    const cleaned = phone.replace(/\D/g, "");
    return cleaned.length === 9;
  };

  const validateEmail = (value: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  };

  // ✅ Function to request location permission (runs in background)
  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        console.log("Location permission granted");
      } else {
        console.log("Location permission denied");
      }
    } catch (error) {
      console.warn("Error requesting location permission:", error);
    }
  };

  const handleSignIn = async () => {
    Keyboard.dismiss();

    if (!phoneNumber.trim()) {
      Alert.alert("Error", "Please enter your phone number");
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      Alert.alert("Error", "Enter valid 9-digit number like 912345678");
      return;
    }

    if (!password.trim()) {
      Alert.alert("Error", "Please enter your password");
      return;
    }

    setLoading(true);

    try {
      let normalizedPhone = phoneNumber.trim();
      if (normalizedPhone.startsWith("9")) {
        normalizedPhone = `+251${normalizedPhone}`;
      } else if (normalizedPhone.startsWith("0")) {
        normalizedPhone = `+251${normalizedPhone.substring(1)}`;
      }

      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalizedPhone,
          password,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        const { accessToken, refreshToken } = data.tokens || {};

        if (!accessToken) {
          Alert.alert("Error", "Sign in failed. Please try again.");
          return;
        }

        await AsyncStorage.setItem("accessToken", accessToken);
        if (refreshToken) {
          await AsyncStorage.setItem("refreshToken", refreshToken);
        }
        await AsyncStorage.setItem("user", JSON.stringify(data.user));

        dispatch({
          type: "LOGIN_SUCCESS",
          payload: {
            user: data.user,
            token: accessToken,
            role: data.user.role,
          },
        });

        requestLocationPermission();

        if (data.user.role === "driver") {
          router.replace("/(driver)/dashboard");
        } else {
          router.replace("/(customer)/home");
        }
      } else {
        Alert.alert("Error", data.error || "Invalid phone number or password");
      }
    } catch (err) {
      Alert.alert("Error", "Server error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const goToRegister = () => {
    Keyboard.dismiss();
    router.push({
      pathname: "/(auth)/register",
      params: { role: "customer" },
    });
  };

  const goToDriverForm = () => {
    Keyboard.dismiss();
    router.push({
      pathname: "/(auth)/driver-form",
      params: {},
    });
  };

  // OLD FLOW (commented out — replaced by the phone+password Sign In above,
  // plus a direct link to the register screen for new users). Kept for
  // reference/revert rather than deleted.
  //
  // const handleContinueAsCustomer = async () => {
  //   Keyboard.dismiss();
  //   if (!phoneNumber.trim()) {
  //     Alert.alert("Error", "Please enter your phone number");
  //     return;
  //   }
  //   if (!validatePhoneNumber(phoneNumber)) {
  //     Alert.alert("Error", "Enter valid 9-digit number like 912345678");
  //     return;
  //   }
  //   if (!email.trim()) {
  //     Alert.alert("Error", "Please enter your email address");
  //     return;
  //   }
  //   if (!validateEmail(email)) {
  //     Alert.alert("Error", "Enter a valid email address");
  //     return;
  //   }
  //   setLoading(true);
  //   try {
  //     const res = await fetch(
  //       `${API_BASE_URL}/auth/send-otp`,
  //       {
  //         method: "POST",
  //         headers: { "Content-Type": "application/json" },
  //         body: JSON.stringify({
  //           email: email.trim().toLowerCase(),
  //           role: "customer",
  //         }),
  //       },
  //     );
  //     const data = await res.json();
  //     if (res.ok) {
  //       requestLocationPermission();
  //       router.push({
  //         pathname: "/(auth)/email-verification",
  //         params: {
  //           role: "customer",
  //           phone: phoneNumber,
  //           email: email.trim().toLowerCase(),
  //         },
  //       });
  //     } else {
  //       Alert.alert("Error", data.message || "Failed to send OTP");
  //     }
  //   } catch (err) {
  //     Alert.alert("Error", "Server error. Try again.");
  //   } finally {
  //     setLoading(false);
  //   }
  // };
  //
  // const handleDriverButton = async () => {
  //   if (!phoneNumber.trim()) {
  //     Alert.alert("Error", "Please enter your phone number first");
  //     return;
  //   }
  //   if (!validatePhoneNumber(phoneNumber)) {
  //     Alert.alert("Error", "Enter valid 9-digit number like 912345678");
  //     return;
  //   }
  //   if (!email.trim()) {
  //     Alert.alert("Error", "Please enter your email address first");
  //     return;
  //   }
  //   if (!validateEmail(email)) {
  //     Alert.alert("Error", "Enter a valid email address");
  //     return;
  //   }
  //   setLoading(true);
  //   try {
  //     const res = await fetch(
  //       `${API_BASE_URL}/auth/send-otp`,
  //       {
  //         method: "POST",
  //         headers: { "Content-Type": "application/json" },
  //         body: JSON.stringify({
  //           email: email.trim().toLowerCase(),
  //           role: "driver",
  //         }),
  //       },
  //     );
  //     const data = await res.json();
  //     if (res.ok) {
  //       router.push({
  //         pathname: "/(auth)/email-verification",
  //         params: {
  //           role: "driver",
  //           phone: phoneNumber,
  //           email: email.trim().toLowerCase(),
  //         },
  //       });
  //     } else {
  //       if (data.error && data.error.includes("not registered")) {
  //         router.push({
  //           pathname: "/(auth)/driver-form",
  //           params: { phone: phoneNumber, email: email.trim().toLowerCase() },
  //         });
  //       } else {
  //         Alert.alert("Error", data.message || "Failed to send OTP");
  //       }
  //     }
  //   } catch (err) {
  //     router.push({
  //       pathname: "/(auth)/driver-form",
  //       params: { phone: phoneNumber, email: email.trim().toLowerCase() },
  //     });
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  // Animated styles
  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ translateY: textSlide.value }],
  }));

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulseAnim.value, [0, 1], [0.1, 0.3]),
    transform: [{ scale: 1 + pulseAnim.value * 0.2 }],
  }));

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={showPhoneScreen ? "dark-content" : "light-content"}
        backgroundColor={showPhoneScreen ? "#f8fafc" : "#667eea"}
      />

      {showPhoneScreen ? (
        <View style={[styles.screen, styles.screen2]}>
          <LinearGradient
            colors={["#f8fafc", "#e2e8f0"]}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.screen2Content}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={goBackToWelcome}
            >
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>

            <View style={styles.titleContainer}>
              <Text style={styles.phoneTitle}>Welcome Back</Text>
              <Text style={styles.phoneSubtitle}>
                Sign in with your phone number and password
              </Text>
            </View>

            <View style={styles.phoneInputContainer}>
              <View style={styles.phoneInputWrapper}>
                <View style={styles.countryCodeContainer}>
                  <Text style={styles.countryCodeText}>+251</Text>
                </View>

                <TextInput
                  style={styles.phoneInput}
                  placeholder='912345678'
                  placeholderTextColor={colors.gray400}
                  value={phoneNumber}
                  onChangeText={handlePhoneNumberChange}
                  keyboardType='number-pad'
                  maxLength={9}
                  autoFocus={true}
                  editable={!loading}
                  returnKeyType='next'
                  clearButtonMode='while-editing'
                  keyboardAppearance='light'
                />
              </View>
            </View>

            <View style={styles.phoneInputContainer}>
              <View style={styles.phoneInputWrapper}>
                <TextInput
                  style={[styles.phoneInput, { flex: 1 }]}
                  placeholder='Password'
                  placeholderTextColor={colors.gray400}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                  returnKeyType='done'
                  keyboardAppearance='light'
                  onBlur={() => Keyboard.dismiss()}
                  onSubmitEditing={handleSignIn}
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

            <View style={styles.nextButtonContainer}>
              <TouchableOpacity
                style={[
                  styles.signInButton,
                  (!validatePhoneNumber(phoneNumber) ||
                    !password.trim() ||
                    loading) &&
                    styles.nextButtonDisabled,
                ]}
                onPress={handleSignIn}
                disabled={
                  !validatePhoneNumber(phoneNumber) ||
                  !password.trim() ||
                  loading
                }
              >
                <LinearGradient
                  colors={["#667eea", "#764ba2"]}
                  style={[
                    styles.signInButtonGradient,
                    loading && styles.buttonDisabled,
                  ]}
                >
                  <Text style={styles.signInButtonText}>
                    {loading ? "Signing in..." : "Sign In"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.createAccountButton}
              onPress={goToRegister}
              disabled={loading}
            >
              <Text style={styles.createAccountButtonText}>
                Create New Account
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={[styles.screen, styles.screen1]}>
          <LinearGradient
            colors={["#667eea", "#764ba2"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.screenContent}>
            <Animated.View style={[styles.pulseCircle, pulseAnimatedStyle]} />
            <Animated.View
              style={[
                styles.pulseCircle,
                pulseAnimatedStyle,
                { width: 320, height: 320 },
              ]}
            />
            <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
              <Image
                source={require("../../../assets/images/logo-nobg.png")}
                style={styles.logoImage}
                resizeMode='contain'
              />
            </Animated.View>

            <Animated.View style={[styles.textContainer, textAnimatedStyle]} />

            <View style={styles.buttonContainer}>
              <AnimatedButton
                title='Get Started'
                onPress={goToPhoneScreen}
                variant='primary'
                style={styles.nextButton}
                fullWidth
              />
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

// Styles remain exactly the same as before
const getStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    screen: {
      width: screenWidth,
      height: screenHeight,
      flex: 1,
    },
    screen1: {
      justifyContent: "center",
      alignItems: "center",
    },
    screen2: {
      flex: 1,
    },
    screenContent: {
      flex: 1,
      width: "100%",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    },
    screen2Content: {
      flex: 1,
      paddingHorizontal: 24,
      paddingTop: 80,
      paddingBottom: 40,
    },
    logoContainer: {
      alignItems: "center",
      marginBottom: -10,
    },
    logoImage: {
      width: 350,
      height: 350,
    },
    pulseCircle: {
      position: "absolute",
      width: 280,
      height: 280,
      borderRadius: 140,
      borderWidth: 2,
      borderColor: "rgba(255, 255, 255, 0.3)",
    },
    textContainer: {
      alignItems: "center",
      marginBottom: 60,
    },
    buttonContainer: {
      width: "100%",
      alignItems: "center",
      position: "absolute",
      bottom: 60,
    },
    nextButton: {
      marginBottom: 16,
    },
    backButton: {
      position: "absolute",
      top: 60,
      left: 24,
      zIndex: 10,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(255, 255, 255, 0.9)",
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    backButtonText: {
      fontSize: 24,
      color: colors.gray800,
    },
    driverTopButtonContainer: {
      alignSelf: "center",
      marginTop: 20,
      marginBottom: 40,
      width: "100%",
      maxWidth: 350,
    },
    driverTopButton: {
      borderRadius: 20,
      overflow: "hidden",
      shadowColor: "#FF6B6B",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    driverTopButtonGradient: {
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderRadius: 20,
      alignItems: "center",
    },
    driverTopButtonText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: "700",
    },
    titleContainer: {
      alignItems: "center",
      marginBottom: 40,
    },
    phoneTitle: {
      fontSize: 28,
      fontWeight: "800",
      color: colors.gray900,
      textAlign: "center",
      marginBottom: 12,
      letterSpacing: -0.5,
    },
    phoneSubtitle: {
      fontSize: 14,
      color: colors.gray600,
      textAlign: "center",
      lineHeight: 20,
      maxWidth: 300,
    },
    phoneInputContainer: {
      alignItems: "center",
      marginBottom: 40,
    },
    phoneInputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.white,
      borderRadius: 16,
      paddingHorizontal: 16,
      height: 60,
      width: "100%",
      maxWidth: 350,
      borderWidth: 1,
      borderColor: colors.gray200,
    },
    countryCodeContainer: {
      marginRight: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.gray50,
      borderRadius: 8,
    },
    countryCodeText: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.gray800,
    },
    phoneInput: {
      flex: 1,
      fontSize: 18,
      color: colors.gray900,
      height: "100%",
      padding: 0,
      margin: 0,
    },
    phoneHint: {
      fontSize: 14,
      color: colors.gray500,
      marginTop: 12,
      textAlign: "center",
    },
    nextButtonContainer: {
      alignItems: "center",
      marginTop: 40,
    },
    nextButtonArrow: {
      width: 70,
      height: 70,
      borderRadius: 35,
      overflow: "hidden",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 8,
    },
    nextButtonDisabled: {
      opacity: 0.5,
    },
    nextButtonArrowGradient: {
      width: "100%",
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
    },
    nextButtonArrowText: {
      fontSize: 32,
      color: colors.white,
      fontWeight: "300",
    },
    nextButtonLabel: {
      fontSize: 16,
      color: colors.gray600,
      marginTop: 16,
      fontWeight: "500",
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    signInButton: {
      width: "100%",
      maxWidth: 350,
      borderRadius: 16,
      overflow: "hidden",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 8,
    },
    signInButtonGradient: {
      paddingVertical: 18,
      alignItems: "center",
    },
    signInButtonText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: "700",
    },
    dividerContainer: {
      flexDirection: "row",
      alignItems: "center",
      width: "100%",
      maxWidth: 350,
      alignSelf: "center",
      marginVertical: 24,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.gray300,
    },
    dividerText: {
      marginHorizontal: 12,
      fontSize: 13,
      fontWeight: "600",
      color: colors.gray500,
    },
    createAccountButton: {
      width: "100%",
      maxWidth: 350,
      alignSelf: "center",
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.primary,
      paddingVertical: 16,
      alignItems: "center",
      marginBottom: 20,
    },
    createAccountButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: "700",
    },
    driverLinkText: {
      textAlign: "center",
      fontSize: 14,
      color: colors.gray600,
      fontWeight: "500",
    },
  });

export default WelcomeScreen;
