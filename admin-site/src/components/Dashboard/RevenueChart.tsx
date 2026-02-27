import React from "react";

interface RevenueChartProps {
  data: any[]; // Replace with proper type based on backend response
}

const RevenueChart: React.FC<RevenueChartProps> = ({ data }) => {
  return (
    <div className='bg-white p-4 rounded-lg shadow'>
      <h3 className='text-lg font-semibold mb-4'>Revenue Over Time</h3>
      <pre className='text-sm overflow-auto'>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
};

export default RevenueChart;
