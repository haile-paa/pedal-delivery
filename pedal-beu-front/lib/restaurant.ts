// lib/restaurant.ts
import api from "./api";
import { Restaurant, MenuItem, Addon } from "../src/types";

// Retry function for network requests
const retryRequest = async <T>(
  requestFn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
): Promise<T> => {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error: any) {
      lastError = error;

      // Only retry on network/timeout errors
      const shouldRetry =
        error.code === "ECONNABORTED" ||
        error.message === "Network Error" ||
        error.code === "ERR_NETWORK";

      if (!shouldRetry || attempt === maxRetries - 1) {
        throw error;
      }

      console.log(
        `Retry attempt ${attempt + 1}/${maxRetries} after error:`,
        error.message,
      );
      await new Promise((resolve) =>
        setTimeout(resolve, delayMs * (attempt + 1)),
      );
    }
  }

  throw lastError;
};

export const restaurantAPI = {
  // lib/restaurant.ts
  getAll: async (params?: any) => {
    try {
      console.log("restaurantAPI.getAll called with params:", params);

      const queryParams: any = {
        page: params?.page || 1,
        limit: params?.limit || 20,
      };

      if (params?.category) {
        queryParams.category = params.category;
      }

      if (params?.location) {
        queryParams.latitude = params.location.latitude;
        queryParams.longitude = params.location.longitude;
        params.radius = params.location.radius || 10000;
        queryParams.calculate_distance = true;
      }

      console.log(
        "Making API request to /restaurants with params:",
        queryParams,
      );

      // Wrap the API call with retry logic
      const response = await retryRequest(
        () =>
          api.get("/restaurants", {
            params: queryParams,
            timeout: 30000, // Increased from 10000 to 30000
          }),
        3, // max retries
        1000, // initial delay
      );

      console.log("API Response received:", {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
      });

      // Handle the response structure
      const responseData = response.data;

      // Check if data is null or undefined
      if (!responseData || !responseData.data) {
        console.log("No data in response, returning empty array");
        return {
          success: true,
          data: [],
          pagination: responseData?.pagination || {
            page: 1,
            limit: 20,
            total: 0,
            total_pages: 0,
          },
        };
      }

      // Data might be null or an array
      const rawData = responseData.data;
      let restaurants: Restaurant[] = [];

      if (Array.isArray(rawData)) {
        console.log(`Received ${rawData.length} restaurants`);

        // Map the data
        restaurants = rawData.map((item: any) => {
          // If the item has a restaurant property (when calculate_distance is true)
          if (item.restaurant) {
            return {
              id: item.restaurant.id || item.restaurant._id || "",
              owner_id: item.restaurant.owner_id || "",
              name: item.restaurant.name || "",
              description: item.restaurant.description || "",
              cuisine_type: item.restaurant.cuisine_type || [],
              location: item.restaurant.location || {
                type: "Point",
                coordinates: [0, 0],
              },
              address: item.restaurant.address || "",
              phone: item.restaurant.phone || "",
              email: item.restaurant.email || "",
              images: item.restaurant.images || [],
              menu: item.restaurant.menu || [],
              is_active: item.restaurant.is_active ?? true,
              is_verified: item.restaurant.is_verified ?? false,
              rating: item.restaurant.rating || 0,
              total_reviews: item.restaurant.total_reviews || 0,
              opening_hours: item.restaurant.opening_hours || {},
              delivery_fee: item.restaurant.delivery_fee || 0,
              min_order: item.restaurant.min_order || 0,
              delivery_time: item.restaurant.delivery_time || 30,
              created_at:
                item.restaurant.created_at || new Date().toISOString(),
              updated_at:
                item.restaurant.updated_at || new Date().toISOString(),
              distance_km: item.distance_km,
              distance_m: item.distance_m,
            };
          } else {
            // Regular restaurant object
            return {
              id: item.id || item._id || "",
              owner_id: item.owner_id || "",
              name: item.name || "",
              description: item.description || "",
              cuisine_type: item.cuisine_type || [],
              location: item.location || {
                type: "Point",
                coordinates: [0, 0],
              },
              address: item.address || "",
              phone: item.phone || "",
              email: item.email || "",
              images: item.images || [],
              menu: item.menu || [],
              is_active: item.is_active ?? true,
              is_verified: item.is_verified ?? false,
              rating: item.rating || 0,
              total_reviews: item.total_reviews || 0,
              opening_hours: item.opening_hours || {},
              delivery_fee: item.delivery_fee || 0,
              min_order: item.min_order || 0,
              delivery_time: item.delivery_time || 30,
              created_at: item.created_at || new Date().toISOString(),
              updated_at: item.updated_at || new Date().toISOString(),
            };
          }
        });
      } else {
        console.log("Response data is not an array:", rawData);
      }

      console.log(`Mapped ${restaurants.length} restaurants`);

      return {
        success: true,
        data: restaurants,
        pagination: responseData.pagination || {
          page: 1,
          limit: 20,
          total: 0,
          total_pages: 0,
        },
      };
    } catch (error: any) {
      // Don't log as error if it's a network/timeout error
      if (
        error.code === "ECONNABORTED" ||
        error.message === "Network Error" ||
        error.code === "ERR_NETWORK"
      ) {
        console.log(
          "Network/timeout error in restaurantAPI.getAll after retries:",
          {
            message: error.message,
            code: error.code,
          },
        );
      } else {
        console.error("Error in restaurantAPI.getAll:", error);
      }

      return {
        success: false,
        data: [],
        error:
          error.response?.data?.error ||
          error.message ||
          "Failed to fetch restaurants",
      };
    }
  },

  // Get restaurant by ID with retry
  getById: async (id: string) => {
    try {
      console.log(`Fetching restaurant ${id}...`);
      const response = await retryRequest(
        () => api.get(`/restaurants/${id}`),
        2, // max retries
        500, // initial delay
      );
      console.log(`Restaurant ${id} response:`, response.data);
      return { success: true, data: response.data };
    } catch (error: any) {
      console.log(`Error fetching restaurant ${id}:`, error.message);
      return {
        success: false,
        error: error.response?.data?.error || "Failed to fetch restaurant",
      };
    }
  },

  // Get nearby restaurants with retry
  getNearby: async (
    latitude: number,
    longitude: number,
    radius: number = 10000, // Default 10km to match backend
  ): Promise<{ success: boolean; data: Restaurant[]; error?: string }> => {
    try {
      const response = await retryRequest(
        () =>
          api.get("/restaurants/nearby", {
            params: { latitude, longitude, radius },
          }),
        2,
        500,
      );
      return { success: true, data: response.data.data || response.data };
    } catch (error: any) {
      return {
        success: false,
        data: [],
        error:
          error.response?.data?.error || "Failed to fetch nearby restaurants",
      };
    }
  },

  // Search restaurants with retry
  search: async (
    query: string,
    location?: { latitude: number; longitude: number },
  ): Promise<{ success: boolean; data: Restaurant[]; error?: string }> => {
    try {
      const params: any = { q: query };
      if (location) {
        params.latitude = location.latitude;
        params.longitude = location.longitude;
      }
      const response = await retryRequest(
        () => api.get("/restaurants/search", { params }),
        2,
        500,
      );
      return { success: true, data: response.data.data || response.data };
    } catch (error: any) {
      return {
        success: false,
        data: [],
        error: error.response?.data?.error || "Failed to search restaurants",
      };
    }
  },

  // Get menu items for restaurant with retry
  getMenu: async (
    restaurantId: string,
  ): Promise<{ success: boolean; data: MenuItem[]; error?: string }> => {
    try {
      const response = await retryRequest(
        () => api.get(`/restaurants/${restaurantId}/menu`),
        2,
        500,
      );
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        data: [],
        error: error.response?.data?.error || "Failed to fetch menu",
      };
    }
  },

  // ... rest of the functions remain the same (Admin functions)
  createRestaurant: async (data: {
    name: string;
    description: string;
    cuisine_type: string[];
    address: string;
    latitude: number;
    longitude: number;
    phone: string;
    email?: string;
    delivery_fee: number;
    min_order: number;
    delivery_time: number;
  }): Promise<{ success: boolean; data?: Restaurant; error?: string }> => {
    try {
      const response = await retryRequest(
        () => api.post("/restaurants", data),
        2,
        500,
      );
      return {
        success: true,
        data: response.data.data || response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || "Failed to create restaurant",
      };
    }
  },

  updateRestaurant: async (
    id: string,
    data: Partial<Restaurant>,
  ): Promise<{ success: boolean; data?: Restaurant; error?: string }> => {
    try {
      const response = await retryRequest(
        () => api.put(`/restaurants/${id}`, data),
        2,
        500,
      );
      return { success: true, data: response.data.data || response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || "Failed to update restaurant",
      };
    }
  },

  addMenuItem: async (
    restaurantId: string,
    data: {
      name: string;
      description: string;
      price: number;
      category: string;
      ingredients: string[];
      addons?: Addon[];
      preparation_time: number;
      image?: string;
    },
  ): Promise<{ success: boolean; data?: MenuItem; error?: string }> => {
    try {
      const response = await retryRequest(
        () => api.post(`/restaurants/${restaurantId}/menu`, data),
        2,
        500,
      );
      return { success: true, data: response.data.data || response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || "Failed to add menu item",
      };
    }
  },

  updateMenuItem: async (
    restaurantId: string,
    itemId: string,
    data: Partial<MenuItem>,
  ): Promise<{ success: boolean; data?: MenuItem; error?: string }> => {
    try {
      const response = await retryRequest(
        () => api.put(`/restaurants/${restaurantId}/menu/${itemId}`, data),
        2,
        500,
      );
      return { success: true, data: response.data.data || response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || "Failed to update menu item",
      };
    }
  },

  deleteMenuItem: async (
    restaurantId: string,
    itemId: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      await retryRequest(
        () => api.delete(`/restaurants/${restaurantId}/menu/${itemId}`),
        2,
        500,
      );
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || "Failed to delete menu item",
      };
    }
  },
};
