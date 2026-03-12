import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axiosRetry from "axios-retry";
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

// Configure retry logic with axios-retry
axiosRetry(api, {
  retries: 5,
  retryDelay: (retryCount) => axiosRetry.exponentialDelay(retryCount),
  retryCondition: (error) => {
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      error.code === "ECONNABORTED" ||
      (error.response && error.response.status >= 500) ||
      error.response?.status === 429
    );
  },
  onRetry: (retryCount, error, requestConfig) => {
    console.log(
      `🔄 Retry attempt #${retryCount} for ${requestConfig.method?.toUpperCase()} ${requestConfig.url} after error: ${error.message}`,
    );
  },
});

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

// Create a separate axios instance for refresh requests (no interceptors)
const refreshApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

// Response interceptor with token refresh (using a dedicated instance to avoid loops)
api.interceptors.response.use(
  (response) => {
    console.log(`✅ Response: ${response.status} ${response.config.url}`);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      console.log("🔄 401 detected, attempting token refresh...");

      try {
        const refreshToken = await AsyncStorage.getItem("refreshToken");
        if (!refreshToken) {
          console.warn("No refresh token available, logging out");
          await AsyncStorage.multiRemove([
            "accessToken",
            "refreshToken",
            "user",
          ]);
          return Promise.reject(error);
        }

        console.log("🔄 Sending refresh request...");
        const response = await refreshApi.post("/auth/refresh", {
          refresh_token: refreshToken,
        });

        console.log(
          "🔄 Refresh response received:",
          JSON.stringify(response.data, null, 2),
        );

        // Try to extract tokens – handle both camelCase and snake_case
        let newAccessToken, newRefreshToken;
        if (response.data.tokens) {
          // Backend returns tokens inside a "tokens" object with snake_case keys
          newAccessToken = response.data.tokens.access_token;
          newRefreshToken = response.data.tokens.refresh_token;
          // Fallback to camelCase if snake_case not found
          if (!newAccessToken) {
            newAccessToken = response.data.tokens.accessToken;
            newRefreshToken = response.data.tokens.refreshToken;
          }
        } else if (response.data.access_token) {
          // Direct snake_case at top level
          newAccessToken = response.data.access_token;
          newRefreshToken = response.data.refresh_token;
        } else if (response.data.accessToken) {
          // Direct camelCase at top level
          newAccessToken = response.data.accessToken;
          newRefreshToken = response.data.refreshToken;
        } else {
          console.error(
            "Refresh response did not contain tokens",
            response.data,
          );
          return Promise.reject(error);
        }

        if (!newAccessToken) {
          console.error("No access token in refresh response");
          return Promise.reject(error);
        }

        // Store new tokens – we store as camelCase in AsyncStorage for consistency
        await AsyncStorage.setItem("accessToken", newAccessToken);
        if (newRefreshToken) {
          await AsyncStorage.setItem("refreshToken", newRefreshToken);
        }

        console.log(
          "🔄 Token refreshed successfully, retrying original request...",
        );

        // Update authorization header and retry
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError: any) {
        console.error("❌ Token refresh failed:", refreshError.message);
        if (refreshError.response?.status === 401) {
          console.warn("Refresh token invalid, logging out");
          await AsyncStorage.multiRemove([
            "accessToken",
            "refreshToken",
            "user",
          ]);
        }
        return Promise.reject(refreshError);
      }
    }

    // Original error logging (for non-401 errors or when refresh already attempted)
    if (error.response) {
      console.error("❌ API Error Response:", {
        url: error.config?.url,
        method: error.config?.method?.toUpperCase(),
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers,
      });
    } else if (error.request) {
      console.error("❌ No response received:", {
        url: error.config?.url,
        method: error.config?.method?.toUpperCase(),
        request: error.request,
      });
    } else {
      console.error("❌ Request setup error:", {
        message: error.message,
        config: error.config,
      });
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
          ["accessToken", tokens.accessToken],
          ["refreshToken", tokens.refreshToken],
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
          ["accessToken", tokens.accessToken],
          ["refreshToken", tokens.refreshToken],
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
          ["accessToken", tokens.accessToken],
          ["refreshToken", tokens.refreshToken],
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
    const response = await refreshApi.post("/auth/refresh", {
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
