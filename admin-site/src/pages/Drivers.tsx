import React, { useState } from "react";
import { FiUser, FiStar, FiMapPin, FiPhone } from "react-icons/fi";

interface Driver {
  id: string;
  name: string;
  phone: string;
  status: "active" | "on_break" | "offline";
  rating: number;
  deliveries: number;
  location: string;
}

const Drivers: React.FC = () => {
  const [drivers] = useState<Driver[]>([
    {
      id: "DRV-001",
      name: "James Wilson",
      phone: "+251 912 345 678",
      status: "active",
      rating: 4.8,
      deliveries: 124,
      location: "Bole, Addis Ababa",
    },
    {
      id: "DRV-002",
      name: "Sarah Tekle",
      phone: "+251 923 456 789",
      status: "on_break",
      rating: 4.9,
      deliveries: 98,
      location: "Kazanchis, Addis Ababa",
    },
    {
      id: "DRV-003",
      name: "Meron Alemu",
      phone: "+251 934 567 890",
      status: "offline",
      rating: 4.5,
      deliveries: 56,
      location: "CMC, Addis Ababa",
    },
    {
      id: "DRV-004",
      name: "Tsegaye Hailu",
      phone: "+251 945 678 901",
      status: "active",
      rating: 4.7,
      deliveries: 210,
      location: "Megenagna, Addis Ababa",
    },
  ]);

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

  return (
    <div>
      <div className='mb-6 flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-800'>Drivers</h1>
          <p className='text-gray-600'>Manage drivers and their status</p>
        </div>
        <button className='rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700'>
          Add New Driver
        </button>
      </div>

      <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
        {drivers.map((driver) => (
          <div key={driver.id} className='rounded-lg bg-white p-6 shadow'>
            <div className='mb-4 flex items-center justify-between'>
              <div className='flex items-center gap-3'>
                <div className='flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600'>
                  <FiUser size={24} />
                </div>
                <div>
                  <h3 className='font-semibold text-gray-800'>{driver.name}</h3>
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
    </div>
  );
};

export default Drivers;
