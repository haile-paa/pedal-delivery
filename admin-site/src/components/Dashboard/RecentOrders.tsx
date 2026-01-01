import React from "react";

interface Order {
  id: string;
  customer: string;
  amount: number;
  status: "delivered" | "preparing" | "pending" | "picked_up" | "cancelled";
}

interface RecentOrdersProps {
  orders: Order[];
}

const RecentOrders: React.FC<RecentOrdersProps> = ({ orders }) => {
  const statusColors: Record<string, string> = {
    delivered: "bg-green-100 text-green-800",
    preparing: "bg-yellow-100 text-yellow-800",
    pending: "bg-blue-100 text-blue-800",
    picked_up: "bg-purple-100 text-purple-800",
    cancelled: "bg-red-100 text-red-800",
  };

  const statusText: Record<string, string> = {
    delivered: "Delivered",
    preparing: "Preparing",
    pending: "Pending",
    picked_up: "Picked Up",
    cancelled: "Cancelled",
  };

  return (
    <div className='rounded-lg bg-white p-6 shadow'>
      <div className='mb-4 flex items-center justify-between'>
        <h3 className='text-lg font-semibold text-gray-800'>Recent Orders</h3>
        <button className='text-sm text-blue-600 hover:text-blue-800'>
          View All
        </button>
      </div>

      <div className='overflow-x-auto'>
        <table className='w-full'>
          <thead>
            <tr className='border-b'>
              <th className='pb-3 text-left text-sm font-medium text-gray-600'>
                Order ID
              </th>
              <th className='pb-3 text-left text-sm font-medium text-gray-600'>
                Customer
              </th>
              <th className='pb-3 text-left text-sm font-medium text-gray-600'>
                Amount
              </th>
              <th className='pb-3 text-left text-sm font-medium text-gray-600'>
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className='border-b hover:bg-gray-50'>
                <td className='py-3 text-sm font-medium text-gray-800'>
                  {order.id}
                </td>
                <td className='py-3 text-sm text-gray-600'>{order.customer}</td>
                <td className='py-3 text-sm text-gray-600'>
                  ETB {order.amount.toFixed(2)}
                </td>
                <td className='py-3'>
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                      statusColors[order.status]
                    }`}
                  >
                    {statusText[order.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentOrders;
