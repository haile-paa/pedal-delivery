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
    console.log(`Retry attempt ${retryCount}/3 after error: ${error.message}`);
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
        `Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`,
        { params: config.params },
      );
    } catch (error) {
      console.log("Error getting token:", error);
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

// Simple pub/sub so screens can react to "session expired" without every
// API call needing its own try/catch UI logic. Auth screens can subscribe
// via onSessionExpired() and redirect to login quietly.
type SessionExpiredListener = () => void;
const sessionExpiredListeners: SessionExpiredListener[] = [];

export const onSessionExpired = (listener: SessionExpiredListener) => {
  sessionExpiredListeners.push(listener);
  return () => {
    const idx = sessionExpiredListeners.indexOf(listener);
    if (idx !== -1) sessionExpiredListeners.splice(idx, 1);
  };
};

let sessionExpiredNotified = false;

const notifySessionExpired = () => {
  if (sessionExpiredNotified) return; // avoid firing repeatedly per app session
  sessionExpiredNotified = true;
  sessionExpiredListeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.log("onSessionExpired listener error:", e);
    }
  });
};

// Marker so calling code can check `error.isSessionExpired` and skip
// showing a scary error message, since this is an expected condition
// after the app has been closed for several days.
const markSessionExpired = (error: any) => {
  error.isSessionExpired = true;
  return error;
};

// Response interceptor with token refresh
api.interceptors.response.use(
  (response) => {
    console.log(`Response: ${response.status} ${response.config.url}`);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await AsyncStorage.getItem("refreshToken");
        if (!refreshToken) {
          await AsyncStorage.multiRemove([
            "accessToken",
            "refreshToken",
            "user",
          ]);
          notifySessionExpired();
          return Promise.reject(markSessionExpired(error));
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
          await AsyncStorage.multiRemove([
            "accessToken",
            "refreshToken",
            "user",
          ]);
          notifySessionExpired();
          return Promise.reject(markSessionExpired(error));
        }

        await AsyncStorage.setItem("accessToken", newAccessToken);
        if (newRefreshToken)
          await AsyncStorage.setItem("refreshToken", newRefreshToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError: any) {
        // Backend can return 400 ("invalid refresh token") or 401 for an
        // expired/invalid refresh token — treat both as "please log in again".
        // This is the common case after the app sits unopened for several days.
        const status = refreshError.response?.status;
        if (status === 400 || status === 401 || !refreshError.response) {
          await AsyncStorage.multiRemove([
            "accessToken",
            "refreshToken",
            "user",
          ]);
          notifySessionExpired();
          return Promise.reject(markSessionExpired(refreshError));
        }
        return Promise.reject(refreshError);
      }
    }

    const isExpectedPaymentVerificationFallback =
      error.config?.url?.includes("/verify-payment") &&
      error.response?.status === 400;

    if (isExpectedPaymentVerificationFallback) {
      console.log("Payment verification fell back to manual review:", {
        url: error.config?.url,
        status: error.response?.status,
        data: error.response?.data,
      });
      return Promise.reject(error);
    }

    if (error.response) {
      console.log("API error:", {
        url: error.config?.url,
        status: error.response.status,
        data: error.response.data,
      });
    } else {
      console.log("Network error (silent):", error.message);
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
      const response = await api.post("/auth/register", {
        ...data,
        phone: formatPhoneNumber(data.phone),
      });
      if (response.data.user && response.data.tokens) {
        await AsyncStorage.multiSet([
          ["accessToken", response.data.tokens.accessToken],
          ["refreshToken", response.data.tokens.refreshToken],
          ["user", JSON.stringify(response.data.user)],
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
      const response = await api.post("/auth/login-otp", {
        phone: formatPhoneNumber(phone),
      });
      if (response.data.user && response.data.tokens) {
        await AsyncStorage.multiSet([
          ["accessToken", response.data.tokens.accessToken],
          ["refreshToken", response.data.tokens.refreshToken],
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
        await AsyncStorage.multiSet([
          ["accessToken", response.data.tokens.accessToken],
          ["refreshToken", response.data.tokens.refreshToken],
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

  // Driver login — accepts username OR phone number + password (credentials created by admin)
  driverLogin: async (data: {
    login: string; // username or phone number
    password: string;
  }): Promise<AuthResponse> => {
    try {
      const response = await api.post("/auth/driver-login", {
        login: data.login.trim(),
        password: data.password,
      });
      if (response.data.user && response.data.tokens) {
        await AsyncStorage.multiSet([
          ["accessToken", response.data.tokens.accessToken],
          ["refreshToken", response.data.tokens.refreshToken],
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
        error:
          error.response?.data?.error || "Invalid username/phone or password",
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
      console.log("Logout error:", error);
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
      console.log("Address saved:", response.data);
      return response.data;
    } catch (error: any) {
      console.log(
        "Failed to save address:",
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
      console.log("Failed to get addresses:", error.message);
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
        "Creating order with payload:",
        JSON.stringify(orderData, null, 2),
      );
      const response = await api.post("/orders", orderData, {
        timeout: 60000,
      });
      console.log("Order created:", JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (error: any) {
      console.log("createOrder error:", error.response?.data || error.message);
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
      console.log(
        "Payment verification could not be completed automatically:",
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
      console.log(
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
      return response.data; // { orders: [...], pagination: {...} }
    } catch (error: any) {
      // Session expired (e.g. app unused for several days, refresh token
      // no longer valid) — this is expected, not a real error. Return an
      // empty list quietly instead of throwing, so the screen just shows
      // "no orders" rather than a scary error banner. The session-expired
      // listener (set up via onSessionExpired) handles redirecting to login.
      if (error.isSessionExpired) {
        console.log("getCustomerOrders: session expired, returning empty list");
        return { orders: [], pagination: { page, limit, total: 0 } };
      }
      console.log("getCustomerOrders error:", error.message);
      throw new Error(error.response?.data?.error || "Failed to fetch orders");
    }
  },

  // FIX 10: Fetch orders assigned to the authenticated driver
  getDriverOrders: async (page = 1, limit = 20): Promise<any> => {
    try {
      const response = await api.get("/orders/driver", {
        params: { page, limit },
        timeout: 60000,
      });
      return response.data; // { orders: [...], pagination: {...} }
    } catch (error: any) {
      // Same session-expired handling as getCustomerOrders above.
      if (error.isSessionExpired) {
        console.log("getDriverOrders: session expired, returning empty list");
        return { orders: [], pagination: { page, limit, total: 0 } };
      }
      console.log("getDriverOrders error:", error.message);
      throw new Error(
        error.response?.data?.error || "Failed to fetch driver orders",
      );
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
