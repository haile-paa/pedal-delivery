import React, { useState, useEffect } from "react";
import {
  FiUser,
  FiStar,
  FiMapPin,
  FiPhone,
  FiRefreshCw,
  FiX,
  FiTruck,
  FiEye,
  FiEyeOff,
} from "react-icons/fi";
import { driverAPI } from "../services/api";
import { useWebSocket } from "../hooks/useWebSocket";

interface Driver {
  id: string;
  name: string;
  username: string;
  phone: string;
  status: "active" | "on_break" | "offline";
  rating: number;
  deliveries: number;
  location: string;
  lat?: number;
  lng?: number;
  vehicleType?: string;
  vehiclePlate?: string;
  approvalStatus?: string;
}

interface BackendDriver {
  id: string;
  user_id?: string;
  status: string;
  vehicle: { type: string; model?: string; color?: string; plate?: string };
  rating: number;
  total_trips: number;
  is_online: boolean;
  location?: { coordinates: [number, number] };
  user?: { name?: string; phone?: string; username?: string };
}

interface AddDriverForm {
  phone: string;
  username: string;
  password: string;
}

const emptyForm: AddDriverForm = { phone: "", username: "", password: "" };

const formatCoords = (lat: number, lng: number) =>
  `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

const Drivers: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<AddDriverForm>(emptyForm);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // WebSocket — admin receives live driver_status_update and driver_location_update
  const { lastMessage } = useWebSocket("/ws/drivers");

  const mapDriver = (d: BackendDriver): Driver => {
    const lat = d.location?.coordinates?.[1];
    const lng = d.location?.coordinates?.[0];
    const hasCoords =
      lat !== undefined && lng !== undefined && (lat !== 0 || lng !== 0);

    return {
      id: d.id,
      name: d.user?.name || d.user?.username || "Unknown",
      username: d.user?.username || "",
      phone: d.user?.phone || "",
      status: d.is_online ? "active" : "offline",
      rating: d.rating || 0,
      deliveries: d.total_trips || 0,
      location: hasCoords ? formatCoords(lat!, lng!) : "Location not available",
      lat: hasCoords ? lat : undefined,
      lng: hasCoords ? lng : undefined,
      vehicleType: d.vehicle?.type || "—",
      vehiclePlate: d.vehicle?.plate || "—",
      approvalStatus: d.status,
    };
  };

  const fetchDrivers = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const response = await driverAPI.getAll();
      setDrivers((response.data || []).map(mapDriver));
    } catch {
      setError("Failed to load drivers. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  // ── Live WebSocket events ────────────────────────────────────────────────────
  useEffect(() => {
    if (!lastMessage) return;
    try {
      const event = JSON.parse(lastMessage.data);

      // Driver pressed online/offline toggle
      if (event.type === "driver_status_update") {
        const { driver_id, is_online } = event.data;
        setDrivers((prev) =>
          prev.map((d) =>
            d.id === driver_id
              ? { ...d, status: is_online ? "active" : "offline" }
              : d,
          ),
        );
      }

      // Driver GPS position changed
      if (event.type === "driver_location_update") {
        const { driver_id, lat, lng } = event.data;
        setDrivers((prev) =>
          prev.map((d) =>
            d.id === driver_id
              ? {
                  ...d,
                  lat,
                  lng,
                  location: formatCoords(lat, lng),
                }
              : d,
          ),
        );
      }
    } catch (e) {
      console.error("Failed to parse WebSocket message", e);
    }
  }, [lastMessage]);

  const handleAddDriver = async () => {
    setAddError(null);

    const phone = addForm.phone.trim();
    if (!phone) {
      setAddError("Phone number is required.");
      return;
    }
    if (!/^\+?[0-9]{7,15}$/.test(phone.replace(/\s/g, ""))) {
      setAddError("Enter a valid phone number (e.g. +251912345678).");
      return;
    }

    const username = addForm.username.trim();
    if (!username) {
      setAddError("Username is required.");
      return;
    }
    if (username.length < 3) {
      setAddError("Username must be at least 3 characters.");
      return;
    }

    if (!addForm.password) {
      setAddError("Password is required.");
      return;
    }
    if (addForm.password.length < 6) {
      setAddError("Password must be at least 6 characters.");
      return;
    }

    setAddLoading(true);
    try {
      const response = await driverAPI.create({
        phone,
        username,
        password: addForm.password,
      });
      setDrivers((prev) => [
        mapDriver(response.data as BackendDriver),
        ...prev,
      ]);
      setAddSuccess(true);
      setTimeout(() => {
        setShowAddModal(false);
        setAddForm(emptyForm);
        setAddSuccess(false);
        setShowPassword(false);
      }, 1800);
    } catch (err: any) {
      setAddError(
        err?.response?.data?.error || "Failed to add driver. Please try again.",
      );
    } finally {
      setAddLoading(false);
    }
  };

  const closeModal = () => {
    if (addLoading) return;
    setShowAddModal(false);
    setAddForm(emptyForm);
    setAddError(null);
    setAddSuccess(false);
    setShowPassword(false);
  };

  const getStatusColor = (status: Driver["status"]) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "on_break":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getApprovalBadge = (s?: string) => {
    switch (s) {
      case "approved":
        return "bg-emerald-50 text-emerald-700";
      case "pending":
        return "bg-amber-50 text-amber-700";
      case "suspended":
        return "bg-red-50 text-red-700";
      case "rejected":
        return "bg-rose-50 text-rose-700";
      default:
        return "bg-gray-50 text-gray-600";
    }
  };

  if (loading && !refreshing) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600' />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className='mb-6 flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-800'>Drivers</h1>
          <p className='text-gray-600'>
            Live driver status and location
            {drivers.length > 0 && (
              <span className='ml-2 text-sm text-gray-400'>
                ({drivers.length} total)
              </span>
            )}
          </p>
        </div>
        <div className='flex gap-2'>
          <button
            onClick={() => fetchDrivers(true)}
            disabled={refreshing}
            className='flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50'
          >
            <FiRefreshCw className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className='rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700'
          >
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
          <FiTruck className='mx-auto mb-3 text-gray-300' size={48} />
          <p className='text-gray-500'>No drivers found</p>
          <button
            onClick={() => setShowAddModal(true)}
            className='mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700'
          >
            Add your first driver
          </button>
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
                    {driver.username && (
                      <p className='text-xs text-blue-500 font-mono'>
                        @{driver.username}
                      </p>
                    )}
                    <p className='text-xs text-gray-400 font-mono'>
                      {driver.id.slice(-8)}
                    </p>
                  </div>
                </div>
                <div className='flex flex-col items-end gap-1'>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1 ${getStatusColor(driver.status)}`}
                  >
                    {driver.status === "active" && (
                      <span className='inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse' />
                    )}
                    {driver.status.replace("_", " ")}
                  </span>
                  {driver.approvalStatus && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${getApprovalBadge(driver.approvalStatus)}`}
                    >
                      {driver.approvalStatus}
                    </span>
                  )}
                </div>
              </div>

              <div className='space-y-2 text-sm'>
                {driver.phone && (
                  <div className='flex items-center gap-2 text-gray-600'>
                    <FiPhone className='h-4 w-4 shrink-0' />
                    <span>{driver.phone}</span>
                  </div>
                )}
                <div className='flex items-center gap-2 text-gray-600'>
                  <FiMapPin
                    className={`h-4 w-4 shrink-0 ${driver.lat ? "text-blue-500" : ""}`}
                  />
                  <span
                    className={`truncate text-xs ${driver.lat ? "text-blue-600 font-medium" : "text-gray-400"}`}
                  >
                    {driver.location}
                  </span>
                </div>
                <div className='flex items-center gap-2 text-gray-600'>
                  <FiTruck className='h-4 w-4 shrink-0' />
                  <span className='capitalize'>{driver.vehicleType}</span>
                  {driver.vehiclePlate && driver.vehiclePlate !== "—" && (
                    <span className='ml-1 text-gray-400'>
                      · {driver.vehiclePlate}
                    </span>
                  )}
                </div>
                <div className='flex items-center gap-2 text-gray-600'>
                  <FiStar className='h-4 w-4 text-yellow-500 shrink-0' />
                  <span>{driver.rating.toFixed(1)} / 5.0</span>
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

      {/* ── Add New Driver Modal ─────────────────────────────────────────────── */}
      {showAddModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'>
          <div className='w-full max-w-sm rounded-xl bg-white shadow-xl'>
            <div className='flex items-center justify-between border-b px-6 py-4'>
              <h2 className='text-lg font-semibold text-gray-800'>
                Add New Driver
              </h2>
              <button
                onClick={closeModal}
                disabled={addLoading}
                className='text-gray-400 hover:text-gray-600'
              >
                <FiX size={20} />
              </button>
            </div>

            <div className='px-6 py-5 space-y-4'>
              {addSuccess ? (
                <div className='py-8 text-center'>
                  <div className='mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600 text-2xl'>
                    ✓
                  </div>
                  <p className='font-medium text-gray-800'>
                    Driver added successfully!
                  </p>
                  <p className='mt-1 text-sm text-gray-500'>
                    The driver can now log in with their username or phone and
                    password.
                  </p>
                </div>
              ) : (
                <>
                  {addError && (
                    <div className='rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700'>
                      {addError}
                    </div>
                  )}
                  <p className='text-sm text-gray-500'>
                    Create login credentials for the driver. Their phone number
                    will be visible to customers during delivery.
                  </p>

                  <div>
                    <label className='mb-1 block text-sm font-medium text-gray-700'>
                      Phone Number <span className='text-red-500'>*</span>
                    </label>
                    <input
                      type='tel'
                      placeholder='e.g. +251912345678'
                      value={addForm.phone}
                      onChange={(e) =>
                        setAddForm((f) => ({ ...f, phone: e.target.value }))
                      }
                      className='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none'
                    />
                    <p className='mt-1 text-xs text-gray-400'>
                      Visible to customers on the delivery tracking screen.
                    </p>
                  </div>

                  <div>
                    <label className='mb-1 block text-sm font-medium text-gray-700'>
                      Username <span className='text-red-500'>*</span>
                    </label>
                    <input
                      type='text'
                      placeholder='e.g. abebe_driver'
                      value={addForm.username}
                      onChange={(e) =>
                        setAddForm((f) => ({
                          ...f,
                          username: e.target.value.replace(/\s/g, "_"),
                        }))
                      }
                      className='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none'
                      autoComplete='off'
                    />
                  </div>

                  <div>
                    <label className='mb-1 block text-sm font-medium text-gray-700'>
                      Password <span className='text-red-500'>*</span>
                    </label>
                    <div className='relative'>
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder='Min. 6 characters'
                        value={addForm.password}
                        onChange={(e) =>
                          setAddForm((f) => ({
                            ...f,
                            password: e.target.value,
                          }))
                        }
                        className='w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:border-blue-500 focus:outline-none'
                        autoComplete='new-password'
                      />
                      <button
                        type='button'
                        onClick={() => setShowPassword((v) => !v)}
                        className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600'
                      >
                        {showPassword ? (
                          <FiEyeOff size={16} />
                        ) : (
                          <FiEye size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {!addSuccess && (
              <div className='flex justify-end gap-3 border-t px-6 py-4'>
                <button
                  onClick={closeModal}
                  disabled={addLoading}
                  className='rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50'
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddDriver}
                  disabled={addLoading}
                  className='flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60'
                >
                  {addLoading && (
                    <span className='h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent' />
                  )}
                  {addLoading ? "Adding..." : "Add Driver"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Drivers;
