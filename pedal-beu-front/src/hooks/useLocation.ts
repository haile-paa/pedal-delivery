import { useState, useEffect } from "react";
import { Location } from "../types";

export const useLocation = () => {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mock location for demo
  useEffect(() => {
    const mockLocation: Location = {
      latitude: 40.7128,
      longitude: -74.006,
      address: "New York, NY",
    };

    setLocation(mockLocation);
  }, []);

  return { location, error };
};
