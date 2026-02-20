import React, { createContext, useState, useContext, useEffect } from "react";
import { authAPI } from "../services/api";

interface AuthContextType {
  user: any | null;
  loading: boolean;
  sendOTP: (phone: string, role?: string) => Promise<void>;
  verifyOTP: (phone: string, code: string, role?: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem("admin_token");
      const userData = localStorage.getItem("admin_user");

      if (token && userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error("Auth check error:", error);
    } finally {
      setLoading(false);
    }
  };

  const sendOTP = async (phone: string, role: string = "admin") => {
    try {
      // Normalize phone number for Ethiopia
      let normalizedPhone = phone.trim();

      // Add country code if missing
      if (!normalizedPhone.startsWith("+")) {
        if (normalizedPhone.startsWith("0")) {
          normalizedPhone = "+251" + normalizedPhone.substring(1);
        } else if (
          normalizedPhone.startsWith("9") &&
          normalizedPhone.length === 9
        ) {
          normalizedPhone = "+251" + normalizedPhone;
        } else {
          normalizedPhone = "+" + normalizedPhone;
        }
      }

      const response = await authAPI.sendOTP(normalizedPhone, role);

      // Store phone for verification step
      localStorage.setItem("pending_phone", normalizedPhone);
      localStorage.setItem("pending_role", role);

      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || "Failed to send OTP");
    }
  };

  const verifyOTP = async (
    phone: string,
    code: string,
    role: string = "admin",
  ) => {
    try {
      const response = await authAPI.verifyOTP(phone, code, role);

      if (response.data.exists && response.data.tokens) {
        const { tokens, user: userData } = response.data;

        // Store tokens and user data
        localStorage.setItem("admin_token", tokens.accessToken);
        localStorage.setItem("admin_refresh_token", tokens.refreshToken);
        localStorage.setItem("admin_user", JSON.stringify(userData));

        // Clear pending data
        localStorage.removeItem("pending_phone");
        localStorage.removeItem("pending_role");

        setUser(userData);
      } else {
        throw new Error("User not found. Please register first.");
      }

      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || "Invalid OTP");
    }
  };

  const logout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_refresh_token");
    localStorage.removeItem("admin_user");
    localStorage.removeItem("pending_phone");
    localStorage.removeItem("pending_role");
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        sendOTP,
        verifyOTP,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
