// lib/api/interceptor.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";
import { Alert } from "react-native";

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

api.interceptors.request.use(
  async (config: any) => {
    const token = await AsyncStorage.getItem("userToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api.request(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await AsyncStorage.getItem("refreshToken");
        const response = await api.refreshToken(refreshToken!);

        const { token, refresh_token } = response;

        await AsyncStorage.setItem("userToken", token);
        if (refresh_token) {
          await AsyncStorage.setItem("refreshToken", refresh_token);
        }

        processQueue(null, token);
        isRefreshing = false;

        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api.request(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;

        // Logout user
        await AsyncStorage.removeItem("userToken");
        await AsyncStorage.removeItem("refreshToken");
        await AsyncStorage.removeItem("userData");

        Alert.alert(
          "Session Expired",
          "Your session has expired. Please login again.",
          [{ text: "OK" }]
        );

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
