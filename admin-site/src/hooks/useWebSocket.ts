import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";

export const useWebSocket = (path: string) => {
  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null);
  const [readyState, setReadyState] = useState<number>(WebSocket.CONNECTING);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<number | undefined>(undefined);
  const reconnectAttempts = useRef(0);
  const heartbeatInterval = useRef<number | undefined>(undefined);
  const unmounted = useRef(false);
  const { user } = useAuth();

  const closeSocket = useCallback(() => {
    if (!ws.current) return;
    // If the socket is still connecting, wait for it to open or fail before closing
    if (ws.current.readyState === WebSocket.CONNECTING) {
      const onOpenOrClose = () => {
        if (unmounted.current && ws.current) {
          ws.current.close();
          ws.current.removeEventListener("open", onOpenOrClose);
          ws.current.removeEventListener("close", onOpenOrClose);
        }
      };
      ws.current.addEventListener("open", onOpenOrClose);
      ws.current.addEventListener("close", onOpenOrClose);
    } else if (
      ws.current.readyState === WebSocket.OPEN ||
      ws.current.readyState === WebSocket.CLOSING
    ) {
      ws.current.close();
    }
    // If already CLOSED, nothing to do
  }, []);

  const connect = useCallback(() => {
    if (!user || unmounted.current) return;

    // Close existing socket if any (handles connecting state gracefully)
    if (ws.current) {
      closeSocket();
      // Wait a tick to allow the old socket to clean up
      setTimeout(() => {
        if (!unmounted.current) performConnection();
      }, 0);
    } else {
      performConnection();
    }
  }, [user, closeSocket]);

  const performConnection = useCallback(() => {
    if (!user || unmounted.current) return;

    const token = localStorage.getItem("admin_token");
    const wsUrl = `wss://pedal-delivery-back.onrender.com${path}?token=${token}`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      if (unmounted.current) {
        ws.current?.close();
        return;
      }
      setReadyState(WebSocket.OPEN);
      reconnectAttempts.current = 0;
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = undefined;
      }

      heartbeatInterval.current = setInterval(() => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({ type: "ping" }));
        }
      }, 30000) as unknown as number;
    };

    ws.current.onclose = (event) => {
      if (unmounted.current) return;
      setReadyState(WebSocket.CLOSED);
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = undefined;
      }

      if (event.code !== 1000 && user) {
        const delay = Math.min(
          1000 * Math.pow(2, reconnectAttempts.current),
          30000,
        );
        reconnectTimeout.current = setTimeout(() => {
          reconnectAttempts.current++;
          connect();
        }, delay) as unknown as number;

        if (reconnectAttempts.current > 3) {
          console.error(
            "WebSocket connection failed after multiple attempts",
            event.code,
            event.reason,
          );
        }
      }
    };

    ws.current.onerror = () => {};

    ws.current.onmessage = (event) => {
      if (unmounted.current) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === "pong") return;
      } catch {}
      setLastMessage(event);
    };
  }, [path, user, connect]);

  useEffect(() => {
    unmounted.current = false;
    connect();

    return () => {
      unmounted.current = true;
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
      closeSocket(); // This will handle connecting state gracefully
    };
  }, [connect, closeSocket]);

  const sendMessage = (data: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    }
  };

  return { lastMessage, readyState, sendMessage };
};
