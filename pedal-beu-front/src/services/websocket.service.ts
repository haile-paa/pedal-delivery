import AsyncStorage from "@react-native-async-storage/async-storage";

type EventCallback = (data: any) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private static instance: WebSocketService;
  private listeners: Map<string, EventCallback[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private baseUrl = "wss://pedal-delivery-back.onrender.com";
  private token: string | null = null;
  private intentionalClose = false;
  private rooms: string[] = [];

  // Tracks the in-flight connection attempt so multiple callers awaiting
  // connect() all resolve/reject together with the same outcome, and so
  // we never send a message before the handshake actually completes.
  private connectPromise: Promise<void> | null = null;

  // Messages queued because they were sent before the socket finished
  // opening. Flushed the instant handleOpen() fires.
  private pendingEmits: { type: string; payload: any }[] = [];

  private constructor() {}

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  // Resolves only once the WebSocket connection is actually OPEN (or
  // rejects after a timeout / error). Callers should always `await` this
  // before calling setOnlineStatus() or any other emit() — emitting while
  // the handshake is still in progress used to silently drop the message.
  connect(token: string): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    // Already connecting — return the same in-flight promise instead of
    // opening a second socket.
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.token = token;
    this.intentionalClose = false;

    const url = `${this.baseUrl}/ws/orders?token=${token}`;
    console.log(`Connecting to WebSocket: ${url}`);

    this.connectPromise = new Promise<void>((resolve, reject) => {
      let settled = false;

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          this.connectPromise = null;
          reject(new Error("WebSocket connection timed out"));
        }
      }, 10000);

      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          this.handleOpen();
          if (!settled) {
            settled = true;
            this.connectPromise = null;
            resolve();
          }
        };

        this.ws.onmessage = this.handleMessage.bind(this);

        this.ws.onerror = (event) => {
          this.handleError(event);
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            this.connectPromise = null;
            reject(new Error("WebSocket connection error"));
          }
        };

        this.ws.onclose = (event) => {
          this.handleClose(event);
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            this.connectPromise = null;
            reject(new Error(`WebSocket closed before opening: ${event.code}`));
          }
        };
      } catch (error) {
        clearTimeout(timeout);
        this.connectPromise = null;
        console.error("WebSocket connection error:", error);
        this.scheduleReconnect();
        reject(error);
      }
    });

    return this.connectPromise;
  }

  private handleOpen() {
    console.log("✅ WebSocket connected");
    this.reconnectAttempts = 0;
    this.trigger("connect", null);

    // Re-join rooms after reconnect
    this.rooms.forEach((room) => {
      const [type, id] = room.split(":");
      if (type === "order") this.emit("join:order_room", { orderId: id });
      else if (type === "driver")
        this.emit("join:driver_room", { driverId: id });
    });

    // Flush anything that was queued while we were still connecting
    if (this.pendingEmits.length > 0) {
      const queued = this.pendingEmits;
      this.pendingEmits = [];
      queued.forEach(({ type, payload }) => this.emit(type, payload));
    }
  }

  private handleMessage(event: WebSocketMessageEvent) {
    try {
      const message = JSON.parse(event.data);
      const { type, data } = message;
      if (type) this.trigger(type, data);
      else this.trigger("message", message);
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error);
    }
  }

  private handleError(_error: Event) {
    console.error("WebSocket error");
    this.trigger("error", { message: "WebSocket error" });
  }

  private handleClose(event: WebSocketCloseEvent) {
    console.log(`WebSocket closed: ${event.code}`);
    this.trigger("disconnect", { code: event.code, reason: event.reason });
    if (!this.intentionalClose) this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      if (this.token) this.connect(this.token).catch(() => {});
    }, delay);
  }

  on(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
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
    if (callbacks) callbacks.forEach((cb) => cb(data));
  }

  // If the socket isn't open yet (still connecting), the message is queued
  // and flushed automatically in handleOpen() instead of being silently
  // dropped. This is the actual fix for "online button doesn't show up
  // on the admin site" — the status message used to be sent before the
  // handshake finished and was lost.
  emit(type: string, payload: any): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data: payload }));
      return true;
    }

    if (this.ws?.readyState === WebSocket.CONNECTING) {
      console.log(`Queuing "${type}" until WebSocket finishes connecting`);
      this.pendingEmits.push({ type, payload });
      return false;
    }

    console.warn(`Cannot emit "${type}": WebSocket not connected`);
    return false;
  }

  joinOrderRoom(orderId: string) {
    const room = `order:${orderId}`;
    if (!this.rooms.includes(room)) this.rooms.push(room);
    this.emit("join:order_room", { orderId });
  }

  joinDriverRoom(driverId: string) {
    const room = `driver:${driverId}`;
    if (!this.rooms.includes(room)) this.rooms.push(room);
    this.emit("join:driver_room", { driverId });
  }

  // Called when driver presses the online/offline toggle.
  // Backend persists is_online and broadcasts to admin room instantly.
  setOnlineStatus(isOnline: boolean) {
    this.emit("driver_status", { is_online: isOnline });
  }

  // Called every ~5 s while driver is online with fresh GPS coordinates.
  // Backend persists location and pushes it live to admin site.
  sendDriverLocation(lat: number, lng: number) {
    this.emit("driver_location", { lat, lng });
  }

  // Legacy per-order location relay (customer tracking screen)
  updateDriverLocation(
    location: { lat: number; lng: number },
    orderId?: string,
  ) {
    this.emit("location_update", { location, orderId });
  }

  disconnect() {
    this.intentionalClose = true;
    this.connectPromise = null;
    this.pendingEmits = [];
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
}

export default WebSocketService.getInstance();
