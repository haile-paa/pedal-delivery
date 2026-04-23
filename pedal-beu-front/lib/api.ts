// lib/api.ts
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axiosRetry from "axios-retry";
import {
  AuthResponse,
  RegisterRequest,
  LoginRequest,
  VerifyOTPResponse,
  OTPResponse,
  User,
} from "../src/types";

const API_BASE_URL = "https://pedal-delivery-back.onrender.com/api/v1";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

axiosRetry(api, {
  retries: 3,
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
      `🔄 Retry #${retryCount} for ${requestConfig.method?.toUpperCase()} ${requestConfig.url}: ${error.message}`,
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
        { params: config.params },
      );
    } catch (error) {
      console.error("Error getting token:", error);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Separate instance for refresh (no interceptors to avoid loops)
const refreshApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

// Flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

// Response interceptor with token refresh
api.interceptors.response.use(
  (response) => {
    console.log(`✅ Response: ${response.status} ${response.config.url}`);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Check if error is due to unauthorized (401) or potential auth-related 400
    const isAuthError =
      error.response?.status === 401 ||
      (error.response?.status === 400 &&
        error.response?.data?.error?.toLowerCase().includes("token"));

    if (isAuthError && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue the request while refresh is in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await AsyncStorage.getItem("refreshToken");
        if (!refreshToken) {
          // No refresh token, cannot refresh
          await AsyncStorage.multiRemove([
            "accessToken",
            "refreshToken",
            "user",
          ]);
          isRefreshing = false;
          processQueue(new Error("No refresh token"), null);
          return Promise.reject(error);
        }

        const response = await refreshApi.post("/auth/refresh", {
          refresh_token: refreshToken,
        });

        let newAccessToken: string | undefined;
        let newRefreshToken: string | undefined;

        if (response.data.tokens) {
          newAccessToken =
            response.data.tokens.access_token ||
            response.data.tokens.accessToken;
          newRefreshToken =
            response.data.tokens.refresh_token ||
            response.data.tokens.refreshToken;
        } else {
          newAccessToken =
            response.data.access_token || response.data.accessToken;
          newRefreshToken =
            response.data.refresh_token || response.data.refreshToken;
        }

        if (!newAccessToken) {
          throw new Error("No access token in refresh response");
        }

        await AsyncStorage.setItem("accessToken", newAccessToken);
        if (newRefreshToken) {
          await AsyncStorage.setItem("refreshToken", newRefreshToken);
        }

        // Update Authorization header for the original request
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        // Process queued requests
        processQueue(null, newAccessToken);
        isRefreshing = false;

        return api(originalRequest);
      } catch (refreshError: any) {
        // Refresh failed - clear auth data
        await AsyncStorage.multiRemove(["accessToken", "refreshToken", "user"]);
        processQueue(refreshError, null);
        isRefreshing = false;

        // Add a flag to identify auth failure
        refreshError.isAuthError = true;
        return Promise.reject(refreshError);
      }
    }

    // Log errors
    if (error.response) {
      console.error("❌ API Error:", {
        url: error.config?.url,
        status: error.response.status,
        data: error.response.data,
      });
    } else {
      console.error("❌ Network Error:", error.message);
    }
    return Promise.reject(error);
  },
);

// ==================== HELPERS ====================

const formatPhoneNumber = (phone: string): string => {
  if (phone.startsWith("9")) return `+251${phone}`;
  if (phone.startsWith("0")) return `+251${phone.substring(1)}`;
  if (!phone.startsWith("+")) return `+251${phone}`;
  return phone;
};

// ==================== AUTH API ====================

export const authAPI = {
  sendOTP: async (
    phone: string,
    role?: "customer" | "driver",
  ): Promise<OTPResponse> => {
    const response = await api.post("/auth/send-otp", {
      phone: formatPhoneNumber(phone),
      role,
    });
    return response.data;
  },

  verifyOTP: async (
    phone: string,
    code: string,
    role?: "customer" | "driver",
  ): Promise<VerifyOTPResponse> => {
    const response = await api.post("/auth/verify-otp", {
      phone: formatPhoneNumber(phone),
      code,
      role,
    });
    return response.data;
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    try {
      console.log("📝 Register request data:", {
        ...data,
        phone: formatPhoneNumber(data.phone),
      });
      const response = await api.post("/auth/register", {
        ...data,
        phone: formatPhoneNumber(data.phone),
      });
      console.log("📝 Register response status:", response.status);
      console.log(
        "📝 Register response data:",
        JSON.stringify(response.data, null, 2),
      );

      // Check if the response contains the expected fields
      if (response.data.user && response.data.tokens) {
        // Backend returns snake_case tokens
        const accessToken = response.data.tokens.access_token;
        const refreshToken = response.data.tokens.refresh_token;

        if (!accessToken || !refreshToken) {
          console.error("❌ Missing tokens in response:", response.data.tokens);
          return {
            success: false,
            error: "Invalid token response from server",
          };
        }

        console.log("✅ Registration successful, storing tokens and user");
        await AsyncStorage.multiSet([
          ["accessToken", accessToken],
          ["refreshToken", refreshToken],
          ["user", JSON.stringify(response.data.user)],
        ]);
        return {
          success: true,
          message: "Registration successful",
          user: response.data.user,
          tokens: {
            access_token: accessToken,
            refresh_token: refreshToken,
          },
        };
      } else {
        console.error(
          "❌ Register response missing user or tokens:",
          response.data,
        );
        return {
          success: false,
          error: "Invalid response from server",
        };
      }
    } catch (error: any) {
      console.error(
        "❌ Register error:",
        error.response?.status,
        error.response?.data || error.message,
      );
      return {
        success: false,
        error:
          error.response?.data?.error || error.message || "Registration failed",
      };
    }
  },

  loginWithOTP: async (phone: string): Promise<AuthResponse> => {
    try {
      const response = await api.post("/auth/login-otp", {
        phone: formatPhoneNumber(phone),
      });
      if (response.data.user && response.data.tokens) {
        const accessToken = response.data.tokens.access_token;
        const refreshToken = response.data.tokens.refresh_token;
        await AsyncStorage.multiSet([
          ["accessToken", accessToken],
          ["refreshToken", refreshToken],
          ["user", JSON.stringify(response.data.user)],
        ]);
      }
      return {
        success: true,
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
      const response = await api.post("/auth/login", {
        phone: formatPhoneNumber(data.phone),
        password: data.password,
      });
      if (response.data.user && response.data.tokens) {
        const accessToken = response.data.tokens.access_token;
        const refreshToken = response.data.tokens.refresh_token;
        await AsyncStorage.multiSet([
          ["accessToken", accessToken],
          ["refreshToken", refreshToken],
          ["user", JSON.stringify(response.data.user)],
        ]);
      }
      return {
        success: true,
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

// ==================== ADDRESS API ====================

export const addressAPI = {
  addAddress: async (data: {
    label: string;
    address: string;
    latitude: number;
    longitude: number;
    is_default: boolean;
  }): Promise<any> => {
    try {
      const response = await api.post("/users/addresses", data);
      console.log("📍 Address saved:", response.data);
      return response.data;
    } catch (error: any) {
      console.error(
        "❌ Failed to save address:",
        error.response?.data || error.message,
      );
      throw new Error(error.response?.data?.error || "Failed to save address");
    }
  },

  getAddresses: async (): Promise<any[]> => {
    try {
      const response = await api.get("/users/addresses");
      return response.data.addresses || [];
    } catch (error: any) {
      console.error("❌ Failed to get addresses:", error.message);
      return [];
    }
  },

  deleteAddress: async (addressId: string): Promise<void> => {
    await api.delete(`/users/addresses/${addressId}`);
  },
};

// ==================== ORDER API ====================

export const orderAPI = {
  createOrder: async (orderData: {
    restaurant_id: string;
    items: Array<{
      menu_item_id: string;
      quantity: number;
      addons?: Array<{ addon_id: string }>;
      notes?: string;
    }>;
    address_id: string;
    payment_method: string;
    notes?: string;
  }): Promise<any> => {
    try {
      console.log(
        "📦 Creating order with payload:",
        JSON.stringify(orderData, null, 2),
      );
      const response = await api.post("/orders", orderData, {
        timeout: 60000,
      });
      console.log("📦 Order created:", JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (error: any) {
      console.error(
        "❌ createOrder error:",
        error.response?.data || error.message,
      );
      throw new Error(error.response?.data?.error || "Failed to create order");
    }
  },

  verifyPayment: async (
    orderId: string,
    paymentData: {
      method: "cbe_transfer" | "telebirr_transfer";
      transaction_reference: string;
      amount: number;
      payer_phone?: string;
    },
  ): Promise<any> => {
    try {
      const response = await api.post(
        `/orders/${orderId}/verify-payment`,
        paymentData,
        { timeout: 60000 },
      );
      return response.data;
    } catch (error: any) {
      console.error(
        "Payment verification error:",
        error.response?.data || error.message,
      );
      throw new Error(
        error.response?.data?.error || "Failed to verify payment",
      );
    }
  },

  submitPaymentProof: async (
    orderId: string,
    proofData: {
      method: "cbe_transfer" | "telebirr_transfer";
      transaction_reference: string;
      amount: number;
      payer_phone?: string;
      proof_url: string;
    },
  ): Promise<any> => {
    try {
      const response = await api.post(
        `/orders/${orderId}/payment-proof`,
        proofData,
        { timeout: 60000 },
      );
      return response.data;
    } catch (error: any) {
      console.error(
        "Payment proof submission error:",
        error.response?.data || error.message,
      );
      throw new Error(
        error.response?.data?.error || "Failed to submit payment proof",
      );
    }
  },

  uploadPaymentProof: async (asset: {
    uri: string;
    fileName?: string | null;
    mimeType?: string | null;
  }): Promise<any> => {
    const formData = new FormData();
    formData.append("type", "payment-proofs");
    formData.append("image", {
      uri: asset.uri,
      name: asset.fileName || `payment-proof-${Date.now()}.jpg`,
      type: asset.mimeType || "image/jpeg",
    } as any);

    const response = await api.post("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60000,
    });
    return response.data;
  },

  getOrderById: async (orderId: string): Promise<any> => {
    const response = await api.get(`/orders/${orderId}`, { timeout: 60000 });
    return response.data;
  },

  cancelOrder: async (orderId: string, reason: string): Promise<any> => {
    const response = await api.post(
      `/orders/${orderId}/cancel`,
      { reason },
      { timeout: 60000 },
    );
    return response.data;
  },

  rateOrder: async (orderId: string, ratingData: any): Promise<any> => {
    const response = await api.post(`/orders/${orderId}/rate`, ratingData, {
      timeout: 60000,
    });
    return response.data;
  },

  getCustomerOrders: async (page = 1, limit = 10): Promise<any> => {
    try {
      const response = await api.get("/orders", {
        params: { page, limit },
        timeout: 60000,
      });
      return response.data;
    } catch (error: any) {
      console.error("❌ getCustomerOrders error:", error.message);
      throw new Error(error.response?.data?.error || "Failed to fetch orders");
    }
  },
};

// ==================== AUTH CHECK ====================

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
      return { isAuthenticated: true, user: JSON.parse(user) };
    }
    return { isAuthenticated: false };
  } catch {
    return { isAuthenticated: false };
  }
};

export default api;
