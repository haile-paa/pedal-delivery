import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Alert,
  Image,
  Linking,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import MapView, { Marker, Polyline } from "react-native-maps";
import { colors } from "../../src/theme/colors";
import ProgressStepper from "../../src/components/ui/ProgressStepper";
import AnimatedButton from "../../src/components/ui/AnimatedButton";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

interface DriverInfo {
  id: string;
  name: string;
  phone: string;
  profile_picture?: string;
  rating: number;
  vehicle_type: string;
  license_plate: string;
  completed_deliveries: number;
}

interface OrderStatus {
  status:
    | "pending"
    | "accepted"
    | "preparing"
    | "ready"
    | "picked_up"
    | "delivered"
    | "cancelled";
  timestamp: string;
  message?: string;
}

interface OrderDetails {
  id: string;
  restaurant_name: string;
  restaurant_address: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  total_amount: number;
  delivery_address: string;
  estimated_delivery_time: string;
  created_at: string;
}

// WebSocket Service Implementation
class WebSocketService {
  private socket: WebSocket | null = null;
  private static instance: WebSocketService;
  private listeners: Map<string, Function[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;
  private pingInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  async connect(token: string) {
    try {
      // Use wss:// for production
      const baseUrl = "wss://pedal-delivery-back.onrender.com";
      const url = `${baseUrl}/ws/orders?token=${token}`;
      
      console.log(`🔌 Connecting to WebSocket: ${url}`);
      
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        console.log("✅ WebSocket connected successfully");
        this.reconnectAttempts = 0;
        this.trigger("connect", null);
        
        // Start ping interval to keep connection alive
        this.startPing();
      };

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("📨 WebSocket message received:", message);
          this.handleMessage(message);
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      this.socket.onerror = (error) => {
        console.error("❌ WebSocket error:", error);
        this.trigger("connect_error", error);
      };

      this.socket.onclose = (event) => {
        console.log("⚠️ WebSocket closed:", event.code, event.reason);
        this.stopPing();
        this.trigger("disconnect", event);
        
        // Attempt to reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => {
            this.reconnectAttempts++;
            console.log(`🔄 Reconnecting attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
            this.connect(token);
          }, this.reconnectInterval);
        }
      };
    } catch (error) {
      console.error("WebSocket connection error:", error);
    }
  }

  private handleMessage(message: any) {
    const { type, data } = message;
    
    switch (type) {
      case "order_update":
      case "order:status_update":
        console.log("📦 Order status update:", data);
        this.trigger("order:status_update", data);
        
        // Trigger specific status events
        if (data?.status) {
          switch (data.status) {
            case "accepted":
              this.trigger("order:accepted", data);
              break;
            case "preparing":
              this.trigger("order:preparing", data);
              break;
            case "ready":
              this.trigger("order:ready", data);
              break;
            case "picked_up":
              this.trigger("order:picked_up", data);
              // If driver is assigned, trigger driver:assigned
              if (data.driver) {
                this.trigger("driver:assigned", { driver: data.driver });
              }
              break;
            case "delivered":
              this.trigger("order:delivered", data);
              break;
            case "cancelled":
              this.trigger("order:cancelled", data);
              break;
          }
        }
        break;
        
      case "driver_location":
      case "driver:location_update":
        console.log("📍 Driver location update:", data);
        this.trigger("driver:location_update", data);
        break;
        
      case "driver_assigned":
      case "driver:assigned":
        console.log("🚗 Driver assigned:", data);
        this.trigger("driver:assigned", data);
        break;
        
      case "notification":
        console.log("🔔 Notification:", data);
        this.trigger("notification", data);
        break;
        
      case "pong":
        // Heartbeat response
        break;
        
      default:
        console.log("📨 Unhandled message type:", type, data);
    }
  }

  private startPing() {
    // Send ping every 30 seconds to keep connection alive
    this.pingInterval = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000);
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  private trigger(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    callbacks?.forEach((callback) => callback(data));
  }

  send(message: any) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
      return true;
    }
    console.warn("WebSocket is not connected");
    return false;
  }

  joinOrderRoom(orderId: string) {
    this.send({
      type: "join:order_room",
      data: { orderId }
    });
  }

  joinDriverRoom(driverId: string) {
    this.send({
      type: "join:driver_room",
      data: { driverId }
    });
  }

  updateDriverLocation(location: { lat: number; lng: number }, orderId: string) {
    this.send({
      type: "driver:location_update",
      data: { location, orderId }
    });
  }

  disconnect() {
    if (this.socket) {
      this.stopPing();
      this.socket.close();
      this.socket = null;
    }
    this.listeners.clear();
    this.reconnectAttempts = 0;
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  getConnectionState(): string {
    if (!this.socket) return "disconnected";
    switch (this.socket.readyState) {
      case WebSocket.CONNECTING:
        return "connecting";
      case WebSocket.OPEN:
        return "connected";
      case WebSocket.CLOSING:
        return "closing";
      case WebSocket.CLOSED:
        return "closed";
      default:
        return "unknown";
    }
  }

  checkConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isConnected()) {
        resolve(true);
      } else {
        // Wait for connection or timeout
        const timeout = setTimeout(() => resolve(false), 3000);
        const handleConnect = () => {
          clearTimeout(timeout);
          resolve(true);
          this.off("connect", handleConnect);
        };
        this.on("connect", handleConnect);
      }
    });
  }
}

// Export the singleton instance (renamed to camelCase)
const webSocketService = WebSocketService.getInstance();

const OrderTrackingScreen: React.FC = () => {
  const router = useRouter();
  const { orderId, restaurantName } = useLocalSearchParams<{
    orderId: string;
    restaurantName: string;
  }>();

  const mapRef = useRef<MapView>(null);

  const [driverLocation, setDriverLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [restaurantLocation, setRestaurantLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [currentStatus, setCurrentStatus] =
    useState<OrderStatus["status"]>("pending");
  const [timeRemaining, setTimeRemaining] = useState<number>(30);
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [webSocketConnected, setWebSocketConnected] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<
    Array<{ latitude: number; longitude: number }>
  >([]);
  const [useFallback, setUseFallback] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<number | null>(
    null,
  );
  const [connectionStatus, setConnectionStatus] = useState<string>("disconnected");

  const statusSteps = [
    { title: "Order Placed", description: "Restaurant confirmed" },
    { title: "Preparing", description: "Food being prepared" },
    { title: "On The Way", description: "Driver picked up" },
    { title: "Delivered", description: "Enjoy your meal!" },
  ];

  const statusIcons = {
    pending: "time-outline",
    accepted: "checkmark-circle-outline",
    preparing: "restaurant-outline",
    ready: "fast-food-outline",
    picked_up: "bicycle-outline",
    delivered: "checkmark-done-outline",
    cancelled: "close-circle-outline",
  };

  const statusColors = {
    pending: colors.gray500,
    accepted: colors.info,
    preparing: colors.warning,
    ready: colors.warning,
    picked_up: colors.primary,
    delivered: colors.success,
    cancelled: colors.error,
  };

  const getCurrentStep = () => {
    switch (currentStatus) {
      case "pending":
        return 0;
      case "accepted":
      case "preparing":
        return 1;
      case "ready":
      case "picked_up":
        return 2;
      case "delivered":
        return 3;
      default:
        return 0;
    }
  };

  useEffect(() => {
    if (!orderId) {
      Alert.alert("Error", "No order ID provided");
      router.back();
      return;
    }

    initializeTracking();

    return () => {
      webSocketService.disconnect();
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [orderId]);

  const initializeTracking = async () => {
    try {
      setLoading(true);

      // Get user location
      await getUserLocation();

      // Fetch order details
      await fetchOrderDetails();

      // Try to connect to WebSocket with fallback
      await setupWebSocketWithFallback();

      // Set up time remaining timer
      startTimer();
    } catch (error) {
      console.error("Initialization error:", error);
    } finally {
      setLoading(false);
    }
  };

  const getUserLocation = () => {
    return new Promise<void>((resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
            resolve();
          },
          (error) => {
            console.error("Location error:", error);
            // Use default location in Addis Ababa
            setUserLocation({
              latitude: 9.032,
              longitude: 38.75,
            });
            resolve(); // Continue without location
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
        );
      } else {
        // Use default location in Addis Ababa
        setUserLocation({
          latitude: 9.032,
          longitude: 38.75,
        });
        resolve(); // Continue without location
      }
    });
  };

  const fetchOrderDetails = async () => {
    try {
      const token = await AsyncStorage.getItem("userToken");

      if (!token) {
        console.log("No token available, using fallback");
        setUseFallback(true);
        // Create mock data for testing
        createMockData();
        return;
      }

      console.log("Fetching order details...");
      const response = await fetch(
        `https://pedal-delivery-back.onrender.com/api/v1/orders/${orderId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        },
      );

      console.log("Response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log("Order data received:", data);

        // Handle different response structures
        const orderData = data.data || data;

        setOrderDetails({
          id: orderData._id || orderData.id || orderId,
          restaurant_name:
            orderData.restaurant?.name ||
            orderData.restaurant_name ||
            restaurantName ||
            "Unknown Restaurant",
          restaurant_address:
            orderData.restaurant?.address ||
            orderData.restaurant_address ||
            "Unknown Address",
          items:
            orderData.items?.map((item: any) => ({
              name: item.menu_item?.name || item.name || "Unknown Item",
              quantity: item.quantity || 1,
              price: item.price || item.menu_item?.price || 0,
            })) || [],
          total_amount: orderData.total_amount || orderData.total || 0,
          delivery_address: orderData.delivery_address || "Your Location",
          estimated_delivery_time:
            orderData.estimated_delivery_time || "30-40 min",
          created_at: orderData.created_at || new Date().toISOString(),
        });

        setCurrentStatus(orderData.status || "pending");

        // Convert restaurant location from GeoLocation to {latitude, longitude}
        if (orderData.restaurant?.location?.coordinates) {
          setRestaurantLocation({
            latitude: orderData.restaurant.location.coordinates[1],
            longitude: orderData.restaurant.location.coordinates[0],
          });
        } else if (orderData.restaurant_location?.coordinates) {
          setRestaurantLocation({
            latitude: orderData.restaurant_location.coordinates[1],
            longitude: orderData.restaurant_location.coordinates[0],
          });
        } else {
          // Use default restaurant location
          setRestaurantLocation({
            latitude: 9.022,
            longitude: 38.746,
          });
        }

        if (orderData.driver) {
          setDriverInfo({
            id: orderData.driver._id || orderData.driver.id,
            name: orderData.driver.name || "Unknown Driver",
            phone: orderData.driver.phone || "N/A",
            profile_picture: orderData.driver.profile_picture,
            rating: orderData.driver.rating || 4.5,
            vehicle_type: orderData.driver.vehicle_type || "Bicycle",
            license_plate: orderData.driver.license_plate || "N/A",
            completed_deliveries: orderData.driver.completed_deliveries || 0,
          });
        }

        // Convert driver location from GeoLocation to {latitude, longitude}
        if (orderData.driver_location?.coordinates) {
          const driverLoc = {
            latitude: orderData.driver_location.coordinates[1],
            longitude: orderData.driver_location.coordinates[0],
          };
          setDriverLocation(driverLoc);
          calculateRoute(driverLoc);
        }

        if (orderData.estimated_delivery_minutes) {
          setTimeRemaining(orderData.estimated_delivery_minutes);
        }
      } else {
        console.log("API response not OK, using fallback data");
        createMockData();
      }
    } catch (error) {
      console.error("Fetch order error:", error);
      createMockData();
    }
  };

  const createMockData = () => {
    console.log("Creating mock data for testing");
    setOrderDetails({
      id: orderId,
      restaurant_name: restaurantName || "Test Restaurant",
      restaurant_address: "Bole, Addis Ababa",
      items: [{ name: "Test Item", quantity: 1, price: 100 }],
      total_amount: 120,
      delivery_address: "Your Location",
      estimated_delivery_time: "30-40 min",
      created_at: new Date().toISOString(),
    });
    setRestaurantLocation({
      latitude: 9.022,
      longitude: 38.746,
    });
    // Create mock driver location near restaurant
    const mockDriverLoc = {
      latitude: 9.024,
      longitude: 38.748,
    };
    setDriverLocation(mockDriverLoc);
    setDriverInfo({
      id: "driver_123",
      name: "Test Driver",
      phone: "+251911223344",
      rating: 4.5,
      vehicle_type: "Bicycle",
      license_plate: "AA1234",
      completed_deliveries: 150,
    });
    calculateRoute(mockDriverLoc);
  };

  const setupWebSocketWithFallback = async () => {
    try {
      const token = await AsyncStorage.getItem("userToken");

      if (!token) {
        console.log("❌ No token available, using fallback");
        setUseFallback(true);
        startPolling();
        return;
      }

      console.log("🔌 Setting up WebSocket with token...");

      // Setup event listeners FIRST
      webSocketService.on("connect", () => {
        console.log("✅ WebSocket connected in component");
        setWebSocketConnected(true);
        setConnectionStatus("connected");
        setUseFallback(false);
        
        // Join order room after connection
        setTimeout(() => {
          webSocketService.joinOrderRoom(orderId);
          console.log(`Joined order room: ${orderId}`);
        }, 500);
      });

      webSocketService.on("connect_error", (error) => {
        console.error("❌ WebSocket connection error:", error);
        setWebSocketConnected(false);
        setConnectionStatus("error");
        setUseFallback(true);
        startPolling();
      });

      webSocketService.on("disconnect", () => {
        console.log("⚠️ WebSocket disconnected");
        setWebSocketConnected(false);
        setConnectionStatus("disconnected");
        setUseFallback(true);
        startPolling();
      });

      // Setup other event listeners
      webSocketService.on("driver:assigned", (data: any) => {
        console.log("🚗 Driver assigned via WebSocket:", data);
        handleDriverAssigned(data);
      });

      webSocketService.on("driver:location_update", (data: any) => {
        console.log("📍 Driver location update via WebSocket:", data);
        handleDriverLocationUpdate(data);
      });

      webSocketService.on("order:status_update", (data: any) => {
        console.log("📦 Order status update via WebSocket:", data);
        handleOrderStatusUpdate(data);
      });

      webSocketService.on("order:accepted", (data: any) => {
        console.log("✅ Order accepted via WebSocket:", data);
        handleOrderAccepted(data);
      });

      webSocketService.on("order:preparing", (data: any) => {
        console.log("👨‍🍳 Order preparing via WebSocket:", data);
        handleOrderPreparing(data);
      });

      webSocketService.on("order:ready", (data: any) => {
        console.log("📦 Order ready via WebSocket:", data);
        handleOrderReady(data);
      });

      webSocketService.on("order:picked_up", (data: any) => {
        console.log("🚚 Order picked up via WebSocket:", data);
        handleOrderPickedUp(data);
      });

      webSocketService.on("order:delivered", (data: any) => {
        console.log("🎉 Order delivered via WebSocket:", data);
        handleOrderDelivered(data);
      });

      // Now connect
      webSocketService.connect(token);
      
      // Check connection status after 3 seconds
      setTimeout(async () => {
        const isConnected = await webSocketService.checkConnection();
        console.log("🔍 Initial connection check:", isConnected);
        
        if (!isConnected) {
          console.log("🔄 WebSocket not connected, using polling fallback");
          setUseFallback(true);
          setWebSocketConnected(false);
          setConnectionStatus("failed");
          startPolling();
        }
      }, 3000);

      // Final fallback after 10 seconds
      setTimeout(() => {
        if (!webSocketConnected && !useFallback) {
          console.log("⏰ WebSocket connection timeout, enabling fallback");
          setUseFallback(true);
          startPolling();
        }
      }, 10000);

    } catch (error) {
      console.error("❌ WebSocket setup error:", error);
      setUseFallback(true);
      startPolling();
    }
  };

  const startPolling = () => {
    console.log("🔄 Starting polling for updates...");
    // Clear any existing interval
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    const interval = setInterval(async () => {
      try {
        const token = await AsyncStorage.getItem("userToken");
        if (token) {
          // Poll for updates every 20 seconds
          const response = await fetch(
            `https://pedal-delivery-back.onrender.com/api/v1/orders/${orderId}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            },
          );

          if (response.ok) {
            const data = await response.json();
            const orderData = data.data || data;

            // Update status if changed
            if (orderData.status && orderData.status !== currentStatus) {
              console.log("🔄 Polling: Status updated to", orderData.status);
              setCurrentStatus(orderData.status);

              // Show alert for status changes
              if (orderData.status === "picked_up") {
                Alert.alert(
                  "Order Picked Up!",
                  "Your order has been picked up and is on its way!",
                  [{ text: "OK" }],
                );
              } else if (orderData.status === "delivered") {
                Alert.alert(
                  "Order Delivered!",
                  "Your order has been delivered. Enjoy your meal!",
                  [{ text: "OK" }],
                );
              }
            }

            // Update driver location if available
            if (orderData.driver_location?.coordinates) {
              const driverLoc = {
                latitude: orderData.driver_location.coordinates[1],
                longitude: orderData.driver_location.coordinates[0],
              };
              console.log("📍 Polling: Driver location updated", driverLoc);
              setDriverLocation(driverLoc);
              calculateRoute(driverLoc);
            }

            // Update driver info if available
            if (orderData.driver && !driverInfo) {
              setDriverInfo({
                id: orderData.driver._id || orderData.driver.id,
                name: orderData.driver.name || "Unknown Driver",
                phone: orderData.driver.phone || "N/A",
                profile_picture: orderData.driver.profile_picture,
                rating: orderData.driver.rating || 4.5,
                vehicle_type: orderData.driver.vehicle_type || "Bicycle",
                license_plate: orderData.driver.license_plate || "N/A",
                completed_deliveries:
                  orderData.driver.completed_deliveries || 0,
              });
            }
          }
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 20000); // Poll every 20 seconds

    setPollingInterval(interval as any);
  };

  const handleDriverAssigned = (data: any) => {
    if (data.driver) {
      setDriverInfo({
        id: data.driver._id || data.driver.id || data.driver._id || "unknown",
        name: data.driver.name || "Unknown Driver",
        phone: data.driver.phone || "N/A",
        profile_picture: data.driver.profile_picture,
        rating: data.driver.rating || 4.5,
        vehicle_type: data.driver.vehicle_type || "Bicycle",
        license_plate: data.driver.license_plate || "N/A",
        completed_deliveries: data.driver.completed_deliveries || 0,
      });
    }
    Alert.alert(
      "Driver Assigned!",
      `${data.driver?.name || 'A driver'} has accepted your order and will be arriving soon.`,
      [{ text: "OK" }],
    );
  };

  const handleDriverLocationUpdate = (data: any) => {
    let location = data.location;
    
    // Handle different location formats
    if (location?.coordinates) {
      // GeoJSON format: [longitude, latitude]
      location = {
        latitude: location.coordinates[1],
        longitude: location.coordinates[0],
      };
    } else if (location?.lat && location?.lng) {
      // Standard format
      location = {
        latitude: location.lat,
        longitude: location.lng,
      };
    }

    console.log("📍 Updating driver location:", location);
    setDriverLocation(location);
    
    // Calculate route if we have user location
    if (userLocation) {
      calculateRoute(location);
    }

    // Animate map to show driver location
    if (mapRef.current && location) {
      mapRef.current.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  const handleOrderStatusUpdate = (data: any) => {
    if (data.status) {
      console.log("🔄 Updating order status to:", data.status);
      setCurrentStatus(data.status);

      if (data.message) {
        Alert.alert("Status Update", data.message, [{ text: "OK" }]);
      }
    }
  };

  const handleOrderAccepted = (data: any) => {
    setCurrentStatus("accepted");
    Alert.alert(
      "Order Accepted",
      "The restaurant has accepted your order and started preparing it.",
    );
  };

  const handleOrderPreparing = (data: any) => {
    setCurrentStatus("preparing");
  };

  const handleOrderReady = (data: any) => {
    setCurrentStatus("ready");
    Alert.alert("Order Ready", "Your order is ready for pickup!");
  };

  const handleOrderPickedUp = (data: any) => {
    setCurrentStatus("picked_up");
    Alert.alert(
      "On the Way!",
      "Your order has been picked up and is on its way to you!",
    );
  };

  const handleOrderDelivered = (data: any) => {
    setCurrentStatus("delivered");
    Alert.alert(
      "Order Delivered!",
      "Your order has been delivered. Enjoy your meal!",
      [
        {
          text: "Rate Order",
          onPress: () => {
            Alert.alert("Rating", "Rate your order feature coming soon!");
          },
        },
      ],
    );
  };

  const calculateRoute = (driverLoc: {
    latitude: number;
    longitude: number;
  }) => {
    if (!userLocation) return;

    // In a real app, you would use a routing API like Google Maps Directions
    // For now, we'll create a simple straight line
    setRouteCoordinates([driverLoc, userLocation]);
  };

  const startTimer = () => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  };

  const handleCallDriver = () => {
    if (!driverInfo) {
      Alert.alert("No Driver", "Driver has not been assigned yet.");
      return;
    }

    Alert.alert("Call Driver", `Would you like to call ${driverInfo.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Call",
        onPress: () => {
          Linking.openURL(`tel:${driverInfo.phone}`);
        },
      },
    ]);
  };

  const handleMessageDriver = () => {
    if (!driverInfo) {
      Alert.alert("No Driver", "Driver has not been assigned yet.");
      return;
    }

    // For SMS
    Linking.openURL(`sms:${driverInfo.phone}`);
  };

  const handleCancelOrder = async () => {
    Alert.alert("Cancel Order", "Are you sure you want to cancel this order?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem("userToken");
            if (!token) {
              Alert.alert("Error", "Please login to cancel order");
              return;
            }

            const response = await fetch(
              `https://pedal-delivery-back.onrender.com/api/v1/orders/${orderId}/cancel`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
              },
            );

            if (response.ok) {
              setCurrentStatus("cancelled");
              Alert.alert(
                "Order Cancelled",
                "Your order has been cancelled successfully.",
              );

              setTimeout(() => {
                router.replace("/(customer)/home");
              }, 2000);
            } else {
              const data = await response.json();
              Alert.alert("Error", data.message || "Failed to cancel order");
            }
          } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to cancel order");
          }
        },
      },
    ]);
  };

  const handleContactRestaurant = () => {
    if (!orderDetails) return;

    Alert.alert("Contact Restaurant", "This feature is coming soon!", [
      { text: "OK" },
    ]);
  };

  const handleViewOrderDetails = () => {
    Alert.alert("Order Details", "Full order details feature coming soon!", [
      { text: "OK" },
    ]);
  };

  const handleHelp = () => {
    Alert.alert("Help", "Help feature coming soon!", [{ text: "OK" }]);
  };

  // Check if order can be cancelled
  const canCancelOrder = () => {
    const cancellableStatuses = [
      "pending",
      "accepted",
      "preparing",
      "ready",
      "picked_up",
    ];
    return cancellableStatuses.includes(currentStatus);
  };

  const handleReconnectWebSocket = async () => {
    try {
      const token = await AsyncStorage.getItem("userToken");
      if (token) {
        console.log("🔄 Attempting to reconnect WebSocket...");
        setUseFallback(false);
        webSocketService.connect(token);
        
        // Check connection after 3 seconds
        setTimeout(async () => {
          const connected = await webSocketService.checkConnection();
          if (connected) {
            Alert.alert("Success", "Reconnected to live tracking!");
          } else {
            Alert.alert("Failed", "Could not reconnect. Using polling instead.");
            setUseFallback(true);
            startPolling();
          }
        }, 3000);
      }
    } catch (error) {
      console.error("Reconnection error:", error);
      setUseFallback(true);
      startPolling();
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar
          barStyle='dark-content'
          backgroundColor={colors.background}
        />
        <ActivityIndicator size='large' color={colors.primary} />
        <Text style={styles.loadingText}>Loading order details...</Text>
      </View>
    );
  }

  if (currentStatus === "cancelled") {
    return (
      <View style={styles.container}>
        <StatusBar
          barStyle='dark-content'
          backgroundColor={colors.background}
        />
        <Stack.Screen options={{ title: "Order Cancelled" }} />

        <View style={styles.centeredContent}>
          <Ionicons name='close-circle' size={80} color={colors.error} />
          <Text style={styles.cancelledTitle}>Order Cancelled</Text>
          <Text style={styles.cancelledMessage}>
            Your order has been cancelled successfully.
          </Text>
          <Text style={styles.cancelledSubMessage}>
            Any payments made will be refunded within 3-5 business days.
          </Text>
          <AnimatedButton
            title='Back to Home'
            onPress={() => router.replace("/(customer)/home")}
            style={styles.homeButton}
          />
        </View>
      </View>
    );
  }

  if (currentStatus === "delivered") {
    return (
      <View style={styles.container}>
        <StatusBar
          barStyle='dark-content'
          backgroundColor={colors.background}
        />
        <Stack.Screen options={{ title: "Order Delivered" }} />

        <View style={styles.centeredContent}>
          <Ionicons name='checkmark-circle' size={80} color={colors.success} />
          <Text style={styles.deliveredTitle}>🎉 Order Delivered!</Text>
          <Text style={styles.deliveredMessage}>
            Your food has been delivered. Enjoy your meal!
          </Text>

          {orderDetails && (
            <View style={styles.deliverySummary}>
              <Text style={styles.summaryTitle}>Order Summary</Text>
              <Text style={styles.summaryText}>
                Restaurant: {orderDetails.restaurant_name}
              </Text>
              <Text style={styles.summaryText}>
                Total: {orderDetails.total_amount.toFixed(2)} Birr
              </Text>
              <Text style={styles.summaryText}>
                Delivered at:{" "}
                {new Date(orderDetails.created_at).toLocaleTimeString()}
              </Text>
            </View>
          )}

          <View style={styles.deliveredActions}>
            <AnimatedButton
              title='Rate Your Order'
              onPress={() =>
                Alert.alert("Rating", "Rate your order feature coming soon!")
              }
              style={styles.rateButton}
            />
            <AnimatedButton
              title='Back to Home'
              onPress={() => router.replace("/(customer)/home")}
              variant='outline'
              style={styles.homeButton}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle='light-content' backgroundColor={colors.primary} />
      <Stack.Screen
        options={{
          title: "Track Order",
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: colors.white,
        }}
      />

      {/* Map Section */}
      <View style={styles.mapSection}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: userLocation?.latitude || 9.032,
            longitude: userLocation?.longitude || 38.75,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
          showsUserLocation={true}
          showsMyLocationButton={true}
        >
          {/* Restaurant Marker */}
          {restaurantLocation && (
            <Marker
              coordinate={restaurantLocation}
              title={restaurantName || "Restaurant"}
              description='Pickup location'
            >
              <View style={styles.restaurantMarker}>
                <Ionicons name='restaurant' size={20} color={colors.white} />
              </View>
            </Marker>
          )}

          {/* Driver Marker */}
          {driverLocation && (
            <Marker
              coordinate={driverLocation}
              title={driverInfo?.name || "Driver"}
              description='Your delivery driver'
            >
              <View style={styles.driverMarker}>
                <Ionicons name='bicycle' size={20} color={colors.white} />
              </View>
            </Marker>
          )}

          {/* User Marker */}
          {userLocation && (
            <Marker
              coordinate={userLocation}
              title='You'
              description='Delivery location'
              pinColor={colors.primary}
            />
          )}

          {/* Route Line */}
          {routeCoordinates.length > 0 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeColor={colors.primary}
              strokeWidth={3}
              lineDashPattern={[10, 10]}
            />
          )}
        </MapView>

        {/* WebSocket Status */}
        <View style={styles.connectionStatus}>
          <View
            style={[
              styles.connectionDot,
              {
                backgroundColor: webSocketConnected
                  ? colors.success
                  : useFallback
                    ? colors.info
                    : colors.error,
              },
            ]}
          />
          <Text style={styles.connectionText}>
            {webSocketConnected
              ? "Live Tracking"
              : useFallback
                ? "Polling for Updates"
                : "Connecting..."}
          </Text>
          
          {useFallback && !webSocketConnected && (
            <TouchableOpacity 
              style={styles.reconnectButton}
              onPress={handleReconnectWebSocket}
            >
              <Ionicons name="refresh" size={14} color={colors.white} />
              <Text style={styles.reconnectText}>Reconnect</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tracking Info */}
      <ScrollView
        style={styles.trackingSection}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusHeader}>
          <View style={styles.timeRemaining}>
            <Text style={styles.timeLabel}>Estimated Delivery</Text>
            <Text style={styles.timeValue}>{timeRemaining} min</Text>
          </View>

          <View style={styles.currentStatus}>
            <Ionicons
              name={statusIcons[currentStatus] as any}
              size={24}
              color={statusColors[currentStatus]}
            />
            <Text
              style={[
                styles.statusText,
                { color: statusColors[currentStatus] },
              ]}
            >
              {currentStatus.charAt(0).toUpperCase() +
                currentStatus.slice(1).replace("_", " ")}
            </Text>
          </View>
        </View>

        <ProgressStepper
          steps={statusSteps}
          currentStep={getCurrentStep()}
          showLabels={true}
        />

        {/* Driver Info */}
        {driverInfo ? (
          <View style={styles.driverInfoCard}>
            <Text style={styles.sectionTitle}>Your Driver</Text>
            <View style={styles.driverInfo}>
              <View style={styles.driverAvatar}>
                {driverInfo.profile_picture ? (
                  <Image
                    source={{ uri: driverInfo.profile_picture }}
                    style={styles.driverImage}
                  />
                ) : (
                  <Text style={styles.driverInitial}>
                    {driverInfo.name.charAt(0)}
                  </Text>
                )}
              </View>
              <View style={styles.driverDetails}>
                <Text style={styles.driverName}>{driverInfo.name}</Text>
                <Text style={styles.phoneNumber}>{driverInfo.phone}</Text>
                <View style={styles.driverStats}>
                  <Text style={styles.vehicleInfo}>
                    {driverInfo.vehicle_type} • {driverInfo.license_plate}
                  </Text>
                  <Text style={styles.rating}>
                    ⭐ {driverInfo.rating.toFixed(1)} (
                    {driverInfo.completed_deliveries} deliveries)
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.driverActions}>
              <TouchableOpacity
                style={styles.callDriverButton}
                onPress={handleCallDriver}
              >
                <Ionicons name='call' size={20} color={colors.white} />
                <Text style={styles.callDriverText}>Call Driver</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.messageDriverButton}
                onPress={handleMessageDriver}
              >
                <Ionicons
                  name='chatbubble-ellipses'
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.messageDriverText}>Message</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.noDriverCard}>
            <Ionicons name='time' size={24} color={colors.gray500} />
            <Text style={styles.noDriverText}>
              Waiting for a driver to accept your order...
            </Text>
            <ActivityIndicator size='small' color={colors.primary} />
          </View>
        )}

        {/* Order Details */}
        {orderDetails && (
          <View style={styles.orderDetailsCard}>
            <Text style={styles.sectionTitle}>Order Details</Text>

            <View style={styles.orderInfoRow}>
              <Ionicons name='restaurant' size={20} color={colors.gray600} />
              <Text style={styles.orderInfoText}>
                {orderDetails.restaurant_name}
              </Text>
            </View>

            <View style={styles.orderInfoRow}>
              <Ionicons name='location' size={20} color={colors.gray600} />
              <Text style={styles.orderInfoText}>
                {orderDetails.delivery_address}
              </Text>
            </View>

            <View style={styles.orderInfoRow}>
              <Ionicons name='time' size={20} color={colors.gray600} />
              <Text style={styles.orderInfoText}>
                Ordered at{" "}
                {new Date(orderDetails.created_at).toLocaleTimeString()}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.viewOrderButton}
              onPress={handleViewOrderDetails}
            >
              <Text style={styles.viewOrderText}>View Full Order Details</Text>
              <Ionicons
                name='chevron-forward'
                size={20}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsSection}>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.restaurantContactButton}
              onPress={handleContactRestaurant}
            >
              <Ionicons name='business' size={20} color={colors.white} />
              <Text style={styles.restaurantContactText}>
                Contact Restaurant
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.helpButton} onPress={handleHelp}>
              <Ionicons name='help-circle' size={20} color={colors.primary} />
              <Text style={styles.helpText}>Help</Text>
            </TouchableOpacity>
          </View>

          {/* Show cancel button only if order can be cancelled */}
          {canCancelOrder() && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelOrder}
            >
              <Text style={styles.cancelButtonText}>Cancel Order</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.white,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.gray600,
  },
  mapSection: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  connectionStatus: {
    position: "absolute",
    top: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  connectionText: {
    fontSize: 12,
    color: colors.gray700,
    fontWeight: "500",
  },
  reconnectButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
    gap: 4,
  },
  reconnectText: {
    fontSize: 10,
    color: colors.white,
    fontWeight: "500",
  },
  trackingSection: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "50%",
  },
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  timeRemaining: {
    alignItems: "flex-start",
  },
  timeLabel: {
    fontSize: 14,
    color: colors.gray600,
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 36,
    fontWeight: "bold",
    color: colors.primary,
  },
  currentStatus: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.gray50,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  restaurantMarker: {
    backgroundColor: colors.warning,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  driverMarker: {
    backgroundColor: colors.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  driverInfoCard: {
    backgroundColor: colors.gray50,
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.gray800,
    marginBottom: 16,
  },
  driverInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  driverAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    overflow: "hidden",
  },
  driverImage: {
    width: "100%",
    height: "100%",
  },
  driverInitial: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.white,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.gray800,
    marginBottom: 2,
  },
  phoneNumber: {
    fontSize: 14,
    color: colors.gray600,
    marginBottom: 4,
  },
  driverStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  vehicleInfo: {
    fontSize: 12,
    color: colors.gray600,
    backgroundColor: colors.gray100,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  rating: {
    fontSize: 12,
    color: colors.gray600,
  },
  driverActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  callDriverButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  callDriverText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "600",
  },
  messageDriverButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  messageDriverText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  noDriverCard: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gray50,
    borderRadius: 16,
    padding: 32,
    marginTop: 24,
    gap: 12,
  },
  noDriverText: {
    fontSize: 16,
    color: colors.gray600,
    textAlign: "center",
  },
  orderDetailsCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  orderInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  orderInfoText: {
    fontSize: 14,
    color: colors.gray700,
    flex: 1,
  },
  viewOrderButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingVertical: 8,
  },
  viewOrderText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "500",
  },
  actionsSection: {
    marginTop: 24,
    gap: 12,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  restaurantContactButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.info,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  restaurantContactText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "600",
  },
  helpButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  helpText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  cancelButton: {
    alignItems: "center",
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
  },
  cancelButtonText: {
    fontSize: 16,
    color: colors.error,
    fontWeight: "600",
  },
  centeredContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  cancelledTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.error,
    marginTop: 16,
    marginBottom: 8,
  },
  cancelledMessage: {
    fontSize: 16,
    color: colors.gray600,
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 24,
  },
  cancelledSubMessage: {
    fontSize: 14,
    color: colors.gray500,
    textAlign: "center",
    marginBottom: 32,
  },
  deliveredTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: colors.success,
    marginTop: 16,
    marginBottom: 8,
  },
  deliveredMessage: {
    fontSize: 18,
    color: colors.gray600,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 24,
  },
  deliverySummary: {
    backgroundColor: colors.gray50,
    padding: 16,
    borderRadius: 12,
    width: "100%",
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.gray800,
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 14,
    color: colors.gray600,
    marginBottom: 4,
  },
  deliveredActions: {
    width: "100%",
    gap: 12,
  },
  rateButton: {
    width: "100%",
    marginBottom: 8,
  },
  homeButton: {
    width: "100%",
  },
});

export default OrderTrackingScreen;