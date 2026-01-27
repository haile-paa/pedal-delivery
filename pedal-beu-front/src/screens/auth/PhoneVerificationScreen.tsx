import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Alert,
  Image,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useRouter, useLocalSearchParams } from "expo-router";
import { colors } from "../../theme/colors";
import { useAppState } from "../../context/AppStateContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width: screenWidth } = Dimensions.get("window");

const PhoneVerificationScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { role, phone } = params as {
    role: "customer" | "driver";
    phone: string;
  };
  const { dispatch } = useAppState();

  const [otp, setOtp] = useState<string[]>(new Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [showOtpAlert, setShowOtpAlert] = useState(true); // New state to control OTP alert
  const inputRefs = useRef<TextInput[]>([]);
  const shakeAnimation = useSharedValue(0);

  // Timer for resend OTP
  useEffect(() => {
    let interval: number | null = null;

    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }

    return () => {
      if (interval !== null) {
        clearInterval(interval);
      }
    };
  }, [resendTimer]);

  const triggerShake = () => {
    shakeAnimation.value = withSequence(
      withTiming(10, { duration: 50 }),
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  };

  const handleOtpChange = (text: string, index: number) => {
    if (text.length > 1) {
      const pastedOtp = text.split("").slice(0, 6);
      const newOtp = [...otp];
      pastedOtp.forEach((char, idx) => {
        if (index + idx < 6) newOtp[index + idx] = char;
      });
      setOtp(newOtp);
      const nextIndex = index + pastedOtp.length;
      if (nextIndex < 6) inputRefs.current[nextIndex]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    if (text && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const otpString = otp.join("");
    if (otpString.length !== 6) {
      setError("Please enter the 6-digit OTP");
      triggerShake();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log("Sending OTP verification request...");
      console.log("Phone:", phone);
      console.log("Role:", role);
      console.log("OTP:", otpString);

      const res = await fetch(
        "https://pedal-delivery-back.onrender.com/api/v1/auth/verify-otp",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone,
            code: otpString,
            role: role,
          }),
        },
      );

      console.log("Response status:", res.status);
      const data = await res.json();
      console.log("Response data:", JSON.stringify(data, null, 2));

      if (res.ok) {
        console.log("OTP verified successfully. exists:", data.exists);

        // Check if user exists from the response
        if (data.exists) {
          console.log("User exists, logging in automatically...");

          // Check if tokens are present
          if (!data.tokens || !data.tokens.accessToken) {
            console.error("No tokens received from server");
            setError("Authentication failed. Please try again.");
            return;
          }

          // Store refreshToken in AsyncStorage for future use
          if (data.tokens.refreshToken) {
            await AsyncStorage.setItem(
              "refreshToken",
              data.tokens.refreshToken,
            );
          }

          // Store accessToken in AsyncStorage
          await AsyncStorage.setItem("accessToken", data.tokens.accessToken);

          // Store user data in AsyncStorage
          await AsyncStorage.setItem("user", JSON.stringify(data.user));

          // User already exists - use the tokens from verify-otp response
          dispatch({
            type: "LOGIN_SUCCESS",
            payload: {
              user: data.user,
              token: data.tokens.accessToken,
              role: data.user.role || role,
            },
          });

          // Navigate to appropriate screen based on role
          if (data.user.role === "driver" || role === "driver") {
            console.log("Navigating to driver dashboard...");
            router.replace(`/(driver)/dashboard`);
          } else {
            console.log("Navigating to customer home...");
            router.replace(`/(customer)/home`);
          }
        } else {
          console.log("User doesn't exist, navigating to registration...");
          // New user - navigate to registration
          router.push({
            pathname: "/(auth)/register",
            params: { phone, role },
          });
        }
      } else {
        console.error("OTP verification failed:", data.message || data.error);
        setError(data.message || data.error || "Invalid OTP");
        triggerShake();
      }
    } catch (err: any) {
      console.error("Fetch error during OTP verification:", err);
      console.error("Error message:", err.message);
      setError("Verification failed. Please try again.");
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;

    try {
      console.log("Resending OTP for phone:", phone, "role:", role);
      const res = await fetch("https://pedal-delivery-back.onrender.com/api/v1/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          role,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        // Show OTP in alert for testing
        if (data.otp) {
          Alert.alert("OTP Sent Successfully", `Your OTP is: ${data.otp}`, [
            {
              text: "OK",
              onPress: () => {
                console.log("OTP alert dismissed");
                // Auto-fill OTP for convenience during testing
                const otpDigits = data.otp.split("");
                if (otpDigits.length === 6) {
                  setOtp(otpDigits);
                  // Focus on first input after auto-fill
                  setTimeout(() => {
                    inputRefs.current[0]?.focus();
                  }, 100);
                }
              },
            },
          ]);
        } else {
          Alert.alert("Success", "OTP resent successfully!");
        }

        setResendTimer(30); // 30-second cooldown
      } else {
        Alert.alert(
          "Error",
          data.message || data.error || "Failed to resend OTP",
        );
      }
    } catch (err) {
      console.error("Resend OTP error:", err);
      Alert.alert("Error", "Server error. Please try again.");
    }
  };

  // Function to show OTP alert (you can call this on component mount or when OTP is sent)
  const showOtpInAlert = (otpCode: string) => {
    Alert.alert(
      "Development OTP",
      `Your OTP is: ${otpCode}\n\nEnter this code to verify your phone number.`,
      [
        {
          text: "OK, I'll enter it",
          onPress: () => {
            console.log("OTP alert dismissed");
            // Auto-fill OTP for convenience during testing
            const otpDigits = otpCode.split("");
            if (otpDigits.length === 6) {
              setOtp(otpDigits);
              // Focus on first input after auto-fill
              setTimeout(() => {
                inputRefs.current[0]?.focus();
              }, 100);
            }
          },
        },
      ],
    );
  };

  // Optional: Add a button to show OTP again
  const handleShowOtpAgain = () => {
    // You could fetch the OTP from backend again or show a message
    Alert.alert(
      "Get OTP Again",
      "Would you like to see the OTP again? This will resend a new OTP.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Resend & Show",
          onPress: handleResendOtp,
        },
      ],
    );
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeAnimation.value }],
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle='dark-content' backgroundColor={colors.background} />

      <View style={styles.header}>
        <Image
          source={require("../../../assets/images/otp-verification.png")}
          style={styles.animation}
        />
        <Text style={styles.title}>Verify Your Phone</Text>
        <Text style={styles.subtitle}>
          We've sent a 6-digit OTP to your phone number
        </Text>
        <Text style={styles.phoneNumberText}>Phone: +251 {phone}</Text>
        <Text style={styles.roleText}>
          {role === "driver" ? "Driver" : "Customer"}
        </Text>

        {/* Clickable text to resend OTP */}
        <TouchableOpacity onPress={handleShowOtpAgain}>
          <Text style={styles.helpText}>
            If you didn't get the OTP, click here
          </Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.otpContainer, animatedStyle]}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => {
              if (ref) inputRefs.current[index] = ref;
            }}
            style={[
              styles.otpInput,
              digit && styles.otpInputFilled,
              error && styles.otpInputError,
            ]}
            value={digit}
            onChangeText={(text) => handleOtpChange(text, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            keyboardType='number-pad'
            maxLength={1}
            selectTextOnFocus
            autoFocus={index === 0}
          />
        ))}
      </Animated.View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity
        style={[
          styles.verifyButton,
          (loading || otp.join("").length !== 6) && styles.verifyButtonDisabled,
        ]}
        onPress={handleVerifyOtp}
        disabled={loading || otp.join("").length !== 6}
      >
        <Text style={styles.verifyButtonText}>
          {loading ? "Verifying..." : "Verify OTP"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.resendButton}
        onPress={handleResendOtp}
        disabled={resendTimer > 0}
      >
        <Text style={styles.resendText}>
          {resendTimer > 0
            ? `Resend OTP in ${resendTimer}s`
            : "Didn't receive code? "}
          {resendTimer === 0 && (
            <Text style={styles.resendLink}>Resend OTP</Text>
          )}
        </Text>
      </TouchableOpacity>

      <Text style={styles.registrationNote}>
        {role === "customer"
          ? "If this is your first time, you'll complete registration after verification"
          : "Drivers must be registered by manager before using this app"}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  animation: {
    width: 150,
    height: 150,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.gray900,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.gray600,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 8,
  },
  phoneNumberText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.primary,
    marginTop: 8,
  },
  roleText: {
    fontSize: 14,
    color: colors.gray500,
    marginTop: 4,
  },
  helpText: {
    fontSize: 14,
    color: colors.primary,
    marginTop: 12,
    textDecorationLine: "underline",
    padding: 8,
    backgroundColor: colors.primary + "10",
    borderRadius: 8,
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  otpInput: {
    width: 50,
    height: 50,
    borderWidth: 2,
    borderColor: colors.gray300,
    borderRadius: 12,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "bold",
    color: colors.gray900,
    backgroundColor: colors.white,
  },
  otpInputFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + "10",
  },
  otpInputError: {
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  verifyButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  resendButton: {
    alignItems: "center",
    marginBottom: 20,
  },
  resendText: {
    color: colors.gray600,
    fontSize: 14,
  },
  resendLink: {
    color: colors.primary,
    fontWeight: "600",
  },
  registrationNote: {
    fontSize: 14,
    color: colors.gray500,
    textAlign: "center",
    fontStyle: "italic",
    marginTop: 20,
  },
});

export default PhoneVerificationScreen;
