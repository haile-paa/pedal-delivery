import React from "react";

const RevenueChart: React.FC = () => {
  // Mock data for the chart
  const data = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    values: [45000, 38000, 52000, 41000, 63000, 55000, 48000],
  };

  const maxValue = Math.max(...data.values);

  return (
    <div className='rounded-lg bg-white p-6 shadow'>
      <div className='mb-6 flex items-center justify-between'>
        <h3 className='text-lg font-semibold text-gray-800'>Weekly Revenue</h3>
        <button className='text-sm text-blue-600 hover:text-blue-800'>
          View Report
        </button>
      </div>

      <div className='relative h-64'>
        {/* Y-axis labels */}
        <div className='absolute left-0 top-0 flex h-full flex-col justify-between text-sm text-gray-500'>
          <span>60K</span>
          <span>45K</span>
          <span>30K</span>
          <span>15K</span>
          <span>0K</span>
        </div>

        {/* Chart bars */}
        <div className='absolute left-10 right-0 top-0 flex h-full items-end justify-between'>
          {data.values.map((value, index) => {
            const height = (value / maxValue) * 80; // 80% of chart height
            return (
              <div key={index} className='flex flex-col items-center'>
                <div
                  className='w-12 rounded-t-lg bg-linear-to-t from-blue-600 to-blue-400'
                  style={{ height: `${height}%` }}
                ></div>
                <span className='mt-2 text-sm text-gray-600'>
                  {data.labels[index]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RevenueChart;
