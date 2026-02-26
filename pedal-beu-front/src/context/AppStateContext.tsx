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
import { authAPI, checkAuth } from "../../lib/api";
import { restaurantAPI } from "../../lib/restaurant";

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

// Helper function to compare cart items
const cartItemsMatch = (item1: CartItem, item2: CartItem): boolean => {
  if (item1.id !== item2.id) return false;

  const addons1 = item1.selected_addons.map((a) => a.id).sort();
  const addons2 = item2.selected_addons.map((a) => a.id).sort();

  return JSON.stringify(addons1) === JSON.stringify(addons2);
};

// Normalize user object from backend to frontend shape
const normalizeUser = (backendUser: any): User => {
  return {
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
  };
};

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case "SET_LOADING":
      return {
        ...state,
        ui: { ...state.ui, loading: action.payload },
      };

    case "SET_ERROR":
      return {
        ...state,
        ui: { ...state.ui, error: action.payload },
      };

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
        auth: {
          ...state.auth,
          user: normalizeUser(action.payload),
        },
      };

    case "ADD_TO_CART":
      const existingItem = state.customer.cart.find((item) =>
        cartItemsMatch(item, action.payload),
      );

      if (existingItem) {
        const updatedCart = state.customer.cart.map((item) =>
          cartItemsMatch(item, action.payload)
            ? { ...item, quantity: item.quantity + action.payload.quantity }
            : item,
        );
        return {
          ...state,
          customer: { ...state.customer, cart: updatedCart },
        };
      }

      return {
        ...state,
        customer: {
          ...state.customer,
          cart: [...state.customer.cart, action.payload],
        },
      };

    case "REMOVE_FROM_CART":
      const filteredCart = state.customer.cart.filter((item) => {
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
      return {
        ...state,
        customer: { ...state.customer, cart: filteredCart },
      };

    case "UPDATE_CART_QUANTITY":
      const updatedCart = state.customer.cart
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

      return {
        ...state,
        customer: { ...state.customer, cart: updatedCart },
      };

    case "CLEAR_CART":
      return {
        ...state,
        customer: { ...state.customer, cart: [] },
      };

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
          orders: action.payload,
          isLoading: false,
        },
      };

    case "SET_DRIVER_ORDERS":
      return {
        ...state,
        driver: {
          ...state.driver,
          availableOrders: action.payload,
          isLoading: false,
        },
      };

    case "UPDATE_ORDER_STATUS":
      const updatedCustomerOrders = state.customer.orders.map((order) =>
        order.id === action.payload.orderId
          ? { ...order, status: action.payload.status as any }
          : order,
      );

      const updatedDriverOrders = state.driver.availableOrders.map((order) =>
        order.id === action.payload.orderId
          ? { ...order, status: action.payload.status as any }
          : order,
      );

      return {
        ...state,
        customer: {
          ...state.customer,
          orders: updatedCustomerOrders,
        },
        driver: {
          ...state.driver,
          availableOrders: updatedDriverOrders,
          currentOrder:
            state.driver.currentOrder?.id === action.payload.orderId
              ? {
                  ...state.driver.currentOrder,
                  status: action.payload.status as any,
                }
              : state.driver.currentOrder,
        },
      };

    case "ADD_NOTIFICATION":
      return {
        ...state,
        ui: {
          ...state.ui,
          notifications: [action.payload, ...state.ui.notifications],
        },
      };

    case "SET_RESTAURANTS":
      return {
        ...state,
        restaurants: {
          ...state.restaurants,
          list: action.payload,
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
        restaurants: {
          ...state.restaurants,
          isLoading: action.payload,
        },
      };

    case "SET_LOCATION":
      return {
        ...state,
        location: {
          ...state.location,
          currentLocation: action.payload,
        },
      };

    case "SET_ADDRESSES":
      return {
        ...state,
        location: {
          ...state.location,
          addresses: action.payload,
        },
      };

    case "SELECT_ADDRESS":
      return {
        ...state,
        location: {
          ...state.location,
          selectedAddress: action.payload,
        },
      };

    case "ADD_ORDER":
      return {
        ...state,
        customer: {
          ...state.customer,
          orders: [action.payload, ...state.customer.orders],
        },
      };

    case "UPDATE_RESTAURANT":
      return {
        ...state,
        restaurants: {
          ...state.restaurants,
          list: state.restaurants.list.map((restaurant) =>
            restaurant.id === action.payload.id ? action.payload : restaurant,
          ),
          currentRestaurant:
            state.restaurants.currentRestaurant?.id === action.payload.id
              ? action.payload
              : state.restaurants.currentRestaurant,
        },
      };

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
    createOrder: (orderData: any) => Promise<any>;
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

  // Load user on mount
  useEffect(() => {
    const loadUser = async () => {
      try {
        const authStatus = await checkAuth();
        if (authStatus.isAuthenticated && authStatus.user) {
          // Get token from AsyncStorage
          const token = await (async () => {
            try {
              const AsyncStorage =
                await import("@react-native-async-storage/async-storage");
              return await AsyncStorage.default.getItem("access_token");
            } catch (error) {
              console.error("Error getting token:", error);
              return null;
            }
          })();

          if (token) {
            dispatch({
              type: "LOGIN_SUCCESS",
              payload: {
                user: authStatus.user,
                token: token,
                role: authStatus.user.role as "customer" | "driver",
              },
            });

            // Load additional data based on role
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
      if (response) {
        dispatch({ type: "UPDATE_USER", payload: response });
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const loadCustomerOrders = async () => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      // TODO: Implement customer orders API
      dispatch({ type: "SET_CUSTOMER_ORDERS", payload: [] });
    } catch (error) {
      console.error("Error loading orders:", error);
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
        ...(location && {
          location: {
            ...location,
            radius: 10000,
          },
        }),
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
        // Fallback to dummy restaurants if API fails or returns empty
        // await loadDummyRestaurants();
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

      const existingRestaurant = state.restaurants.list.find(
        (r) => r.id === restaurantId,
      );
      if (existingRestaurant) {
        dispatch({
          type: "SET_CURRENT_RESTAURANT",
          payload: existingRestaurant,
        });
        return existingRestaurant;
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
      if (response.success) {
        return response.data;
      }
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

  const createOrder = async (orderData: any) => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      const newOrder: Order = {
        id: Date.now().toString(),
        order_number: `ORD-${Date.now()}`,
        customer_id: state.auth.user?.id || "",
        restaurant_id: orderData.restaurant_id || "dummy-1",
        items: [],
        status: "pending",
        total_amount: {
          subtotal: 0,
          delivery_fee: 0,
          service_charge: 0,
          discount: 0,
          tax: 0,
          total: 0,
        },
        delivery_info: {
          address: {
            id: "",
            label: "",
            address: "",
            location: {
              type: "Point",
              coordinates: [0, 0],
            },
            is_default: false,
            created_at: "",
          },
          contact_name: "",
          contact_phone: "",
          estimated_delivery: "",
        },
        timeline: [],
        payment_method: "cash",
        payment_status: "pending",
        is_scheduled: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      dispatch({
        type: "SET_CUSTOMER_ORDERS",
        payload: [newOrder, ...state.customer.orders],
      });

      dispatch({ type: "CLEAR_CART" });

      return newOrder;
    } catch (error) {
      console.error("Error creating order:", error);
      throw error;
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const updateProfile = async (data: any) => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      const response = await authAPI.updateProfile(data);
      if (response) {
        dispatch({ type: "UPDATE_USER", payload: response });
      }
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
  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return context;
};
