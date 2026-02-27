import React, { useState, useEffect } from "react";
import { FiTrendingUp, FiClock, FiUsers, FiShoppingBag } from "react-icons/fi";
import StatCard from "../components/Dashboard/StatCard";
import RecentOrders from "../components/Dashboard/RecentOrders";
import TopRestaurants from "../components/Dashboard/TopRestaurants";
import RevenueChart from "../components/Dashboard/RevenueChart";
import OrderStatusChart from "../components/Dashboard/OrderStatusChart";
import { adminAPI } from "../services/api";
import { useWebSocket } from "../hooks/useWebSocket";

interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  avgDeliveryTime: number;
  activeDrivers: number;
}

interface BackendOrder {
  id: string;
  order_number: string;
  customer_name: string;
  total_amount: number;
  status: string;
  created_at: string;
}

interface BackendRestaurant {
  id: string;
  name: string;
  order_count: number;
  rating: number;
}

type OrderStatus =
  | "delivered"
  | "preparing"
  | "pending"
  | "picked_up"
  | "cancelled";

interface RecentOrderProps {
  id: string;
  customer: string;
  amount: number;
  status: OrderStatus;
}

interface TopRestaurantProps {
  id: number;
  name: string;
  orders: number;
  rating: number;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    totalRevenue: 0,
    avgDeliveryTime: 0,
    activeDrivers: 0,
  });
  const [recentOrders, setRecentOrders] = useState<BackendOrder[]>([]);
  const [topRestaurants, setTopRestaurants] = useState<BackendRestaurant[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [revenueOverTime, setRevenueOverTime] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { lastMessage } = useWebSocket("/ws/orders");

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (lastMessage) {
      try {
        const event = JSON.parse(lastMessage.data);
        if (event.type === "order_update") {
          const updatedOrder = event.data as BackendOrder;
          setRecentOrders((prev) => {
            const index = prev.findIndex((o) => o.id === updatedOrder.id);
            if (index !== -1) {
              const newOrders = [...prev];
              newOrders[index] = updatedOrder;
              return newOrders;
            } else {
              return [updatedOrder, ...prev.slice(0, 9)];
            }
          });
          // Optionally refresh stats
          fetchDashboardData();
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message", error);
      }
    }
  }, [lastMessage]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getDashboardStats();
      const data = response.data;
      setStats(
        data.stats || {
          totalOrders: 0,
          totalRevenue: 0,
          avgDeliveryTime: 0,
          activeDrivers: 0,
        },
      );
      setRecentOrders(
        Array.isArray(data.recentOrders) ? data.recentOrders : [],
      );
      setTopRestaurants(
        Array.isArray(data.topRestaurants) ? data.topRestaurants : [],
      );
      setStatusCounts(data.statusCounts || {});
      setRevenueOverTime(
        Array.isArray(data.revenueOverTime) ? data.revenueOverTime : [],
      );
    } catch (error) {
      console.error("Failed to fetch dashboard data", error);
    } finally {
      setLoading(false);
    }
  };

  const mapStatus = (status: string): OrderStatus => {
    if (
      ["delivered", "preparing", "pending", "picked_up", "cancelled"].includes(
        status,
      )
    ) {
      return status as OrderStatus;
    }
    return "pending";
  };

  const mappedRecentOrders: RecentOrderProps[] = (recentOrders || []).map(
    (order) => ({
      id: order.order_number,
      customer: order.customer_name,
      amount: order.total_amount,
      status: mapStatus(order.status),
    }),
  );

  const mappedTopRestaurants: TopRestaurantProps[] = (topRestaurants || []).map(
    (rest, index) => ({
      id: index + 1,
      name: rest.name,
      orders: rest.order_count,
      rating: rest.rating,
    }),
  );

  if (loading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
      </div>
    );
  }

  return (
    <div>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold text-gray-800'>Dashboard</h1>
        <p className='text-gray-600'>
          Welcome back! Here's what's happening today.
        </p>
      </div>

      <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4'>
        <StatCard
          title="Today's Orders"
          value={stats.totalOrders}
          icon={<FiShoppingBag className='h-6 w-6 text-blue-600' />}
          color='blue'
        />
        <StatCard
          title="Today's Revenue"
          value={`ETB ${stats.totalRevenue.toLocaleString()}`}
          icon={<FiTrendingUp className='h-6 w-6 text-green-600' />}
          color='green'
        />
        <StatCard
          title='Avg. Delivery Time'
          value={`${stats.avgDeliveryTime} min`}
          icon={<FiClock className='h-6 w-6 text-purple-600' />}
          color='purple'
        />
        <StatCard
          title='Active Drivers'
          value={stats.activeDrivers}
          icon={<FiUsers className='h-6 w-6 text-orange-600' />}
          color='orange'
        />
      </div>

      <div className='mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2'>
        <RevenueChart data={revenueOverTime} />
        <OrderStatusChart data={statusCounts} />
      </div>

      <div className='mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2'>
        <RecentOrders orders={mappedRecentOrders} />
        <TopRestaurants restaurants={mappedTopRestaurants} />
      </div>
    </div>
  );
};

export default Dashboard;
