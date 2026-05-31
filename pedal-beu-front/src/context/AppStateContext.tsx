// context/AppStateContext.tsx
import React, {
  createContext,
  useContext,
  useReducer,
  ReactNode,
  useEffect,
} from "react";
import {
  User,
  Order,
  CartItem,
  Address,
  Document,
  DriverEarnings,
  Restaurant,
  MenuItem,
} from "../types";
import { authAPI, checkAuth, orderAPI } from "../../lib/api";
import { restaurantAPI } from "../../lib/restaurant";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

// ----- Types (unchanged) -----

interface AppState {
  auth: {
    user: User | null;
    token: string | null;
    role: "customer" | "driver" | "admin" | null;
    isLoading: boolean;
    isAuthenticated: boolean;
  };
  customer: {
    cart: CartItem[];
    orders: Order[];
    addresses: Address[];
    favoriteRestaurants: string[];
    isLoading: boolean;
  };
  driver: {
    isOnline: boolean;
    currentOrder: Order | null;
    earnings: DriverEarnings;
    documents: Document[];
    availableOrders: Order[];
    isLoading: boolean;
  };
  restaurants: {
    list: Restaurant[];
    currentRestaurant: Restaurant | null;
    isLoading: boolean;
  };
  location: {
    currentLocation: {
      latitude: number;
      longitude: number;
    } | null;
    addresses: Address[];
    selectedAddress: Address | null;
  };
  ui: {
    loading: boolean;
    notifications: any[];
    error: string | null;
  };
}

export interface LocationState {
  currentLocation: {
    latitude: number;
    longitude: number;
  } | null;
  addresses: Address[];
  selectedAddress: Address | null;
}

type AppAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | {
      type: "LOGIN_SUCCESS";
      payload: { user: User; token: string; role: "customer" | "driver" };
    }
  | { type: "LOGOUT" }
  | { type: "UPDATE_USER"; payload: User }
  | { type: "ADD_TO_CART"; payload: CartItem }
  | {
      type: "REMOVE_FROM_CART";
      payload: { id: string; selectedAddonsIds?: string[] };
    }
  | {
      type: "UPDATE_CART_QUANTITY";
      payload: { id: string; selectedAddonsIds?: string[]; quantity: number };
    }
  | { type: "CLEAR_CART" }
  | { type: "SET_DRIVER_ONLINE"; payload: boolean }
  | { type: "SET_CURRENT_ORDER"; payload: Order | null }
  | { type: "SET_CUSTOMER_ORDERS"; payload: Order[] }
  | { type: "SET_DRIVER_ORDERS"; payload: Order[] }
  | {
      type: "UPDATE_ORDER_STATUS";
      payload: { orderId: string; status: string };
    }
  | { type: "ADD_NOTIFICATION"; payload: any }
  | { type: "SET_RESTAURANTS"; payload: Restaurant[] }
  | { type: "SET_CURRENT_RESTAURANT"; payload: Restaurant | null }
  | { type: "SET_RESTAURANTS_LOADING"; payload: boolean }
  | { type: "UPDATE_RESTAURANT"; payload: Restaurant }
  | { type: "SET_LOCATION"; payload: { latitude: number; longitude: number } }
  | { type: "SET_ADDRESSES"; payload: Address[] }
  | { type: "SELECT_ADDRESS"; payload: Address | null }
  | { type: "ADD_ORDER"; payload: Order }
  | { type: "SET_CUSTOMER_LOADING"; payload: boolean }
  | { type: "SET_DRIVER_LOADING"; payload: boolean };

const initialState: AppState = {
  auth: {
    user: null,
    token: null,
    role: null,
    isLoading: true,
    isAuthenticated: false,
  },
  customer: {
    cart: [],
    orders: [],
    addresses: [],
    favoriteRestaurants: [],
    isLoading: false,
  },
  driver: {
    isOnline: false,
    currentOrder: null,
    earnings: {
      today: 0,
      this_week: 0,
      this_month: 0,
      total: 0,
      pending: 0,
    },
    documents: [],
    availableOrders: [],
    isLoading: false,
  },
  restaurants: {
    list: [],
    currentRestaurant: null,
    isLoading: false,
  },
  location: {
    currentLocation: null,
    addresses: [],
    selectedAddress: null,
  },
  ui: {
    loading: false,
    notifications: [],
    error: null,
  },
};

// ----- Silenced logger -----
const logError = __DEV__ ? console.error : () => {};

// ----- Normalize helpers -----
const cartItemsMatch = (item1: CartItem, item2: CartItem): boolean => {
  if (item1.id !== item2.id) return false;
  const addons1 = item1.selected_addons.map((a) => a.id).sort();
  const addons2 = item2.selected_addons.map((a) => a.id).sort();
  return JSON.stringify(addons1) === JSON.stringify(addons2);
};

const normalizeUser = (backendUser: any): User => {
  const firstName =
    backendUser.firstName ||
    backendUser.first_name ||
    backendUser.profile?.first_name ||
    backendUser.profile?.firstName ||
    backendUser.username ||
    "";
  return {
    id: backendUser.id || backendUser._id,
    phone: backendUser.phone,
    email: backendUser.email || "",
    role: backendUser.role?.type || backendUser.role,
    name: firstName,
    firstName: firstName,
    profile: {
      first_name: firstName,
      last_name: backendUser.profile?.last_name || backendUser.lastName || "",
      avatar: backendUser.profile?.avatar || undefined,
      addresses: backendUser.profile?.addresses || [],
    },
    is_verified: backendUser.is_verified ?? false,
    created_at: backendUser.created_at || "",
    updated_at: backendUser.updated_at || "",
  };
};

// ----- Reducer -----
const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, ui: { ...state.ui, loading: action.payload } };
    case "SET_ERROR":
      return { ...state, ui: { ...state.ui, error: action.payload } };
    case "LOGIN_SUCCESS":
      return {
        ...state,
        auth: {
          user: normalizeUser(action.payload.user),
          token: action.payload.token,
          role: action.payload.role,
          isLoading: false,
          isAuthenticated: true,
        },
      };
    case "LOGOUT":
      return {
        ...initialState,
        auth: { ...initialState.auth, isLoading: false },
      };
    case "UPDATE_USER":
      return {
        ...state,
        auth: { ...state.auth, user: normalizeUser(action.payload) },
      };
    case "ADD_TO_CART": {
      const currentCart = state.customer.cart || [];
      const existing = currentCart.find((item) =>
        cartItemsMatch(item, action.payload),
      );
      if (existing) {
        const updated = currentCart.map((item) =>
          cartItemsMatch(item, action.payload)
            ? { ...item, quantity: item.quantity + action.payload.quantity }
            : item,
        );
        return { ...state, customer: { ...state.customer, cart: updated } };
      }
      return {
        ...state,
        customer: { ...state.customer, cart: [...currentCart, action.payload] },
      };
    }
    case "REMOVE_FROM_CART": {
      const cart = state.customer.cart || [];
      const filtered = cart.filter((item) => {
        if (action.payload.selectedAddonsIds) {
          const itemAddonIds = item.selected_addons.map((a) => a.id).sort();
          const targetAddonIds = action.payload.selectedAddonsIds.sort();
          return !(
            item.id === action.payload.id &&
            JSON.stringify(itemAddonIds) === JSON.stringify(targetAddonIds)
          );
        }
        return item.id !== action.payload.id;
      });
      return { ...state, customer: { ...state.customer, cart: filtered } };
    }
    case "UPDATE_CART_QUANTITY": {
      const cart = state.customer.cart || [];
      const updated = cart
        .map((item) => {
          if (action.payload.selectedAddonsIds) {
            const itemAddonIds = item.selected_addons.map((a) => a.id).sort();
            const targetAddonIds = action.payload.selectedAddonsIds.sort();
            if (
              item.id === action.payload.id &&
              JSON.stringify(itemAddonIds) === JSON.stringify(targetAddonIds)
            ) {
              return { ...item, quantity: action.payload.quantity };
            }
          } else if (item.id === action.payload.id) {
            return { ...item, quantity: action.payload.quantity };
          }
          return item;
        })
        .filter((item) => item.quantity > 0);
      return { ...state, customer: { ...state.customer, cart: updated } };
    }
    case "CLEAR_CART":
      return { ...state, customer: { ...state.customer, cart: [] } };
    case "SET_DRIVER_ONLINE":
      return {
        ...state,
        driver: { ...state.driver, isOnline: action.payload },
      };
    case "SET_CURRENT_ORDER":
      return {
        ...state,
        driver: { ...state.driver, currentOrder: action.payload },
      };
    case "SET_CUSTOMER_ORDERS":
      return {
        ...state,
        customer: {
          ...state.customer,
          orders: Array.isArray(action.payload) ? action.payload : [],
          isLoading: false,
        },
      };
    case "SET_DRIVER_ORDERS":
      return {
        ...state,
        driver: {
          ...state.driver,
          availableOrders: Array.isArray(action.payload) ? action.payload : [],
          isLoading: false,
        },
      };
    case "UPDATE_ORDER_STATUS": {
      if (!action.payload?.orderId || !action.payload?.status) {
        logError(
          "UPDATE_ORDER_STATUS received invalid payload",
          action.payload,
        );
        return state;
      }
      const custOrders = (state.customer.orders || []).map((o) =>
        o?.id === action.payload.orderId
          ? { ...o, status: action.payload.status as any }
          : o,
      );
      const drvOrders = (state.driver.availableOrders || []).map((o) =>
        o?.id === action.payload.orderId
          ? { ...o, status: action.payload.status as any }
          : o,
      );
      const curOrder =
        state.driver.currentOrder?.id === action.payload.orderId
          ? {
              ...state.driver.currentOrder,
              status: action.payload.status as any,
            }
          : state.driver.currentOrder;
      return {
        ...state,
        customer: { ...state.customer, orders: custOrders },
        driver: {
          ...state.driver,
          availableOrders: drvOrders,
          currentOrder: curOrder,
        },
      };
    }
    case "ADD_NOTIFICATION":
      return {
        ...state,
        ui: {
          ...state.ui,
          notifications: [action.payload, ...(state.ui.notifications || [])],
        },
      };
    case "SET_RESTAURANTS":
      return {
        ...state,
        restaurants: {
          ...state.restaurants,
          list: Array.isArray(action.payload) ? action.payload : [],
          isLoading: false,
        },
      };
    case "SET_CURRENT_RESTAURANT":
      return {
        ...state,
        restaurants: {
          ...state.restaurants,
          currentRestaurant: action.payload,
        },
      };
    case "SET_RESTAURANTS_LOADING":
      return {
        ...state,
        restaurants: { ...state.restaurants, isLoading: action.payload },
      };
    case "SET_LOCATION":
      return {
        ...state,
        location: { ...state.location, currentLocation: action.payload },
      };
    case "SET_ADDRESSES":
      return {
        ...state,
        location: {
          ...state.location,
          addresses: Array.isArray(action.payload) ? action.payload : [],
        },
      };
    case "SELECT_ADDRESS":
      return {
        ...state,
        location: { ...state.location, selectedAddress: action.payload },
      };
    case "ADD_ORDER": {
      const orders = state.customer.orders || [];
      return {
        ...state,
        customer: { ...state.customer, orders: [action.payload, ...orders] },
      };
    }
    case "UPDATE_RESTAURANT": {
      const restaurants = state.restaurants.list || [];
      return {
        ...state,
        restaurants: {
          ...state.restaurants,
          list: restaurants.map((r) =>
            r?.id === action.payload.id ? action.payload : r,
          ),
          currentRestaurant:
            state.restaurants.currentRestaurant?.id === action.payload.id
              ? action.payload
              : state.restaurants.currentRestaurant,
        },
      };
    }
    case "SET_CUSTOMER_LOADING":
      return {
        ...state,
        customer: { ...state.customer, isLoading: action.payload },
      };
    case "SET_DRIVER_LOADING":
      return {
        ...state,
        driver: { ...state.driver, isLoading: action.payload },
      };
    default:
      return state;
  }
};

// ----- Context -----
const AppStateContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  actions: {
    loadUserProfile: () => Promise<void>;
    loadCustomerOrders: () => Promise<void>;
    loadDriverOrders: () => Promise<void>;
    loadRestaurants: (location?: {
      latitude: number;
      longitude: number;
    }) => Promise<void>;
    updateDriverStatus: (isOnline: boolean) => Promise<void>;
    createOrder: (orderData: any) => Promise<Order>;
    updateProfile: (data: any) => Promise<void>;
    logout: () => Promise<void>;
    loadRestaurantDetails: (restaurantId: string) => Promise<Restaurant | null>;
    searchRestaurants: (
      query: string,
      location?: { latitude: number; longitude: number },
    ) => Promise<Restaurant[]>;
    getRestaurantMenu: (restaurantId: string) => Promise<MenuItem[]>;
  };
} | null>(null);

// ----- Provider -----
export const AppStateProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const router = useRouter();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const authStatus = await checkAuth();
        if (authStatus.isAuthenticated && authStatus.user) {
          const token = await AsyncStorage.getItem("accessToken");
          if (token) {
            dispatch({
              type: "LOGIN_SUCCESS",
              payload: {
                user: authStatus.user,
                token: token,
                role: authStatus.user.role as "customer" | "driver",
              },
            });
            if (authStatus.user.role === "customer") {
              await loadCustomerOrders();
              await loadRestaurants();
            } else if (authStatus.user.role === "driver") {
              await loadDriverOrders();
            }
          }
        } else {
          dispatch({ type: "LOGOUT" });
        }
      } catch (error) {
        logError("Error loading user:", error);
        dispatch({ type: "LOGOUT" });
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    };
    loadUser();
  }, []);

  // --- Actions ---
  const loadUserProfile = async () => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      const response = await authAPI.getProfile();
      if (response) dispatch({ type: "UPDATE_USER", payload: response });
    } catch (error: any) {
      logError("Error loading profile:", error);
      if (error.isAuthError || error.response?.status === 401) await logout();
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const loadCustomerOrders = async () => {
    try {
      dispatch({ type: "SET_CUSTOMER_LOADING", payload: true });
      const response = await orderAPI.getCustomerOrders(1, 10);
      const orders = response.orders || response.data || [];
      dispatch({ type: "SET_CUSTOMER_ORDERS", payload: orders });
    } catch (error: any) {
      logError("Error loading orders:", error);
      if (error.isAuthError || error.response?.status === 401) await logout();
      else dispatch({ type: "SET_CUSTOMER_ORDERS", payload: [] });
    } finally {
      dispatch({ type: "SET_CUSTOMER_LOADING", payload: false });
    }
  };

  // FIX 10: Implemented loadDriverOrders with real API call
  const loadDriverOrders = async () => {
    try {
      dispatch({ type: "SET_DRIVER_LOADING", payload: true });
      const response = await orderAPI.getDriverOrders(1, 20);
      const orders = response.orders || response.data || [];
      dispatch({ type: "SET_DRIVER_ORDERS", payload: orders });
    } catch (error: any) {
      logError("Error loading driver orders:", error);
      if (error.isAuthError || error.response?.status === 401) await logout();
      else dispatch({ type: "SET_DRIVER_ORDERS", payload: [] });
    } finally {
      dispatch({ type: "SET_DRIVER_LOADING", payload: false });
    }
  };

  const loadRestaurants = async (location?: {
    latitude: number;
    longitude: number;
  }) => {
    try {
      dispatch({ type: "SET_RESTAURANTS_LOADING", payload: true });
      const response = await restaurantAPI.getAll({
        page: 1,
        limit: 20,
        ...(location && { location: { ...location, radius: 10000 } }),
      });
      if (response.success && response.data.length > 0) {
        const restaurants: Restaurant[] = response.data.map((r: any) => ({
          id: r.id || r._id || "",
          owner_id: r.owner_id || "",
          name: r.name || "",
          description: r.description || "",
          cuisine_type: r.cuisine_type || [],
          location: r.location || { type: "Point", coordinates: [0, 0] },
          address: r.address || "",
          phone: r.phone || "",
          email: r.email || "",
          images: r.images || [],
          menu: r.menu || [],
          is_active: r.is_active ?? true,
          is_verified: r.is_verified ?? false,
          rating: r.rating || 0,
          total_reviews: r.total_reviews || 0,
          opening_hours: r.opening_hours || {
            monday: [],
            tuesday: [],
            wednesday: [],
            thursday: [],
            friday: [],
            saturday: [],
            sunday: [],
          },
          delivery_fee: r.delivery_fee || 0,
          min_order: r.min_order || 0,
          delivery_time: r.delivery_time || 30,
          created_at: r.created_at || new Date().toISOString(),
          updated_at: r.updated_at || new Date().toISOString(),
        }));
        dispatch({ type: "SET_RESTAURANTS", payload: restaurants });
      } else {
        dispatch({ type: "SET_RESTAURANTS", payload: [] });
      }
    } catch (error) {
      logError("Error loading restaurants:", error);
      dispatch({ type: "SET_RESTAURANTS", payload: [] });
    } finally {
      dispatch({ type: "SET_RESTAURANTS_LOADING", payload: false });
    }
  };

  const loadRestaurantDetails = async (
    restaurantId: string,
  ): Promise<Restaurant | null> => {
    try {
      dispatch({ type: "SET_RESTAURANTS_LOADING", payload: true });
      const existing = state.restaurants.list.find(
        (r) => r.id === restaurantId,
      );
      if (existing) {
        dispatch({ type: "SET_CURRENT_RESTAURANT", payload: existing });
        return existing;
      }
      const response = await restaurantAPI.getById(restaurantId);
      if (response.success && response.data) {
        const restaurant = response.data as Restaurant;
        dispatch({ type: "SET_CURRENT_RESTAURANT", payload: restaurant });
        return restaurant;
      }
      return null;
    } catch (error) {
      logError("Error loading restaurant details:", error);
      return null;
    } finally {
      dispatch({ type: "SET_RESTAURANTS_LOADING", payload: false });
    }
  };

  const searchRestaurants = async (
    query: string,
    location?: { latitude: number; longitude: number },
  ): Promise<Restaurant[]> => {
    try {
      const response = await restaurantAPI.search(query, location);
      if (response.success) {
        return response.data.map((r: any) => ({
          id: r.id || r._id || "",
          owner_id: r.owner_id || "",
          name: r.name || "",
          description: r.description || "",
          cuisine_type: r.cuisine_type || [],
          location: r.location || { type: "Point", coordinates: [0, 0] },
          address: r.address || "",
          phone: r.phone || "",
          email: r.email || "",
          images: r.images || [],
          menu: r.menu || [],
          is_active: r.is_active ?? true,
          is_verified: r.is_verified ?? false,
          rating: r.rating || 0,
          total_reviews: r.total_reviews || 0,
          opening_hours: r.opening_hours || {
            monday: [],
            tuesday: [],
            wednesday: [],
            thursday: [],
            friday: [],
            saturday: [],
            sunday: [],
          },
          delivery_fee: r.delivery_fee || 0,
          min_order: r.min_order || 0,
          delivery_time: r.delivery_time || 30,
          created_at: r.created_at || new Date().toISOString(),
          updated_at: r.updated_at || new Date().toISOString(),
        }));
      }
      return [];
    } catch (error) {
      logError("Error searching restaurants:", error);
      return [];
    }
  };

  const getRestaurantMenu = async (
    restaurantId: string,
  ): Promise<MenuItem[]> => {
    try {
      const response = await restaurantAPI.getMenu(restaurantId);
      if (response.success) return response.data;
      return [];
    } catch (error) {
      logError("Error loading menu:", error);
      return [];
    }
  };

  const updateDriverStatus = async (isOnline: boolean) => {
    try {
      dispatch({ type: "SET_DRIVER_ONLINE", payload: isOnline });
      // optionally call backend to update status
    } catch (error) {
      logError("Error updating driver status:", error);
    }
  };

  const createOrder = async (orderData: any): Promise<Order> => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      const payload = {
        restaurant_id: orderData.restaurant_id,
        items: (state.customer.cart || []).map((item) => ({
          menu_item_id: item.menu_item.id,
          quantity: item.quantity,
          addons: item.selected_addons.map((a) => ({ addon_id: a.id })),
          notes: item.special_instructions || "",
        })),
        address_id: orderData.address_id,
        payment_method: orderData.payment_method,
        notes: orderData.notes || "",
      };
      const serverOrder: Order = await orderAPI.createOrder(payload);
      dispatch({ type: "ADD_ORDER", payload: serverOrder });
      dispatch({ type: "CLEAR_CART" });
      return serverOrder;
    } catch (error: any) {
      logError("Error creating order:", error);
      throw new Error(error.message || "Failed to create order");
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const updateProfile = async (data: any) => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      const response = await authAPI.updateProfile(data);
      if (response) dispatch({ type: "UPDATE_USER", payload: response });
    } catch (error) {
      logError("Error updating profile:", error);
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      logError("Error logging out:", error);
    } finally {
      await AsyncStorage.multiRemove(["accessToken", "refreshToken", "user"]);
      dispatch({ type: "LOGOUT" });
      router.replace("/(auth)/welcome");
    }
  };

  const actions = {
    loadUserProfile,
    loadCustomerOrders,
    loadDriverOrders,
    loadRestaurants,
    updateDriverStatus,
    createOrder,
    updateProfile,
    logout,
    loadRestaurantDetails,
    searchRestaurants,
    getRestaurantMenu,
  };

  return (
    <AppStateContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return context;
};
