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
  timeout: 30000,
});

// Retry helper for network errors
const retryRequest = async <T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000,
): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    if (
      retries <= 0 ||
      (error.response &&
        error.response.status >= 400 &&
        error.response.status < 500)
    ) {
      throw error;
    }
    console.log(
      `Retry attempt ${3 - retries + 1}/3 after error: ${error.message}`,
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
    return retryRequest(fn, retries - 1, delay * 2);
  }
};

// Request interceptor
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem("accessToken");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      console.log(
        `🌐 Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`,
        {
          headers: config.headers,
          params: config.params,
        },
      );
    } catch (error) {
      console.error("Error getting token:", error);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.log(`✅ Response: ${response.status} ${response.config.url}`);
    return response;
  },
  async (error) => {
    if (error.response) {
      console.error("❌ API Error Response:", {
        url: error.config?.url,
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
      });
    } else if (error.request) {
      console.error("❌ No response received:", error.request);
    } else {
      console.error("❌ Request setup error:", error.message);
    }
    return Promise.reject(error);
  },
);

export const authAPI = {
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

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    try {
      const formattedPhone = formatPhoneNumber(data.phone);
      const registerData = { ...data, phone: formattedPhone };
      const response = await api.post("/auth/register", registerData);
      if (response.data.user && response.data.tokens) {
        const { user, tokens } = response.data;
        await AsyncStorage.multiSet([
          ["accessToken", tokens.access_token],
          ["refreshToken", tokens.refresh_token],
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

  loginWithOTP: async (phone: string): Promise<AuthResponse> => {
    try {
      const formattedPhone = formatPhoneNumber(phone);
      const response = await api.post("/auth/login-otp", {
        phone: formattedPhone,
      });
      if (response.data.user && response.data.tokens) {
        const { user, tokens } = response.data;
        await AsyncStorage.multiSet([
          ["accessToken", tokens.access_token],
          ["refreshToken", tokens.refresh_token],
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
          ["accessToken", tokens.access_token],
          ["refreshToken", tokens.refresh_token],
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

  refreshToken: async (refreshToken: string) => {
    const response = await api.post("/auth/refresh", {
      refresh_token: refreshToken,
    });
    return response.data;
  },

  logout: async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      await AsyncStorage.multiRemove(["accessToken", "refreshToken", "user"]);
    }
  },

  getProfile: async (): Promise<User> => {
    const response = await api.get("/users/me");
    return response.data;
  },

  updateProfile: async (data: any) => {
    const response = await api.put("/users/profile", data);
    return response.data;
  },
};

// Order API
export const orderAPI = {
  createOrder: async (orderData: any): Promise<any> => {
    try {
      const response = await api.post("/orders", orderData, { timeout: 60000 });
      console.log("📦 createOrder API response:", response.data);
      return response.data;
    } catch (error: any) {
      console.error("❌ createOrder API error:", error);
      throw new Error(
        error.response?.data?.message || "Failed to create order",
      );
    }
  },

  getOrderById: async (orderId: string): Promise<any> => {
    try {
      const response = await api.get(`/orders/${orderId}`, { timeout: 60000 });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to fetch order");
    }
  },

  cancelOrder: async (orderId: string): Promise<any> => {
    try {
      const response = await api.post(
        `/orders/${orderId}/cancel`,
        {},
        { timeout: 60000 },
      );
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Failed to cancel order",
      );
    }
  },

  rateOrder: async (orderId: string, ratingData: any): Promise<any> => {
    try {
      const response = await api.post(`/orders/${orderId}/rate`, ratingData, {
        timeout: 60000,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || "Failed to rate order");
    }
  },

  getCustomerOrders: async (page = 1, limit = 10): Promise<any> => {
    try {
      const response = await api.get("/orders", {
        params: { page, limit },
        timeout: 60000,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || "Failed to fetch orders",
      );
    }
  },
};

const formatPhoneNumber = (phone: string): string => {
  let formattedPhone = phone;
  if (phone.startsWith("9")) formattedPhone = `+251${phone}`;
  else if (phone.startsWith("0")) formattedPhone = `+251${phone.substring(1)}`;
  else if (!phone.startsWith("+")) formattedPhone = `+251${phone}`;
  return formattedPhone;
};

export const checkAuth = async (): Promise<{
  isAuthenticated: boolean;
  user?: User;
}> => {
  try {
    const [token, user] = await Promise.all([
      AsyncStorage.getItem("accessToken"),
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
