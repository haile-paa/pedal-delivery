import React, { useState, useEffect } from "react";
import { FiUser, FiStar, FiMapPin, FiPhone, FiRefreshCw } from "react-icons/fi";
import { driverAPI } from "../services/api";
import { useWebSocket } from "../hooks/useWebSocket"; // optional for real-time

interface Driver {
  id: string;
  name: string;
  phone: string;
  status: "active" | "on_break" | "offline";
  rating: number;
  deliveries: number;
  location: string;
}

// Backend driver type (based on your models)
interface BackendDriver {
  id: string;
  user_id?: string;
  status: string; // "pending", "approved", "rejected", "suspended"
  vehicle: {
    type: string;
    model?: string;
    color?: string;
    plate?: string;
  };
  rating: number;
  total_trips: number;
  is_online: boolean;
  location?: {
    coordinates: [number, number];
  };
  user?: {
    name?: string;
    phone?: string;
  };
}

const Drivers: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Optional WebSocket for real-time driver status updates
  const { lastMessage } = useWebSocket("/ws/drivers"); // assuming backend has such a room

  const fetchDrivers = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const response = await driverAPI.getAll();
      const backendDrivers = response.data || [];
      // Map backend data to UI format
      const mapped: Driver[] = backendDrivers.map((d: BackendDriver) => {
        // Determine display status
        let status: Driver["status"] = "offline";
        if (d.is_online) {
          // If online, but could be on break – we need a field for that.
          // Assume backend has a separate field like 'on_break' or we derive from status.
          // For now, treat is_online true as "active", but we might need on_break.
          status = "active";
        } else {
          status = "offline";
        }
        // If driver is approved but on break, we could have a field. We'll keep simple.
        return {
          id: d.id,
          name: d.user?.name || "Unknown",
          phone: d.user?.phone || "N/A",
          status,
          rating: d.rating || 0,
          deliveries: d.total_trips || 0,
          location: d.location
            ? `Lat: ${d.location.coordinates[1].toFixed(4)}, Lng: ${d.location.coordinates[0].toFixed(4)}`
            : "Location not available",
        };
      });
      setDrivers(mapped);
    } catch (err) {
      setError("Failed to load drivers");
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  // Handle real-time updates if WebSocket provides driver status changes
  useEffect(() => {
    if (lastMessage) {
      try {
        const event = JSON.parse(lastMessage.data);
        if (event.type === "driver_status_update") {
          const updated = event.data;
          setDrivers((prev) =>
            prev.map((d) =>
              d.id === updated.id ? { ...d, status: updated.status } : d,
            ),
          );
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message", error);
      }
    }
  }, [lastMessage]);

  const getStatusColor = (status: Driver["status"]) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "on_break":
        return "bg-yellow-100 text-yellow-800";
      case "offline":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading && !refreshing) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
      </div>
    );
  }

  return (
    <div>
      <div className='mb-6 flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-800'>Drivers</h1>
          <p className='text-gray-600'>Manage drivers and their status</p>
        </div>
        <div className='flex gap-2'>
          <button
            onClick={() => fetchDrivers(true)}
            disabled={refreshing}
            className='flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50'
          >
            <FiRefreshCw className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
          <button className='rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700'>
            Add New Driver
          </button>
        </div>
      </div>

      {error && (
        <div className='mb-4 p-4 bg-red-50 text-red-700 rounded-lg'>
          {error}
        </div>
      )}

      {!error && drivers.length === 0 ? (
        <div className='text-center py-12 bg-white rounded-lg shadow'>
          <p className='text-gray-500'>No drivers found</p>
        </div>
      ) : (
        <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
          {drivers.map((driver) => (
            <div key={driver.id} className='rounded-lg bg-white p-6 shadow'>
              <div className='mb-4 flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <div className='flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600'>
                    <FiUser size={24} />
                  </div>
                  <div>
                    <h3 className='font-semibold text-gray-800'>
                      {driver.name}
                    </h3>
                    <p className='text-sm text-gray-500'>{driver.id}</p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(
                    driver.status,
                  )}`}
                >
                  {driver.status.replace("_", " ")}
                </span>
              </div>

              <div className='space-y-2 text-sm'>
                <div className='flex items-center gap-2 text-gray-600'>
                  <FiPhone className='h-4 w-4' />
                  <span>{driver.phone}</span>
                </div>
                <div className='flex items-center gap-2 text-gray-600'>
                  <FiMapPin className='h-4 w-4' />
                  <span>{driver.location}</span>
                </div>
                <div className='flex items-center gap-2 text-gray-600'>
                  <FiStar className='h-4 w-4 text-yellow-500' />
                  <span>{driver.rating} / 5.0</span>
                  <span className='ml-auto text-gray-500'>
                    {driver.deliveries} deliveries
                  </span>
                </div>
              </div>

              <div className='mt-4 flex justify-end gap-2'>
                <button className='rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50'>
                  View
                </button>
                <button className='rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700'>
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Drivers;
