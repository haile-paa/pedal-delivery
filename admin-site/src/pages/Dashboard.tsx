import React from "react";
import { FiTrendingUp, FiClock, FiUsers, FiShoppingBag } from "react-icons/fi";
import StatCard from "../components/Dashboard/StatCard";
import RecentOrders from "../components/Dashboard/RecentOrders";
import TopRestaurants from "../components/Dashboard/TopRestaurants";
import RevenueChart from "../components/Dashboard/RevenueChart";
import OrderStatusChart from "../components/Dashboard/OrderStatusChart";

// Import the Order type from RecentOrders if it's exported, or define it locally
interface Order {
  id: string;
  customer: string;
  amount: number;
  status: "delivered" | "preparing" | "pending" | "picked_up" | "cancelled";
}

const Dashboard: React.FC = () => {
  const stats = {
    totalOrders: 0,
    totalRevenue: 0,
    avgDeliveryTime: 0,
    activeDrivers: 0,
  };

  // Explicitly type the orders array with the Order interface
  const recentOrders: Order[] = [
    {
      id: "ORD-8542",
      customer: "Alex Johnson",
      amount: 632.75,
      status: "delivered",
    },
    {
      id: "ORD-8543",
      customer: "Maria Santos",
      amount: 888.0,
      status: "preparing",
    },
    {
      id: "ORD-8544",
      customer: "John Doe",
      amount: 572.0,
      status: "pending",
    },
    {
      id: "ORD-8545",
      customer: "Emily Brown",
      amount: 759.0,
      status: "picked_up",
    },
    {
      id: "ORD-8546",
      customer: "Michael Chen",
      amount: 418.0,
      status: "cancelled",
    },
  ];

  const topRestaurants = [
    { id: 1, name: "Burger Kingdom", orders: 1250, rating: 4.5 },
    { id: 2, name: "Mama Italia", orders: 980, rating: 4.8 },
    { id: 3, name: "Spice Garden", orders: 850, rating: 4.3 },
    { id: 4, name: "Sushi Master", orders: 720, rating: 4.6 },
    { id: 5, name: "Taco Fiesta", orders: 650, rating: 4.2 },
  ];

  return (
    <div>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold text-gray-800'>Dashboard</h1>
        <p className='text-gray-600'>
          Welcome back! Here's what's happening today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4'>
        <StatCard
          title="Today's Orders"
          value={stats.totalOrders}
          change='+12% from yesterday'
          icon={<FiShoppingBag className='h-6 w-6 text-blue-600' />}
          color='blue'
        />
        <StatCard
          title="Today's Revenue"
          value={`ETB ${stats.totalRevenue.toLocaleString()}`}
          change='+8.3% from yesterday'
          icon={<FiTrendingUp className='h-6 w-6 text-green-600' />}
          color='green'
        />
        <StatCard
          title='Avg. Delivery Time'
          value={`${stats.avgDeliveryTime} min`}
          change='-2 min from last week'
          icon={<FiClock className='h-6 w-6 text-purple-600' />}
          color='purple'
        />
        <StatCard
          title='Active Drivers'
          value={stats.activeDrivers}
          change='3 on break'
          icon={<FiUsers className='h-6 w-6 text-orange-600' />}
          color='orange'
        />
      </div>

      {/* Charts Section */}
      <div className='mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2'>
        <RevenueChart />
        <OrderStatusChart />
      </div>

      {/* Tables Section */}
      <div className='mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2'>
        <RecentOrders orders={recentOrders} />
        <TopRestaurants restaurants={topRestaurants} />
      </div>
    </div>
  );
};

export default Dashboard;
