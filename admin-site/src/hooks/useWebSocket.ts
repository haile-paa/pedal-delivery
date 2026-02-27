import { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

export const useWebSocket = (path: string) => {
  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null);
  const [readyState, setReadyState] = useState<number>(WebSocket.CONNECTING);
  const ws = useRef<WebSocket | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem("admin_token");
    // Hardcoded production WebSocket URL
    const wsUrl = `wss://pedal-delivery-back.onrender.com${path}?token=${token}`;
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      setReadyState(WebSocket.OPEN);
      console.log("WebSocket connected to", path);
    };

    ws.current.onclose = () => {
      setReadyState(WebSocket.CLOSED);
      console.log("WebSocket disconnected");
    };

    ws.current.onerror = (error) => {
      console.error("WebSocket error", error);
    };

    ws.current.onmessage = (event) => {
      setLastMessage(event);
    };

    return () => {
      ws.current?.close();
    };
  }, [path, user]);

  const sendMessage = (data: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    }
  };

  return { lastMessage, readyState, sendMessage };
};
