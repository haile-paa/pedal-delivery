import React from "react";

const OrderStatusChart: React.FC = () => {
  const statusData = [
    { label: "Delivered", value: 45, color: "bg-green-500" },
    { label: "Preparing", value: 25, color: "bg-yellow-500" },
    { label: "Pending", value: 20, color: "bg-blue-500" },
    { label: "Canceled", value: 10, color: "bg-red-500" },
  ];

  return (
    <div className='rounded-lg bg-white p-6 shadow'>
      <h3 className='mb-6 text-lg font-semibold text-gray-800'>
        Orders by Status
      </h3>

      <div className='flex flex-col space-y-4'>
        {statusData.map((status, index) => (
          <div key={index} className='flex items-center justify-between'>
            <div className='flex items-center'>
              <div className={`h-3 w-3 rounded-full ${status.color}`}></div>
              <span className='ml-2 text-sm text-gray-600'>
                {status.label}:
              </span>
            </div>
            <span className='font-medium'>{status.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OrderStatusChart;
