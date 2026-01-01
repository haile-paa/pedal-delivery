// services/websocket.service.ts
import { io, Socket, ManagerOptions, SocketOptions } from "socket.io-client";
import { Platform, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

class WebSocketService {
  private socket: Socket | null = null;
  private static instance: WebSocketService;
  private listeners: Map<string, Function[]> = new Map();
  private connectionAttempts = 0;
  private maxConnectionAttempts = 5;
  private reconnectInterval = 3000; // 3 seconds

  private constructor() {}

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  async connect(token: string) {
    if (this.socket?.connected) {
      console.log("Socket already connected");
      return;
    }

    try {
      // Clear any existing socket
      this.disconnect();

      const baseUrl = await this.getBaseUrl();

      const options: Partial<ManagerOptions & SocketOptions> = {
        auth: { token },
        transports: ["websocket", "polling"], // Fallback to polling if websocket fails
        reconnection: true,
        reconnectionAttempts: this.maxConnectionAttempts,
        reconnectionDelay: this.reconnectInterval,
        timeout: 20000,
        forceNew: true,
        query: {
          platform: Platform.OS,
          version: "1.0.0",
        },
      };

      console.log(`Connecting to WebSocket at ${baseUrl}`);
      this.socket = io(baseUrl, options);

      this.setupEventListeners();
    } catch (error) {
      console.error("WebSocket connection error:", error);
      this.handleConnectionError();
    }
  }

  private async getBaseUrl(): Promise<string> {
    try {
      // For development
      if (__DEV__) {
        if (Platform.OS === "android") {
          return "http://192.168.1.3:8080"; // Android emulator
        } else if (Platform.OS === "ios") {
          return "http://localhost:8080"; // iOS simulator
        }
      }

      // For production, you might want to fetch from your config
      // or use environment variables
      const savedUrl = await AsyncStorage.getItem("websocket_url");
      return savedUrl || "https://your-production-api.com"; // Update with your production URL
    } catch (error) {
      console.error("Error getting base URL:", error);
      return "http://localhost:8080"; // Fallback
    }
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      console.log("✅ WebSocket connected successfully");
      this.connectionAttempts = 0;
      this.trigger("connect", {});
    });

    this.socket.on("connect_error", (error) => {
      console.error("WebSocket connection error:", error.message);
      this.connectionAttempts++;

      if (this.connectionAttempts >= this.maxConnectionAttempts) {
        console.error("Max connection attempts reached");
        this.trigger("connection_failed", { error: error.message });
      }
    });

    this.socket.on("disconnect", (reason) => {
      console.log("WebSocket disconnected:", reason);
      this.trigger("disconnect", { reason });
    });

    this.socket.on("error", (error) => {
      console.error("WebSocket error:", error);
      this.trigger("error", error);
    });

    // Your existing event listeners
    this.socket.on("order:status_update", (data: any) => {
      this.trigger("order:status_update", data);
    });

    this.socket.on("driver:assigned", (data: any) => {
      this.trigger("driver:assigned", data);
    });

    this.socket.on("driver:location_update", (data: any) => {
      this.trigger("driver:location_update", data);
    });

    this.socket.on("order:accepted", (data: any) => {
      this.trigger("order:accepted", data);
    });

    this.socket.on("order:preparing", (data: any) => {
      this.trigger("order:preparing", data);
    });

    this.socket.on("order:ready", (data: any) => {
      this.trigger("order:ready", data);
    });

    this.socket.on("order:picked_up", (data: any) => {
      this.trigger("order:picked_up", data);
    });

    this.socket.on("order:delivered", (data: any) => {
      this.trigger("order:delivered", data);
    });

    // Add more events as needed
    this.socket.on("order:new", (data: any) => {
      this.trigger("order:new", data);
    });

    this.socket.on("order:cancelled", (data: any) => {
      this.trigger("order:cancelled", data);
    });

    this.socket.on("order:taken", (data: any) => {
      this.trigger("order:taken", data);
    });
  }

  private handleConnectionError() {
    // You can implement retry logic or show an alert
    if (this.connectionAttempts < this.maxConnectionAttempts) {
      setTimeout(() => {
        console.log(
          `Retrying connection (${this.connectionAttempts}/${this.maxConnectionAttempts})...`
        );
        this.trigger("reconnecting", { attempt: this.connectionAttempts });
      }, this.reconnectInterval);
    }
  }

  // Rest of your methods remain the same...
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
    orderId: string
  ) {
    this.emit("driver:location_update", { location, orderId });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
    this.connectionAttempts = 0;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getSocketId(): string | null {
    return this.socket?.id || null;
  }
}

export default WebSocketService.getInstance();
