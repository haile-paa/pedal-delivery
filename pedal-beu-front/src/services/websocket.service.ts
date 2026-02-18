// services/websocket.service.ts
import { io, Socket } from "socket.io-client";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

class WebSocketService {
  private socket: Socket | null = null;
  private static instance: WebSocketService;
  private listeners: Map<string, Function[]> = new Map();

  private constructor() {}

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  async connect(token: string) {
    try {
      // Use your render.com backend URL for WebSocket
      const baseUrl = "wss://pedal-delivery-back.onrender.com";

      console.log(`Connecting to WebSocket at ${baseUrl}`);

      const options = {
        auth: { token },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
      };

      this.socket = io(baseUrl, options);
      this.setupEventListeners();
    } catch (error) {
      console.error("WebSocket connection error:", error);
    }
  }
  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      console.log("✅ WebSocket connected, Socket ID:", this.socket?.id);
      this.trigger("connect", null);
    });

    this.socket.on("connect_error", (error) => {
      console.error("WebSocket connection error:", error.message);
      this.trigger("connect_error", error);
    });

    this.socket.on("disconnect", (reason) => {
      console.log("WebSocket disconnected:", reason);
      this.trigger("disconnect", reason);
    });

    // Handle order status updates
    this.socket.on("order:status_update", (data: any) => {
      console.log("Received order:status_update:", data);
      this.trigger("order:status_update", data);
    });

    this.socket.on("driver:assigned", (data: any) => {
      console.log("Received driver:assigned:", data);
      this.trigger("driver:assigned", data);
    });

    this.socket.on("driver:location_update", (data: any) => {
      console.log("Received driver:location_update:", data);
      this.trigger("driver:location_update", data);
    });

    // Also listen for the raw events that might come from Go server
    this.socket.on("order_update", (data: any) => {
      console.log("Received order_update (raw):", data);
      // Transform to match your React Native expected format
      this.trigger("order:status_update", data);
    });

    this.socket.on("driver_location", (data: any) => {
      console.log("Received driver_location (raw):", data);
      // Transform to match your React Native expected format
      this.trigger("driver:location_update", data);
    });
  }

  // Add connection status check
  checkConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.socket?.connected) {
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

  // Rest of your methods remain exactly the same...
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

  emit(event: string, data: any) {
    if (!this.socket?.connected) {
      console.warn("Cannot emit: Socket not connected");
      return false;
    }
    this.socket.emit(event, data);
    return true;
  }

  joinOrderRoom(orderId: string) {
    this.emit("join:order_room", { orderId });
  }

  joinDriverRoom(driverId: string) {
    this.emit("join:driver_room", { driverId });
  }

  updateDriverLocation(
    location: { lat: number; lng: number },
    orderId: string,
  ) {
    this.emit("driver:location_update", { location, orderId });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getSocketId(): string | null {
    return this.socket?.id || null;
  }

  setupWebSocketWithFallback = async () => {
    try {
      const token = await AsyncStorage.getItem("userToken");

      if (!token) {
        console.log("❌ No token available, using fallback");
        setUseFallback(true);
        startPolling();
        return;
      }

      console.log(
        "🔌 Setting up WebSocket with token:",
        token.substring(0, 20) + "...",
      );

      // Add connection status listener FIRST
      WebSocketService.on("connect", () => {
        console.log("✅ WebSocket connected successfully!");
        setWebSocketConnected(true);
        setUseFallback(false);

        // Join order room after connection
        WebSocketService.joinOrderRoom(orderId);
        console.log(`Joined order room: ${orderId}`);
      });

      WebSocketService.on("connect_error", (error) => {
        console.error("❌ WebSocket connection error:", error);
        setWebSocketConnected(false);
      });

      WebSocketService.on("disconnect", (reason) => {
        console.log("⚠️ WebSocket disconnected:", reason);
        setWebSocketConnected(false);
        setUseFallback(true);
        startPolling();
      });

      // Setup other event listeners
      WebSocketService.on("driver:assigned", (data: any) => {
        console.log("🚗 Driver assigned via WebSocket:", data);
        handleDriverAssigned(data);
      });

      WebSocketService.on("driver:location_update", (data: any) => {
        console.log("📍 Driver location update via WebSocket:", data);
        handleDriverLocationUpdate(data);
      });

      WebSocketService.on("order:status_update", (data: any) => {
        console.log("📦 Order status update via WebSocket:", data);
        handleOrderStatusUpdate(data);
      });

      // Try to connect
      WebSocketService.connect(token);

      // Check connection status after 2 seconds
      setTimeout(async () => {
        const isConnected = await WebSocketService.checkConnection();
        console.log("🔍 WebSocket connection check after 2s:", isConnected);

        if (!isConnected) {
          console.log("🔄 WebSocket failed to connect, using fallback polling");
          setUseFallback(true);
          startPolling();
        }
      }, 2000);

      // Fallback to polling after 10 seconds if still not connected
      const fallbackTimeout = setTimeout(() => {
        if (!webSocketConnected) {
          console.log(
            "⏰ WebSocket connection timeout, falling back to polling",
          );
          setUseFallback(true);
          startPolling();
        }
      }, 10000);

      // Clean up timeout
      return () => clearTimeout(fallbackTimeout);
    } catch (error) {
      console.error("❌ WebSocket setup error:", error);
      setUseFallback(true);
      startPolling();
    }
  };
}

export default WebSocketService.getInstance();
