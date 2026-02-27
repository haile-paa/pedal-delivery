import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface RevenueDataPoint {
  date: string;
  revenue: number;
}

interface RevenueChartProps {
  data: RevenueDataPoint[];
}

const RevenueChart: React.FC<RevenueChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className='bg-white p-4 rounded-lg shadow'>
        <h3 className='text-lg font-semibold mb-4'>Revenue Over Time</h3>
        <div className='h-64 flex items-center justify-center text-gray-500'>
          No revenue data available
        </div>
      </div>
    );
  }

  return (
    <div className='bg-white p-4 rounded-lg shadow'>
      <h3 className='text-lg font-semibold mb-4'>
        Revenue Over Time (Last 7 Days)
      </h3>
      <ResponsiveContainer width='100%' height={300}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray='3 3' />
          <XAxis
            dataKey='date'
            tickFormatter={(tick) => new Date(tick).toLocaleDateString()}
          />
          <YAxis />
          <Tooltip
            formatter={(value: number | undefined) => {
              if (value === undefined) return "N/A";
              return `ETB ${value.toLocaleString()}`;
            }}
          />
          <Line
            type='monotone'
            dataKey='revenue'
            stroke='#3b82f6'
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RevenueChart;
