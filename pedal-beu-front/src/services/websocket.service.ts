// src/services/websocket.service.ts
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

type EventCallback = (data: any) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private static instance: WebSocketService;
  private listeners: Map<string, EventCallback[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: number | null = null;
  private baseUrl = "wss://pedal-delivery-back.onrender.com";
  private token: string | null = null;
  private intentionalClose = false;
  private rooms: string[] = []; // rooms to re‑join on reconnect

  private constructor() {}

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  async connect(token: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log("WebSocket already connected");
      return;
    }

    this.token = token;
    this.intentionalClose = false;

    const url = `${this.baseUrl}/ws/orders?token=${token}`;
    console.log(`Connecting to WebSocket: ${url}`);

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
    } catch (error) {
      console.error("WebSocket connection error:", error);
      this.scheduleReconnect();
    }
  }

  private handleOpen() {
    console.log("✅ WebSocket connected");
    this.reconnectAttempts = 0;
    this.trigger("connect", null);

    // Rejoin rooms that were joined before disconnect
    this.rooms.forEach((room) => {
      const [type, id] = room.split(":");
      if (type === "order") {
        this.emit("join:order_room", { orderId: id });
      } else if (type === "driver") {
        this.emit("join:driver_room", { driverId: id });
      }
    });
  }

  private handleMessage(event: WebSocketMessageEvent) {
    try {
      const message = JSON.parse(event.data);
      console.log("📩 WebSocket message received:", message);

      const { type, data } = message;
      if (type) {
        this.trigger(type, data);
      } else {
        this.trigger("message", message);
      }
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error);
    }
  }

  private handleError(_error: Event) {
    console.error("WebSocket error: connection failure");
    this.trigger("error", { message: "WebSocket error" });
  }

  private handleClose(event: WebSocketCloseEvent) {
    console.log(`WebSocket closed: ${event.code} - ${event.reason}`);
    this.trigger("disconnect", { code: event.code, reason: event.reason });

    if (!this.intentionalClose) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("Max reconnection attempts reached");
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(
      `Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`,
    );

    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      if (this.token) {
        this.connect(this.token);
      }
    }, delay) as unknown as number;
  }

  on(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback: EventCallback) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) callbacks.splice(index, 1);
    }
  }

  private trigger(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => cb(data));
    }
  }

  emit(type: string, payload: any) {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn("Cannot emit: WebSocket not connected");
      return false;
    }

    const message = JSON.stringify({ type, data: payload });
    this.ws.send(message);
    console.log(`📤 Sent ${type}:`, payload);
    return true;
  }

  joinOrderRoom(orderId: string) {
    const room = `order:${orderId}`;
    if (!this.rooms.includes(room)) {
      this.rooms.push(room);
    }
    this.emit("join:order_room", { orderId });
  }

  joinDriverRoom(driverId: string) {
    const room = `driver:${driverId}`;
    if (!this.rooms.includes(room)) {
      this.rooms.push(room);
    }
    this.emit("join:driver_room", { driverId });
  }

  updateDriverLocation(
    location: { lat: number; lng: number },
    orderId?: string,
  ) {
    this.emit("location_update", { location, orderId }); // FIXED event key
  }

  disconnect() {
    this.intentionalClose = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.listeners.clear();
    this.rooms = [];
    this.reconnectAttempts = 0;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  checkConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isConnected()) {
        resolve(true);
      } else {
        const onConnect = () => {
          this.off("connect", onConnect);
          resolve(true);
        };
        this.on("connect", onConnect);
        setTimeout(() => {
          this.off("connect", onConnect);
          resolve(false);
        }, 3000);
      }
    });
  }
}

export default WebSocketService.getInstance();
