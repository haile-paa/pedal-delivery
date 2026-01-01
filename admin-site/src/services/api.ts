import axios from "axios";

const API_URL = "http://localhost:8080/api/v1";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("admin_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login if unauthorized
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  // OTP endpoints
  sendOTP: (phone: string, role: string = "admin") =>
    api.post("/auth/send-otp", { phone, role }),

  verifyOTP: (phone: string, code: string, role: string = "admin") =>
    api.post("/auth/verify-otp", { phone, code, role }),

  // Check if phone exists
  checkPhone: (phone: string) =>
    api.get(`/auth/check-phone?phone=${encodeURIComponent(phone)}`),

  // Refresh token
  refreshToken: (refreshToken: string) =>
    api.post("/auth/refresh", { refresh_token: refreshToken }),

  logout: () => api.post("/auth/logout"),
};

export const restaurantAPI = {
  getAll: (params?: any) => api.get("/restaurants", { params }),
  getById: (id: string) => api.get(`/restaurants/${id}`),
  create: (data: any) => api.post("/restaurants", data),
  update: (id: string, data: any) => api.put(`/restaurants/${id}`, data),
  delete: (id: string) => api.delete(`/restaurants/${id}`),
  getMenu: (id: string) => api.get(`/restaurants/${id}/menu`),
  edit: (id: string, data: any) => api.put(`/restaurants/${id}`, data),
};
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
    available: boolean
  ) =>
    api.patch(`/restaurants/${restaurantId}/menu/${itemId}/availability`, {
      is_available: available,
    }),
};
export const uploadAPI = {
  // Upload single image
  uploadImage: (formData: FormData) => {
    return api.post("/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  // Upload multiple images
  uploadMultipleImages: (formData: FormData) => {
    return api.post("/upload/multiple", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },
};

export const orderAPI = {
  getAll: (params?: any) => api.get("/orders", { params }),
  getById: (id: string) => api.get(`/orders/${id}`),
  updateStatus: (id: string, status: string) =>
    api.put(`/orders/${id}/status`, { status }),
};

export const driverAPI = {
  getAll: () => api.get("/drivers"),
  getById: (id: string) => api.get(`/drivers/${id}`),
  updateStatus: (id: string, status: string) =>
    api.put(`/drivers/${id}/status`, { status }),
};

export default api;
