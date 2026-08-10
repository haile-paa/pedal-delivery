import React, { useState, useEffect } from "react";
import { FiSearch, FiMoreVertical } from "react-icons/fi";
import { adminAPI, orderAPI } from "../services/api";
import { useWebSocket } from "../hooks/useWebSocket";

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone?: string;
  restaurant_name: string;
  driver_name?: string;
  driver_phone?: string;
  total_amount: number | string | { total?: number | string };
  status: string;
  payment_method?: string;
  payment_status?: string;
  payment_verification?: {
    status?: string;
    transaction_reference?: string;
    provider_status?: string;
    payer_phone?: string;
    proof_url?: string;
  };
  created_at: string;
}

// Helper function to safely format amount to two decimal places
const formatAmount = (
  amount: number | string | { total?: number | string },
): string => {
  const normalized =
    typeof amount === "object" && amount !== null ? amount.total : amount;
  const num =
    typeof normalized === "number"
      ? normalized
      : parseFloat(String(normalized ?? 0));
  return isNaN(num) ? "0.00" : num.toFixed(2);
};

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

  const reviewPayment = async (orderId: string, approved: boolean) => {
    try {
      await adminAPI.reviewPayment(
        orderId,
        approved,
        approved ? "Approved by admin" : "Rejected by admin",
      );
      await fetchOrders();
    } catch (error) {
      console.error("Failed to review payment", error);
      alert("Failed to review payment. Please try again.");
    }
  };

  // The restaurant side of the order lifecycle (accept/prepare/ready) is
  // driven from here, since this app has no separate restaurant portal —
  // restaurants are managed through the admin site. Without this, orders
  // would sit at "pending" forever and drivers would never see them.
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const nextActionsFor = (
    status: string,
  ): { label: string; nextStatus: string; style: string }[] => {
    switch (status) {
      case "pending":
        return [
          {
            label: "Accept",
            nextStatus: "accepted",
            style: "bg-green-600 hover:bg-green-700",
          },
          {
            label: "Reject",
            nextStatus: "rejected",
            style: "bg-red-600 hover:bg-red-700",
          },
        ];
      case "accepted":
        return [
          {
            label: "Start Preparing",
            nextStatus: "preparing",
            style: "bg-yellow-600 hover:bg-yellow-700",
          },
        ];
      case "preparing":
        return [
          {
            label: "Mark Ready",
            nextStatus: "ready",
            style: "bg-blue-600 hover:bg-blue-700",
          },
        ];
      default:
        return [];
    }
  };

  const updateOrderStatus = async (orderId: string, nextStatus: string) => {
    setUpdatingOrderId(orderId);
    try {
      await orderAPI.updateStatus(orderId, nextStatus);
      await fetchOrders();
    } catch (error: any) {
      console.error("Failed to update order status", error);
      alert(
        error?.response?.data?.error ||
          "Failed to update order status. Please try again.",
      );
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const filteredOrders = orders.filter(
    (order) =>
      order.order_number.toLowerCase().includes(search.toLowerCase()) ||
      (order.customer_name || "")
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      (order.restaurant_name || "")
        .toLowerCase()
        .includes(search.toLowerCase()),
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
                      <th className='px-6 py-3'>Driver</th>
                      <th className='px-6 py-3'>Amount</th>
                      <th className='px-6 py-3'>Status</th>
                      <th className='px-6 py-3'>Payment</th>
                      <th className='px-6 py-3'>Time</th>
                      <th className='px-6 py-3'>Action</th>
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
                          {order.driver_name ? (
                            <div className='flex flex-col'>
                              <span className='font-medium text-gray-700'>
                                {order.driver_name}
                              </span>
                              {order.driver_phone && (
                                <span className='text-xs text-gray-400'>
                                  {order.driver_phone}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className='text-xs text-gray-400'>
                              Not yet assigned
                            </span>
                          )}
                        </td>
                        <td className='px-6 py-4'>
                          ETB {formatAmount(order.total_amount)}
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
                        <td className='px-6 py-4'>
                          <div className='flex flex-col gap-1 text-sm'>
                            <span className='font-medium text-gray-700'>
                              {(order.payment_method || "cash").replace(
                                /_/g,
                                " ",
                              )}
                            </span>
                            <span className='text-gray-500'>
                              {order.payment_status || "pending"}
                            </span>
                            {order.payment_verification
                              ?.transaction_reference && (
                              <span className='text-xs text-gray-400'>
                                Ref:{" "}
                                {
                                  order.payment_verification
                                    .transaction_reference
                                }
                              </span>
                            )}
                            {order.payment_verification?.payer_phone && (
                              <span className='text-xs text-gray-400'>
                                Phone: {order.payment_verification.payer_phone}
                              </span>
                            )}
                            {order.payment_verification?.proof_url && (
                              <a
                                href={order.payment_verification.proof_url}
                                target='_blank'
                                rel='noreferrer'
                                className='text-xs text-blue-600 underline'
                              >
                                View proof
                              </a>
                            )}
                            {order.payment_verification?.status ===
                              "pending_review" && (
                              <div className='mt-1 flex gap-2'>
                                <button
                                  onClick={() => reviewPayment(order.id, true)}
                                  className='rounded bg-green-600 px-2 py-1 text-xs text-white'
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => reviewPayment(order.id, false)}
                                  className='rounded bg-red-600 px-2 py-1 text-xs text-white'
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className='px-6 py-4 text-gray-500'>
                          {new Date(order.created_at).toLocaleTimeString()}
                        </td>
                        <td className='px-6 py-4'>
                          <div className='flex gap-2'>
                            {nextActionsFor(order.status).map((action) => (
                              <button
                                key={action.nextStatus}
                                onClick={() =>
                                  updateOrderStatus(order.id, action.nextStatus)
                                }
                                disabled={updatingOrderId === order.id}
                                className={`rounded px-2 py-1 text-xs font-medium text-white disabled:opacity-50 ${action.style}`}
                              >
                                {updatingOrderId === order.id
                                  ? "..."
                                  : action.label}
                              </button>
                            ))}
                          </div>
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
