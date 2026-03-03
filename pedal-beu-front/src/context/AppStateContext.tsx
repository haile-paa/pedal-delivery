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
  OrderItem,
  OrderEvent,
} from "../types";
import { authAPI, checkAuth, orderAPI } from "../../lib/api";
import { restaurantAPI } from "../../lib/restaurant";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  currentLocation: { latitude: number; longitude: number } | null;
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
  | { type: "ADD_ORDER"; payload: Order };

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
    earnings: { today: 0, this_week: 0, this_month: 0, total: 0, pending: 0 },
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

const cartItemsMatch = (item1: CartItem, item2: CartItem): boolean => {
  if (item1.id !== item2.id) return false;
  const addons1 = item1.selected_addons.map((a) => a.id).sort();
  const addons2 = item2.selected_addons.map((a) => a.id).sort();
  return JSON.stringify(addons1) === JSON.stringify(addons2);
};

const normalizeUser = (backendUser: any): User => ({
  id: backendUser.id || backendUser._id,
  phone: backendUser.phone,
  email: backendUser.email,
  role: backendUser.role?.type || backendUser.role,
  name: backendUser.profile?.first_name || backendUser.username || "",
  profile: {
    first_name: backendUser.profile?.first_name || "",
    last_name: backendUser.profile?.last_name || "",
    avatar: backendUser.profile?.avatar,
    addresses: backendUser.profile?.addresses || [],
  },
  is_verified: backendUser.is_verified || false,
  created_at: backendUser.created_at,
  updated_at: backendUser.updated_at,
});

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
      const existingItem = currentCart.find((item) =>
        cartItemsMatch(item, action.payload),
      );
      if (existingItem) {
        const updatedCart = currentCart.map((item) =>
          cartItemsMatch(item, action.payload)
            ? { ...item, quantity: item.quantity + action.payload.quantity }
            : item,
        );
        return { ...state, customer: { ...state.customer, cart: updatedCart } };
      }
      return {
        ...state,
        customer: { ...state.customer, cart: [...currentCart, action.payload] },
      };
    }
    case "REMOVE_FROM_CART": {
      const filtered = (state.customer.cart || []).filter((item) => {
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
      const updated = (state.customer.cart || [])
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
      if (!action.payload?.orderId || !action.payload?.status) return state;
      try {
        const customerOrders = state.customer.orders || [];
        const driverOrders = state.driver.availableOrders || [];
        const currentOrder = state.driver.currentOrder;
        const updatedCustomer = customerOrders.map((o) =>
          o?.id === action.payload.orderId
            ? { ...o, status: action.payload.status as any }
            : o,
        );
        const updatedDriver = driverOrders.map((o) =>
          o?.id === action.payload.orderId
            ? { ...o, status: action.payload.status as any }
            : o,
        );
        const updatedCurrent =
          currentOrder?.id === action.payload.orderId
            ? { ...currentOrder, status: action.payload.status as any }
            : currentOrder;
        return {
          ...state,
          customer: { ...state.customer, orders: updatedCustomer },
          driver: {
            ...state.driver,
            availableOrders: updatedDriver,
            currentOrder: updatedCurrent,
          },
        };
      } catch (error) {
        console.error("Error in UPDATE_ORDER_STATUS:", error);
        return state;
      }
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
      const currentOrders = state.customer.orders || [];
      return {
        ...state,
        customer: {
          ...state.customer,
          orders: [action.payload, ...currentOrders],
        },
      };
    }
    case "UPDATE_RESTAURANT": {
      const currentRestaurants = state.restaurants.list || [];
      return {
        ...state,
        restaurants: {
          ...state.restaurants,
          list: currentRestaurants.map((r) =>
            r?.id === action.payload.id ? action.payload : r,
          ),
          currentRestaurant:
            state.restaurants.currentRestaurant?.id === action.payload.id
              ? action.payload
              : state.restaurants.currentRestaurant,
        },
      };
    }
    default:
      return state;
  }
};

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

export const AppStateProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

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
                token,
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
        }
      } catch (error) {
        console.error("Error loading user:", error);
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    };
    loadUser();
  }, []);

  const loadUserProfile = async () => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      const response = await authAPI.getProfile();
      if (response) dispatch({ type: "UPDATE_USER", payload: response });
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const loadCustomerOrders = async () => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      const response = await orderAPI.getCustomerOrders(1, 10);
      const ordersArray = response.orders || [];
      dispatch({ type: "SET_CUSTOMER_ORDERS", payload: ordersArray });
    } catch (error) {
      console.error("Error loading orders:", error);
      dispatch({ type: "SET_CUSTOMER_ORDERS", payload: [] });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const loadDriverOrders = async () => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      // TODO: Implement driver orders API
      dispatch({ type: "SET_DRIVER_ORDERS", payload: [] });
    } catch (error) {
      console.error("Error loading driver orders:", error);
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
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
        const restaurants: Restaurant[] = response.data.map(
          (restaurant: any) => ({
            id: restaurant.id || restaurant._id || "",
            owner_id: restaurant.owner_id || "",
            name: restaurant.name || "",
            description: restaurant.description || "",
            cuisine_type: restaurant.cuisine_type || [],
            location: restaurant.location || {
              type: "Point",
              coordinates: [0, 0],
            },
            address: restaurant.address || "",
            phone: restaurant.phone || "",
            email: restaurant.email || "",
            images: restaurant.images || [],
            menu: restaurant.menu || [],
            is_active: restaurant.is_active ?? true,
            is_verified: restaurant.is_verified ?? false,
            rating: restaurant.rating || 0,
            total_reviews: restaurant.total_reviews || 0,
            opening_hours: restaurant.opening_hours || {
              monday: [],
              tuesday: [],
              wednesday: [],
              thursday: [],
              friday: [],
              saturday: [],
              sunday: [],
            },
            delivery_fee: restaurant.delivery_fee || 0,
            min_order: restaurant.min_order || 0,
            delivery_time: restaurant.delivery_time || 30,
            created_at: restaurant.created_at || new Date().toISOString(),
            updated_at: restaurant.updated_at || new Date().toISOString(),
          }),
        );
        dispatch({ type: "SET_RESTAURANTS", payload: restaurants });
      } else {
        dispatch({ type: "SET_RESTAURANTS", payload: [] });
      }
    } catch (error) {
      console.error("Error loading restaurants:", error);
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
        (r: Restaurant) => r.id === restaurantId,
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
      console.error("Error loading restaurant details:", error);
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
        return response.data.map((restaurant: any) => ({
          id: restaurant.id || restaurant._id || "",
          owner_id: restaurant.owner_id || "",
          name: restaurant.name || "",
          description: restaurant.description || "",
          cuisine_type: restaurant.cuisine_type || [],
          location: restaurant.location || {
            type: "Point",
            coordinates: [0, 0],
          },
          address: restaurant.address || "",
          phone: restaurant.phone || "",
          email: restaurant.email || "",
          images: restaurant.images || [],
          menu: restaurant.menu || [],
          is_active: restaurant.is_active ?? true,
          is_verified: restaurant.is_verified ?? false,
          rating: restaurant.rating || 0,
          total_reviews: restaurant.total_reviews || 0,
          opening_hours: restaurant.opening_hours || {
            monday: [],
            tuesday: [],
            wednesday: [],
            thursday: [],
            friday: [],
            saturday: [],
            sunday: [],
          },
          delivery_fee: restaurant.delivery_fee || 0,
          min_order: restaurant.min_order || 0,
          delivery_time: restaurant.delivery_time || 30,
          created_at: restaurant.created_at || new Date().toISOString(),
          updated_at: restaurant.updated_at || new Date().toISOString(),
        }));
      }
      return [];
    } catch (error) {
      console.error("Error searching restaurants:", error);
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
      console.error("Error loading restaurant menu:", error);
      return [];
    }
  };

  const updateDriverStatus = async (isOnline: boolean) => {
    try {
      dispatch({ type: "SET_DRIVER_ONLINE", payload: isOnline });
    } catch (error) {
      console.error("Error updating driver status:", error);
      throw error;
    }
  };

  const createOrder = async (orderData: any): Promise<Order> => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });

      const items = (state.customer.cart || []).map((cartItem: CartItem) => ({
        menu_item_id: cartItem.menu_item.id,
        quantity: cartItem.quantity,
        addons: cartItem.selected_addons.map((addon: any) => ({
          addon_id: addon.id,
        })),
        notes: cartItem.special_instructions,
      }));

      const payload = {
        restaurant_id: orderData.restaurant_id,
        items,
        address_id: orderData.address_id,
        notes: orderData.notes,
        payment_method: orderData.payment_method || "cash",
      };

      console.log("📤 createOrder payload:", payload);
      const response = await orderAPI.createOrder(payload);
      console.log("📥 createOrder raw response:", response);

      const newOrder = response.data || response;
      if (!newOrder || !newOrder._id) {
        throw new Error("Invalid response from server: missing order ID");
      }

      const frontendOrder: Order = {
        id: newOrder._id || newOrder.id,
        order_number: newOrder.order_number,
        customer_id: newOrder.customer_id,
        restaurant_id: newOrder.restaurant_id,
        items: newOrder.items,
        status: newOrder.status,
        total_amount: newOrder.total_amount,
        delivery_info: newOrder.delivery_info,
        timeline: newOrder.timeline,
        payment_method: newOrder.payment_method,
        payment_status: newOrder.payment_status,
        is_scheduled: newOrder.is_scheduled,
        scheduled_for: newOrder.scheduled_for,
        created_at: newOrder.created_at,
        updated_at: newOrder.updated_at,
      };

      console.log("✅ Created order:", frontendOrder);

      const currentOrders = state.customer.orders || [];
      dispatch({
        type: "SET_CUSTOMER_ORDERS",
        payload: [frontendOrder, ...currentOrders],
      });

      dispatch({ type: "CLEAR_CART" });

      return frontendOrder;
    } catch (error) {
      console.error("❌ Error creating order:", error);
      throw error;
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
      console.error("Error updating profile:", error);
      throw error;
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
      dispatch({ type: "LOGOUT" });
    } catch (error) {
      console.error("Error logging out:", error);
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
  if (!context)
    throw new Error("useAppState must be used within AppStateProvider");
  return context;
};
