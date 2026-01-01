import { useState, useEffect } from "react";

export const useNetworkStatus = () => {
  const [isConnected, setIsConnected] = useState(true);

  // Mock network status for demo
  useEffect(() => {
    setIsConnected(true);
  }, []);

  return isConnected;
};
