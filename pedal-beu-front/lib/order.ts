import api from "./api";
import { Order } from "../src/types";

export const orderAPI = {
  createOrder: async (
    data: any
  ): Promise<{ success: boolean; data?: Order; error?: string }> => {
    try {
      const response = await api.post("/orders", data);
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || "Failed to create order",
      };
    }
  },

  getOrders: async (): Promise<{
    success: boolean;
    data: Order[];
    error?: string;
  }> => {
    try {
      const response = await api.get("/orders");
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        data: [],
        error: error.response?.data?.error || "Failed to fetch orders",
      };
    }
  },

  getOrderById: async (
    id: string
  ): Promise<{ success: boolean; data?: Order; error?: string }> => {
    try {
      const response = await api.get(`/orders/${id}`);
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || "Failed to fetch order",
      };
    }
  },

  cancelOrder: async (
    id: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      await api.post(`/orders/${id}/cancel`, { reason });
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || "Failed to cancel order",
      };
    }
  },
};
