import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface OrderStatusChartProps {
  data: Record<string, number>;
}

const COLORS: Record<string, string> = {
  pending: "#60a5fa",
  preparing: "#fbbf24",
  ready: "#34d399",
  picked_up: "#a78bfa",
  delivered: "#10b981",
  cancelled: "#ef4444",
  rejected: "#f97316",
  accepted: "#3b82f6",
  on_the_way: "#8b5cf6",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  preparing: "Preparing",
  ready: "Ready",
  picked_up: "Picked Up",
  delivered: "Delivered",
  cancelled: "Cancelled",
  rejected: "Rejected",
  accepted: "Accepted",
  on_the_way: "On The Way",
};

const OrderStatusChart: React.FC<OrderStatusChartProps> = ({ data }) => {
  const chartData = Object.entries(data).map(([status, count]) => ({
    name: STATUS_LABELS[status] || status,
    value: count,
    status,
  }));

  if (chartData.length === 0) {
    return (
      <div className='bg-white p-4 rounded-lg shadow'>
        <h3 className='text-lg font-semibold mb-4'>
          Order Status Distribution
        </h3>
        <div className='h-64 flex items-center justify-center text-gray-500'>
          No order data available
        </div>
      </div>
    );
  }

  return (
    <div className='bg-white p-4 rounded-lg shadow'>
      <h3 className='text-lg font-semibold mb-4'>
        Order Status Distribution (Today)
      </h3>
      <ResponsiveContainer width='100%' height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx='50%'
            cy='50%'
            labelLine={false}
            label={({ name, percent = 0 }) =>
              `${name}: ${(percent * 100).toFixed(0)}%`
            }
            outerRadius={80}
            fill='#8884d8'
            dataKey='value'
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[entry.status] || "#9ca3af"}
              />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default OrderStatusChart;
