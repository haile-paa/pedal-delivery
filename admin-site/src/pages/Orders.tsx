import React, { useState } from "react";
import { FiSearch, FiFilter, FiMoreVertical } from "react-icons/fi";

interface Order {
  id: string;
  customer: string;
  restaurant: string;
  amount: number;
  status: "pending" | "preparing" | "picked_up" | "delivered" | "cancelled";
  time: string;
}

const Orders: React.FC = () => {
  const [orders] = useState<Order[]>([
    {
      id: "ORD-8542",
      customer: "Alex Johnson",
      restaurant: "Burger Kingdom",
      amount: 632.75,
      status: "delivered",
      time: "10 min ago",
    },
    {
      id: "ORD-8543",
      customer: "Maria Santos",
      restaurant: "Mama Italia",
      amount: 888.0,
      status: "preparing",
      time: "15 min ago",
    },
    {
      id: "ORD-8544",
      customer: "John Doe",
      restaurant: "Spice Garden",
      amount: 572.0,
      status: "pending",
      time: "22 min ago",
    },
    {
      id: "ORD-8545",
      customer: "Emily Brown",
      restaurant: "Sushi Master",
      amount: 759.0,
      status: "picked_up",
      time: "30 min ago",
    },
    {
      id: "ORD-8546",
      customer: "Michael Chen",
      restaurant: "Taco Fiesta",
      amount: 418.0,
      status: "cancelled",
      time: "45 min ago",
    },
  ]);

  const getStatusColor = (status: Order["status"]) => {
    switch (status) {
      case "delivered":
        return "bg-green-100 text-green-800";
      case "preparing":
        return "bg-yellow-100 text-yellow-800";
      case "pending":
        return "bg-gray-100 text-gray-800";
      case "picked_up":
        return "bg-blue-100 text-blue-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div>
      <div className='mb-6 flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-800'>Orders</h1>
          <p className='text-gray-600'>View and manage all orders</p>
        </div>
        <div className='flex gap-3'>
          <div className='relative'>
            <FiSearch className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400' />
            <input
              type='text'
              placeholder='Search orders...'
              className='rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:outline-none'
            />
          </div>
          <button className='flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50'>
            <FiFilter /> Filter
          </button>
        </div>
      </div>

      <div className='rounded-lg bg-white shadow'>
        <div className='overflow-x-auto'>
          <table className='w-full text-left'>
            <thead className='border-b bg-gray-50 text-sm text-gray-600'>
              <tr>
                <th className='px-6 py-3'>Order ID</th>
                <th className='px-6 py-3'>Customer</th>
                <th className='px-6 py-3'>Restaurant</th>
                <th className='px-6 py-3'>Amount</th>
                <th className='px-6 py-3'>Status</th>
                <th className='px-6 py-3'>Time</th>
                <th className='px-6 py-3'></th>
              </tr>
            </thead>
            <tbody className='divide-y'>
              {orders.map((order) => (
                <tr key={order.id} className='hover:bg-gray-50'>
                  <td className='px-6 py-4 font-medium'>{order.id}</td>
                  <td className='px-6 py-4'>{order.customer}</td>
                  <td className='px-6 py-4'>{order.restaurant}</td>
                  <td className='px-6 py-4'>ETB {order.amount.toFixed(2)}</td>
                  <td className='px-6 py-4'>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(
                        order.status,
                      )}`}
                    >
                      {order.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className='px-6 py-4 text-gray-500'>{order.time}</td>
                  <td className='px-6 py-4'>
                    <button className='text-gray-400 hover:text-gray-600'>
                      <FiMoreVertical />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Orders;
