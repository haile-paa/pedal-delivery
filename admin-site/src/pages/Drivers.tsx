import React, { useState, useEffect } from "react";
import {
  FiUser,
  FiStar,
  FiMapPin,
  FiPhone,
  FiRefreshCw,
  FiX,
  FiTruck,
} from "react-icons/fi";
import { driverAPI } from "../services/api";
import { useWebSocket } from "../hooks/useWebSocket";

interface Driver {
  id: string;
  name: string;
  phone: string;
  status: "active" | "on_break" | "offline";
  rating: number;
  deliveries: number;
  location: string;
  vehicleType?: string;
  vehiclePlate?: string;
  approvalStatus?: string; // pending | approved | rejected | suspended
}

interface BackendDriver {
  id: string;
  user_id?: string;
  status: string;
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

interface AddDriverForm {
  name: string;
  phone: string;
  vehicleType: string;
  vehicleModel: string;
  vehicleColor: string;
  licensePlate: string;
}

const VEHICLE_TYPES = ["bicycle", "motorcycle", "car", "scooter", "van"];

const emptyForm: AddDriverForm = {
  name: "",
  phone: "",
  vehicleType: "motorcycle",
  vehicleModel: "",
  vehicleColor: "",
  licensePlate: "",
};

const Drivers: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Add driver modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<AddDriverForm>(emptyForm);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);

  const { lastMessage } = useWebSocket("/ws/drivers");

  const mapDriver = (d: BackendDriver): Driver => {
    let status: Driver["status"] = "offline";
    if (d.is_online) status = "active";

    return {
      id: d.id,
      name: d.user?.name || "Unknown",
      phone: d.user?.phone || "N/A",
      status,
      rating: d.rating || 0,
      deliveries: d.total_trips || 0,
      location: d.location
        ? `${d.location.coordinates[1].toFixed(4)}, ${d.location.coordinates[0].toFixed(4)}`
        : "Location not available",
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
      const backendDrivers: BackendDriver[] = response.data || [];
      setDrivers(backendDrivers.map(mapDriver));
    } catch (err) {
      setError("Failed to load drivers. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

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
      } catch (e) {
        console.error("Failed to parse WebSocket message", e);
      }
    }
  }, [lastMessage]);

  const handleAddDriver = async () => {
    setAddError(null);

    // Validate
    if (!addForm.name.trim()) {
      setAddError("Driver name is required.");
      return;
    }
    if (!addForm.phone.trim()) {
      setAddError("Phone number is required.");
      return;
    }
    if (!addForm.vehicleType) {
      setAddError("Vehicle type is required.");
      return;
    }

    setAddLoading(true);
    try {
      const response = await driverAPI.create({
        name: addForm.name.trim(),
        phone: addForm.phone.trim(),
        vehicleType: addForm.vehicleType,
        vehicleModel: addForm.vehicleModel.trim() || undefined,
        vehicleColor: addForm.vehicleColor.trim() || undefined,
        licensePlate: addForm.licensePlate.trim() || undefined,
      });

      // Add the new driver to the top of the list
      const newDriver = mapDriver(response.data as BackendDriver);
      setDrivers((prev) => [newDriver, ...prev]);
      setAddSuccess(true);
      setTimeout(() => {
        setShowAddModal(false);
        setAddForm(emptyForm);
        setAddSuccess(false);
      }, 1200);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error || "Failed to add driver. Please try again.";
      setAddError(msg);
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
  };

  const getStatusColor = (status: Driver["status"]) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "on_break":
        return "bg-yellow-100 text-yellow-800";
      case "offline":
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getApprovalBadge = (approvalStatus?: string) => {
    switch (approvalStatus) {
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
            Manage drivers and their status
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

      {/* Error banner */}
      {error && (
        <div className='mb-4 p-4 bg-red-50 text-red-700 rounded-lg'>
          {error}
        </div>
      )}

      {/* Empty state */}
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
                    <p className='text-xs text-gray-400 font-mono'>
                      {driver.id.slice(-8)}
                    </p>
                  </div>
                </div>
                <div className='flex flex-col items-end gap-1'>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(driver.status)}`}
                  >
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
                <div className='flex items-center gap-2 text-gray-600'>
                  <FiPhone className='h-4 w-4 shrink-0' />
                  <span>{driver.phone}</span>
                </div>
                <div className='flex items-center gap-2 text-gray-600'>
                  <FiMapPin className='h-4 w-4 shrink-0' />
                  <span className='truncate'>{driver.location}</span>
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

      {/* ── Add New Driver Modal ─────────────────────────────────────── */}
      {showAddModal && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'>
          <div className='w-full max-w-md rounded-xl bg-white shadow-xl'>
            {/* Modal header */}
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

            {/* Modal body */}
            <div className='px-6 py-5 space-y-4'>
              {addSuccess ? (
                <div className='py-8 text-center'>
                  <div className='mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600 text-2xl'>
                    ✓
                  </div>
                  <p className='font-medium text-gray-800'>
                    Driver added successfully!
                  </p>
                </div>
              ) : (
                <>
                  {addError && (
                    <div className='rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700'>
                      {addError}
                    </div>
                  )}

                  {/* Name */}
                  <div>
                    <label className='mb-1 block text-sm font-medium text-gray-700'>
                      Full Name <span className='text-red-500'>*</span>
                    </label>
                    <input
                      type='text'
                      placeholder='e.g. Abebe Kebede'
                      value={addForm.name}
                      onChange={(e) =>
                        setAddForm((f) => ({ ...f, name: e.target.value }))
                      }
                      className='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none'
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className='mb-1 block text-sm font-medium text-gray-700'>
                      Phone Number <span className='text-red-500'>*</span>
                    </label>
                    <input
                      type='tel'
                      placeholder='e.g. +251911000000'
                      value={addForm.phone}
                      onChange={(e) =>
                        setAddForm((f) => ({ ...f, phone: e.target.value }))
                      }
                      className='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none'
                    />
                  </div>

                  {/* Vehicle Type */}
                  <div>
                    <label className='mb-1 block text-sm font-medium text-gray-700'>
                      Vehicle Type <span className='text-red-500'>*</span>
                    </label>
                    <select
                      value={addForm.vehicleType}
                      onChange={(e) =>
                        setAddForm((f) => ({
                          ...f,
                          vehicleType: e.target.value,
                        }))
                      }
                      className='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none'
                    >
                      {VEHICLE_TYPES.map((v) => (
                        <option key={v} value={v} className='capitalize'>
                          {v.charAt(0).toUpperCase() + v.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Vehicle Model & Color (side by side) */}
                  <div className='grid grid-cols-2 gap-3'>
                    <div>
                      <label className='mb-1 block text-sm font-medium text-gray-700'>
                        Vehicle Model
                      </label>
                      <input
                        type='text'
                        placeholder='e.g. Honda CB'
                        value={addForm.vehicleModel}
                        onChange={(e) =>
                          setAddForm((f) => ({
                            ...f,
                            vehicleModel: e.target.value,
                          }))
                        }
                        className='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none'
                      />
                    </div>
                    <div>
                      <label className='mb-1 block text-sm font-medium text-gray-700'>
                        Color
                      </label>
                      <input
                        type='text'
                        placeholder='e.g. Red'
                        value={addForm.vehicleColor}
                        onChange={(e) =>
                          setAddForm((f) => ({
                            ...f,
                            vehicleColor: e.target.value,
                          }))
                        }
                        className='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none'
                      />
                    </div>
                  </div>

                  {/* License Plate */}
                  <div>
                    <label className='mb-1 block text-sm font-medium text-gray-700'>
                      License Plate
                    </label>
                    <input
                      type='text'
                      placeholder='e.g. AA-12345'
                      value={addForm.licensePlate}
                      onChange={(e) =>
                        setAddForm((f) => ({
                          ...f,
                          licensePlate: e.target.value,
                        }))
                      }
                      className='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none'
                    />
                  </div>
                </>
              )}
            </div>

            {/* Modal footer */}
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
