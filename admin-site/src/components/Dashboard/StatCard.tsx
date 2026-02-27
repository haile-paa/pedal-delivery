import React from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string; // optional – only shown if provided
  icon: React.ReactNode;
  color: "blue" | "green" | "purple" | "orange";
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  icon,
  color,
}) => {
  const colorClasses = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-green-100 text-green-600",
    purple: "bg-purple-100 text-purple-600",
    orange: "bg-orange-100 text-orange-600",
  };

  return (
    <div className='rounded-lg bg-white p-6 shadow'>
      <div className='flex items-center justify-between'>
        <div>
          <p className='text-sm text-gray-600'>{title}</p>
          <p className='mt-2 text-3xl font-bold text-gray-800'>{value}</p>
          {change && (
            <p
              className={`mt-1 text-sm ${
                change.startsWith("+") ? "text-green-600" : "text-red-600"
              }`}
            >
              {change}
            </p>
          )}
        </div>
        <div className={`rounded-full p-3 ${colorClasses[color]}`}>{icon}</div>
      </div>
    </div>
  );
};

export default StatCard;
