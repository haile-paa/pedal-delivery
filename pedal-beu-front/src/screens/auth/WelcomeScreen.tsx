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
import { colors } from "../../theme/colors";
import AnimatedButton from "../../components/ui/AnimatedButton";
import { LinearGradient } from "expo-linear-gradient";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const WelcomeScreen: React.FC = () => {
  const router = useRouter();
  const [showPhoneScreen, setShowPhoneScreen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);

  // FIX: Stable function so input does not re-render unexpectedly
  const handlePhoneNumberChange = useCallback((text: string) => {
    const cleaned = text.replace(/[^0-9]/g, "");
    setPhoneNumber(cleaned);
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

  const handleContinueAsCustomer = async () => {
    Keyboard.dismiss();

    if (!phoneNumber.trim()) {
      Alert.alert("Error", "Please enter your phone number");
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      Alert.alert("Error", "Enter valid 9-digit number like 912345678");
      return;
    }

    setLoading(true);

    try {
      // Just send OTP - backend will handle registration status
      const res = await fetch("https://pedal-delivery-back.onrender.com/api/v1/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phoneNumber,
          role: "customer",
        }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push({
          pathname: "/(auth)/phone-verification",
          params: {
            role: "customer",
            phone: phoneNumber,
          },
        });
      } else {
        Alert.alert("Error", data.message || "Failed to send OTP");
      }
    } catch (err) {
      Alert.alert("Error", "Server error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDriverButton = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert("Error", "Please enter your phone number first");
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      Alert.alert("Error", "Enter valid 9-digit number like 912345678");
      return;
    }

    setLoading(true);

    try {
      // Send OTP for driver login/registration
      const res = await fetch("https://pedal-delivery-back.onrender.com/api/v1/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phoneNumber,
          role: "driver",
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // OTP sent successfully
        router.push({
          pathname: "/(auth)/phone-verification",
          params: {
            role: "driver",
            phone: phoneNumber,
          },
        });
      } else {
        // If OTP fails (driver not registered), go to driver registration
        if (data.error && data.error.includes("not registered")) {
          router.push({
            pathname: "/(auth)/driver-form",
            params: { phone: phoneNumber },
          });
        } else {
          Alert.alert("Error", data.message || "Failed to send OTP");
        }
      }
    } catch (err) {
      // On network error, still allow driver registration
      router.push({
        pathname: "/(auth)/driver-form",
        params: { phone: phoneNumber },
      });
    } finally {
      setLoading(false);
    }
  };

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

  // NO useMemo — keeps TextInput stable
  const PhoneInputScreen = () => (
    <View style={[styles.screen, styles.screen2]}>
      <LinearGradient
        colors={["#f8fafc", "#e2e8f0"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.screen2Content}>
        <TouchableOpacity style={styles.backButton} onPress={goBackToWelcome}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>

        {/* Driver Button */}
        <View style={styles.driverTopButtonContainer}>
          <TouchableOpacity
            style={styles.driverTopButton}
            onPress={handleDriverButton}
            disabled={loading}
          >
            <LinearGradient
              colors={["#FF6B6B", "#FF8E53"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.driverTopButtonGradient,
                loading && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.driverTopButtonText}>
                🚗 If you are a driver
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.titleContainer}>
          <Text style={styles.phoneTitle}>Enter Your Phone Number</Text>
          <Text style={styles.phoneSubtitle}>
            For customers only. Drivers should use the button above.
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
              keyboardType='numeric'
              maxLength={9}
              autoFocus
              editable={!loading}
              returnKeyType='done'
              clearButtonMode='while-editing'
            />
          </View>

          <Text style={styles.phoneHint}>
            Enter your 9-digit phone number starting with 9
          </Text>
        </View>

        <View style={styles.nextButtonContainer}>
          <TouchableOpacity
            style={[
              styles.nextButtonArrow,
              (!validatePhoneNumber(phoneNumber) || loading) &&
                styles.nextButtonDisabled,
            ]}
            onPress={handleContinueAsCustomer}
            disabled={!validatePhoneNumber(phoneNumber) || loading}
          >
            <LinearGradient
              colors={["#667eea", "#764ba2"]}
              style={[
                styles.nextButtonArrowGradient,
                loading && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.nextButtonArrowText}>
                {loading ? "..." : "→"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.nextButtonLabel}>Continue as Customer</Text>
        </View>
      </View>
    </View>
  );

  const LogoWelcomeScreen = () => (
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
  );

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={showPhoneScreen ? "dark-content" : "light-content"}
        backgroundColor={showPhoneScreen ? "#f8fafc" : "#667eea"}
      />

      {showPhoneScreen ? <PhoneInputScreen /> : <LogoWelcomeScreen />}
    </View>
  );
};

const styles = StyleSheet.create({
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
  // Driver Top Button Styles
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
  // Title styles
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
  // Phone input styles - SIMPLIFIED
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
  // Customer button styles
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
});

export default WelcomeScreen;
