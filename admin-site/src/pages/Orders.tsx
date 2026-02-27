import React, { useState, useEffect } from "react";
import { FiSearch, FiMoreVertical } from "react-icons/fi";
import { adminAPI } from "../services/api";
import { useWebSocket } from "../hooks/useWebSocket";

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  restaurant_name: string;
  total_amount: number;
  status: string;
  created_at: string;
}

const Orders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { lastMessage } = useWebSocket("/ws/orders");

  useEffect(() => {
    fetchOrders();
  }, [page, statusFilter]);

  useEffect(() => {
    if (lastMessage) {
      try {
        const event = JSON.parse(lastMessage.data);
        if (event.type === "order_update") {
          const updatedOrder = event.data as Order;
          setOrders((prev) => {
            const index = prev.findIndex((o) => o.id === updatedOrder.id);
            if (index !== -1) {
              const newOrders = [...prev];
              newOrders[index] = updatedOrder;
              return newOrders;
            } else {
              return [updatedOrder, ...prev];
            }
          });
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message", error);
      }
    }
  }, [lastMessage]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getAllOrders(page, 20);
      const fetchedOrders = response.data.orders || [];
      setOrders(fetchedOrders);
      const total = response.data.pagination?.total || 0;
      setTotalPages(Math.ceil(total / 20));
    } catch (error) {
      console.error("Failed to fetch orders", error);
      setOrders([]);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
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
      case "on_the_way":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const filteredOrders = orders.filter(
    (order) =>
      order.order_number.toLowerCase().includes(search.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      order.restaurant_name.toLowerCase().includes(search.toLowerCase()),
  );

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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className='rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-blue-500 focus:outline-none'
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className='rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 focus:border-blue-500 focus:outline-none'
          >
            <option value=''>All Statuses</option>
            <option value='pending'>Pending</option>
            <option value='preparing'>Preparing</option>
            <option value='ready'>Ready</option>
            <option value='picked_up'>Picked Up</option>
            <option value='on_the_way'>On The Way</option>
            <option value='delivered'>Delivered</option>
            <option value='cancelled'>Cancelled</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className='flex items-center justify-center h-64'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
        </div>
      ) : (
        <>
          {filteredOrders.length === 0 ? (
            <div className='text-center py-12 bg-white rounded-lg shadow'>
              <p className='text-gray-500'>No orders found</p>
            </div>
          ) : (
            <div className='rounded-lg bg-white shadow'>
              <div className='overflow-x-auto'>
                <table className='w-full text-left'>
                  <thead className='border-b bg-gray-50 text-sm text-gray-600'>
                    <tr>
                      <th className='px-6 py-3'>Order #</th>
                      <th className='px-6 py-3'>Customer</th>
                      <th className='px-6 py-3'>Restaurant</th>
                      <th className='px-6 py-3'>Amount</th>
                      <th className='px-6 py-3'>Status</th>
                      <th className='px-6 py-3'>Time</th>
                      <th className='px-6 py-3'></th>
                    </tr>
                  </thead>
                  <tbody className='divide-y'>
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className='hover:bg-gray-50'>
                        <td className='px-6 py-4 font-medium'>
                          {order.order_number}
                        </td>
                        <td className='px-6 py-4'>{order.customer_name}</td>
                        <td className='px-6 py-4'>{order.restaurant_name}</td>
                        <td className='px-6 py-4'>
                          ETB {order.total_amount.toFixed(2)}
                        </td>
                        <td className='px-6 py-4'>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(
                              order.status,
                            )}`}
                          >
                            {order.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className='px-6 py-4 text-gray-500'>
                          {new Date(order.created_at).toLocaleTimeString()}
                        </td>
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
          )}

          {/* Pagination */}
          {totalPages > 0 && (
            <div className='mt-4 flex justify-center gap-2'>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className='rounded bg-gray-200 px-3 py-1 disabled:opacity-50'
              >
                Previous
              </button>
              <span className='px-3 py-1'>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className='rounded bg-gray-200 px-3 py-1 disabled:opacity-50'
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Orders;
