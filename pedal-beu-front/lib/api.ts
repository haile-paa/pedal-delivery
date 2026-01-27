import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AuthResponse,
  RegisterRequest,
  LoginRequest,
  VerifyOTPRequest,
  SendOTPRequest,
  VerifyOTPResponse,
  OTPResponse,
  User,
} from "../src/types";

const API_BASE_URL = __DEV__
  ? "https://pedal-delivery-back.onrender.com/api/v1"
  : "https://pedal-delivery-back.onrender.com/api/v1";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem("access_token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error("Error getting token:", error);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await AsyncStorage.getItem("refresh_token");
        if (!refreshToken) throw new Error("No refresh token");

        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token } = response.data.tokens;
        await AsyncStorage.setItem("access_token", access_token);

        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError) {
        await AsyncStorage.multiRemove([
          "access_token",
          "refresh_token",
          "user",
        ]);
        throw refreshError;
      }
    }

    throw error;
  },
);

export const authAPI = {
  // Send OTP
  sendOTP: async (
    phone: string,
    role?: "customer" | "driver",
  ): Promise<OTPResponse> => {
    try {
      const formattedPhone = formatPhoneNumber(phone);
      const response = await api.post("/auth/send-otp", {
        phone: formattedPhone,
        role,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to send OTP");
    }
  },

  // Verify OTP
  verifyOTP: async (
    phone: string,
    code: string,
    role?: "customer" | "driver",
  ): Promise<VerifyOTPResponse> => {
    try {
      const formattedPhone = formatPhoneNumber(phone);
      const response = await api.post("/auth/verify-otp", {
        phone: formattedPhone,
        code,
        role,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to verify OTP");
    }
  },

  // Register (simplified)
  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    try {
      const formattedPhone = formatPhoneNumber(data.phone);
      const registerData = {
        ...data,
        phone: formattedPhone,
        // Backend will auto-generate password for drivers if not provided
      };

      const response = await api.post("/auth/register", registerData);

      if (response.data.user && response.data.tokens) {
        const { user, tokens } = response.data;
        await AsyncStorage.multiSet([
          ["access_token", tokens.access_token],
          ["refresh_token", tokens.refresh_token],
          ["user", JSON.stringify(user)],
        ]);
      }

      return {
        success: true,
        message: "Registration successful",
        user: response.data.user,
        tokens: response.data.tokens,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || "Registration failed",
      };
    }
  },

  // Login with OTP (for existing users)
  loginWithOTP: async (phone: string): Promise<AuthResponse> => {
    try {
      const formattedPhone = formatPhoneNumber(phone);
      const response = await api.post("/auth/login-otp", {
        phone: formattedPhone,
      });

      if (response.data.user && response.data.tokens) {
        const { user, tokens } = response.data;
        await AsyncStorage.multiSet([
          ["access_token", tokens.access_token],
          ["refresh_token", tokens.refresh_token],
          ["user", JSON.stringify(user)],
        ]);
      }

      return {
        success: true,
        message: "Login successful",
        user: response.data.user,
        tokens: response.data.tokens,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || "Login failed",
      };
    }
  },

  // Traditional login (optional)
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    try {
      const formattedPhone = formatPhoneNumber(data.phone);
      const response = await api.post("/auth/login", {
        phone: formattedPhone,
        password: data.password,
      });

      if (response.data.user && response.data.tokens) {
        const { user, tokens } = response.data;
        await AsyncStorage.multiSet([
          ["access_token", tokens.access_token],
          ["refresh_token", tokens.refresh_token],
          ["user", JSON.stringify(user)],
        ]);
      }

      return {
        success: true,
        message: "Login successful",
        user: response.data.user,
        tokens: response.data.tokens,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || "Login failed",
      };
    }
  },

  // Refresh token
  refreshToken: async (refreshToken: string) => {
    const response = await api.post("/auth/refresh", {
      refresh_token: refreshToken,
    });
    return response.data;
  },

  // Logout
  logout: async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      await AsyncStorage.multiRemove(["access_token", "refresh_token", "user"]);
    }
  },

  // Get profile
  getProfile: async (): Promise<User> => {
    const response = await api.get("/users/me");
    return response.data;
  },

  // Update profile
  updateProfile: async (data: any) => {
    const response = await api.put("/users/profile", data);
    return response.data;
  },
};

// Helper function to format phone number
const formatPhoneNumber = (phone: string): string => {
  let formattedPhone = phone;
  if (phone.startsWith("9")) {
    formattedPhone = `+251${phone}`;
  } else if (phone.startsWith("0")) {
    formattedPhone = `+251${phone.substring(1)}`;
  } else if (!phone.startsWith("+")) {
    formattedPhone = `+251${phone}`;
  }
  return formattedPhone;
};

// Helper function to check auth status
export const checkAuth = async (): Promise<{
  isAuthenticated: boolean;
  user?: User;
}> => {
  try {
    const [token, user] = await Promise.all([
      AsyncStorage.getItem("access_token"),
      AsyncStorage.getItem("user"),
    ]);

    if (token && user) {
      return {
        isAuthenticated: true,
        user: JSON.parse(user),
      };
    }
    return { isAuthenticated: false };
  } catch (error) {
    console.error("Error checking auth:", error);
    return { isAuthenticated: false };
  }
};

export default api;
