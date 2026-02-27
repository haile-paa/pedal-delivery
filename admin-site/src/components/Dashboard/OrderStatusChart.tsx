import React from "react";

interface OrderStatusChartProps {
  data: Record<string, number>;
}

const OrderStatusChart: React.FC<OrderStatusChartProps> = ({ data }) => {
  return (
    <div className='bg-white p-4 rounded-lg shadow'>
      <h3 className='text-lg font-semibold mb-4'>Order Status Distribution</h3>
      <pre className='text-sm overflow-auto'>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
};

export default OrderStatusChart;
