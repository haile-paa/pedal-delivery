import axios from "axios";

const API_URL = "https://pedal-delivery-back.onrender.com/api/v1";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor – attach token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("admin_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor with refresh logic
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem("admin_refreshToken");
      if (!refreshToken) {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_user");
        window.location.href = "/login";
        return Promise.reject(error);
      }

      try {
        const { data } = await api.post("/auth/refresh", {
          refresh_token: refreshToken,
        });
        const newAccessToken = data.tokens.accessToken;
        localStorage.setItem("admin_token", newAccessToken);
        api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
        processQueue(null, newAccessToken);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_refreshToken");
        localStorage.removeItem("admin_user");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

// Auth API
export const authAPI = {
  sendOTP: (phone: string, role: string = "admin") =>
    api.post("/auth/send-otp", { phone, role }),
  verifyOTP: (phone: string, code: string, role: string = "admin") =>
    api.post("/auth/verify-otp", { phone, code, role }),
  checkPhone: (phone: string) =>
    api.get(`/auth/check-phone?phone=${encodeURIComponent(phone)}`),
  refreshToken: (refreshToken: string) =>
    api.post("/auth/refresh", { refresh_token: refreshToken }),
  logout: () => api.post("/auth/logout"),
};

// Admin API
export const adminAPI = {
  getDashboardStats: () => api.get("/admin/dashboard/stats"),
  getAllOrders: (page = 1, limit = 20) =>
    api.get("/admin/orders", { params: { page, limit } }),
  getProfile: () => api.get("/admin/profile"),
  updateProfile: (data: any) => api.put("/admin/profile", data),
  reviewPayment: (orderId: string, approved: boolean, notes?: string) =>
    api.post(`/admin/orders/${orderId}/payment-review`, { approved, notes }),
};

// Restaurant API
export const restaurantAPI = {
  getAll: (params?: any) => api.get("/restaurants", { params }),
  getById: (id: string) => api.get(`/restaurants/${id}`),
  create: (data: any) => api.post("/restaurants", data),
  update: (id: string, data: any) => api.put(`/restaurants/${id}`, data),
  delete: (id: string) => api.delete(`/restaurants/${id}`),
  getMenu: (id: string) => api.get(`/restaurants/${id}/menu`),
  edit: (id: string, data: any) => api.put(`/restaurants/${id}`, data),
};

// Menu API
export const menuAPI = {
  create: (restaurantId: string, data: any) =>
    api.post(`/restaurants/${restaurantId}/menu`, data),
  update: (restaurantId: string, itemId: string, data: any) =>
    api.put(`/restaurants/${restaurantId}/menu/${itemId}`, data),
  delete: (restaurantId: string, itemId: string) =>
    api.delete(`/restaurants/${restaurantId}/menu/${itemId}`),
  toggleAvailability: (
    restaurantId: string,
    itemId: string,
    available: boolean,
  ) =>
    api.patch(`/restaurants/${restaurantId}/menu/${itemId}/availability`, {
      is_available: available,
    }),
};

// Upload API
export const uploadAPI = {
  uploadImage: (formData: FormData) => {
    return api.post("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  uploadMultipleImages: (formData: FormData) => {
    return api.post("/upload/multiple", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// Order API (admin)
export const orderAPI = {
  getAll: (params?: any) => api.get("/orders", { params }),
  getById: (id: string) => api.get(`/orders/${id}`),
  updateStatus: (id: string, status: string) =>
    api.put(`/orders/${id}/status`, { status }),
};

// Driver API – routes are under /admin/drivers (admin-protected)
export const driverAPI = {
  getAll: () => api.get("/admin/drivers"),
  getById: (id: string) => api.get(`/admin/drivers/${id}`),
  create: (data: {
    phone: string;
    name: string;
    vehicleType: string;
    vehicleModel?: string;
    vehicleColor?: string;
    licensePlate?: string;
  }) => api.post("/admin/drivers", data),
  updateStatus: (id: string, status: string) =>
    api.put(`/admin/drivers/${id}/status`, { status }),
};

export default api;
