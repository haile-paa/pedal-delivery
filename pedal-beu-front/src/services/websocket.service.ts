import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, AppStateStatus } from "react-native";
import { WS_BASE_URL } from "../utils/constants";

type EventCallback = (data: any) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private static instance: WebSocketService;
  private listeners: Map<string, EventCallback[]> = new Map();
  private reconnectAttempts = 0;
  // No longer a hard stop — a phone can sit backgrounded/off-network for a
  // long time, and giving up after 5 tries meant a driver or customer who
  // left the app idle for a few minutes would silently stop getting live
  // updates until they force-closed and reopened it. We keep backing off
  // (up to 30s between tries) but never stop trying on our own; only
  // disconnect() (an intentional, explicit close) stops retries.
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private baseUrl = WS_BASE_URL;
  private token: string | null = null;
  private intentionalClose = false;
  private rooms: string[] = [];
  private appStateSubscription: { remove: () => void } | null = null;

  // Tracks the in-flight connection attempt so multiple callers awaiting
  // connect() all resolve/reject together with the same outcome, and so
  // we never send a message before the handshake actually completes.
  private connectPromise: Promise<void> | null = null;

  // Messages queued because they were sent before the socket finished
  // opening. Flushed the instant handleOpen() fires.
  private pendingEmits: { type: string; payload: any }[] = [];

  private constructor() {
    // A locked screen or backgrounded app is the #1 real-world cause of the
    // socket dropping — the OS suspends the connection, the server's ping
    // eventually times out server-side, and the client fires onerror/
    // onclose. Reconnecting immediately when the app comes back to the
    // foreground (instead of waiting on the backoff timer, which may have
    // already been idling for a while) makes that recovery instant instead
    // of taking up to 30s.
    this.appStateSubscription = AppState.addEventListener(
      "change",
      this.handleAppStateChange,
    );
  }

  private handleAppStateChange = (nextState: AppStateStatus) => {
    if (
      nextState === "active" &&
      this.token &&
      !this.intentionalClose &&
      this.ws?.readyState !== WebSocket.OPEN &&
      this.ws?.readyState !== WebSocket.CONNECTING
    ) {
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      this.connect(this.token).catch(() => {});
    }
  };

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
    // This fires for ordinary, expected drops (screen lock, backgrounding,
    // a brief network blip) that scheduleReconnect() below already recovers
    // from automatically — it is not itself an app failure. console.error
    // was surfacing this as a full red-screen error in the dev build even
    // though nothing was actually broken; console.warn keeps it visible in
    // logs without implying the app crashed.
    console.warn("WebSocket connection error (will attempt to reconnect)");
    this.trigger("error", { message: "WebSocket error" });
  }

  private handleClose(event: WebSocketCloseEvent) {
    console.log(`WebSocket closed: ${event.code}`);
    this.trigger("disconnect", { code: event.code, reason: event.reason });
    if (!this.intentionalClose) this.scheduleReconnect();
  }

  private scheduleReconnect() {
    // While backgrounded there's no point burning battery/retries — the
    // moment the app returns to "active", handleAppStateChange() above
    // reconnects immediately anyway.
    if (AppState.currentState !== "active") return;
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
    if (!callbacks) return;
    // Each callback gets its own try/catch — one broken listener (e.g. a
    // screen that crashes parsing a malformed payload) must never prevent
    // OTHER listeners for the same event from running. Without this,
    // Array.prototype.forEach aborts entirely on the first throw, silently
    // breaking unrelated features (e.g. a driver's order list failing to
    // auto-refresh just because a notification banner elsewhere crashed).
    callbacks.forEach((cb) => {
      try {
        cb(data);
      } catch (error) {
        console.error(`Error in WebSocket "${event}" listener:`, error);
      }
    });
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