export interface Restaurant {
  _id: string;
  name: string;
  description: string;
  cuisine_type: string[];
  address: string;
  phone: string;
  email: string;
  latitude: number;
  longitude: number;
  delivery_fee: number;
  min_order: number;
  delivery_time: number;
  is_active: boolean;
  is_verified: boolean;
  images: string[];
  menu: MenuItem[];
  rating: number;
  total_reviews: number;
  created_at: string;
  updated_at: string;
}

export interface MenuItem {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  ingredients: string[];
  is_available: boolean;
  preparation_time: number;
  image: string;
}

export interface Order {
  _id: string;
  order_number: string;
  customer_name: string;
  total_amount: number;
  status: "pending" | "preparing" | "ready" | "delivered" | "cancelled";
  items: number;
  created_at: string;
}

export interface Driver {
  _id: string;
  name: string;
  phone: string;
  status: "active" | "inactive" | "on_break";
  vehicle: string;
  total_trips: number;
  rating: number;
}

export interface DashboardStats {
  total_orders: number;
  total_revenue: number;
  avg_delivery_time: number;
  active_drivers: number;
}
