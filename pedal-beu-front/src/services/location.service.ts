// services/location.service.ts
import * as Location from "expo-location";
import { Platform } from "react-native";
import WebSocketService from "./websocket.service";

class LocationService {
  private locationSubscription: Location.LocationSubscription | null = null;
  private isTracking = false;
  private currentOrderId: string | null = null;

  async startTracking(orderId: string) {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        throw new Error("Permission to access location was denied");
      }

      this.currentOrderId = orderId;
      this.isTracking = true;

      // Start watching position
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 50, // Update every 50 meters
          timeInterval: 10000, // Update every 10 seconds
        },
        (location) => {
          this.sendLocationUpdate(location.coords);
        }
      );
    } catch (error) {
      console.error("Failed to start location tracking:", error);
    }
  }

  private sendLocationUpdate(coords: Location.LocationObjectCoords) {
    if (!this.currentOrderId || !this.isTracking) return;

    WebSocketService.updateDriverLocation(
      {
        lat: coords.latitude,
        lng: coords.longitude,
      },
      this.currentOrderId
    );
  }

  stopTracking() {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }

    this.isTracking = false;
    this.currentOrderId = null;
  }

  getCurrentLocation(): Promise<{ latitude: number; longitude: number }> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });
  }
}

export default new LocationService();
