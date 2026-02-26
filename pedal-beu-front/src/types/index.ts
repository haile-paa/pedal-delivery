// User Types
export interface User {
  id: string;
  phone: string;
  email?: string;
  role: "customer" | "driver" | "admin";
  name?: string; // Mapped from profile.first_name or username
  profile: {
    first_name: string;
    last_name?: string;
    avatar?: string;
    addresses?: Address[];
  };
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  // Optional fields for drivers
  driver_profile?: DriverProfile;
}

export interface BackendUser {
  id: string;
  phone: string;
  email?: string;
  username?: string;
  firstName: string; // camelCase from backend
  role: "customer" | "driver" | "admin";
}

export interface Customer extends User {
  addresses: Address[];
  favoriteRestaurants: string[];
}

export interface DriverProfile {
  status: "pending" | "approved" | "rejected" | "suspended";
  vehicle: Vehicle;
  documents: Document[];
  rating: number;
  total_trips: number;
  earnings: DriverEarnings;
  is_online: boolean;
  location?: GeoLocation;
}

export interface Driver extends User {
  driver_profile: DriverProfile;
}

// Updated Auth Types
export interface AuthResponse {
  success: boolean;
  message?: string;
  user?: User;
  tokens?: {
    access_token: string;
    refresh_token: string;
  };
  exists?: boolean; // For OTP verification
  otp?: string; // For development only
  error?: string;
}

export interface RegisterRequest {
  phone: string;
  email?: string;
  first_name: string;
  role: "customer" | "driver";
  password?: string; // Optional, auto-generated for drivers
}

export interface LoginRequest {
  phone: string;
  password: string;
}

export interface LoginWithOTPRequest {
  phone: string;
}

export interface VerifyOTPRequest {
  phone: string;
  code: string;
  role?: "customer" | "driver";
}

export interface SendOTPRequest {
  phone: string;
  role?: "customer" | "driver";
}

// API Response Types
export interface OTPResponse {
  message: string;
  role?: string;
}

export interface VerifyOTPResponse {
  message: string;
  exists: boolean;
  role?: string;
  user?: {
    id: string;
    phone: string;
    email?: string;
    firstName: string;
    role: string;
  };
}

// Restaurant Types (unchanged, keep as before)
export interface Restaurant {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  cuisine_type: string[];
  location: {
    type: string;
    coordinates: number[];
  };
  address: string;
  phone: string;
  email?: string;
  images: string[];
  menu: MenuItem[];
  is_active: boolean;
  is_verified: boolean;
  rating: number;
  total_reviews: number;
  opening_hours: OpeningHours;
  delivery_fee: number;
  min_order: number;
  delivery_time: number; // in minutes
  created_at: string;
  updated_at: string;

  distance_km?: number;
  distance_m?: number;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  category: string;
  ingredients: string[];
  addons: Addon[];
  is_available: boolean;
  preparation_time: number; // in minutes
  created_at: string;
  updated_at: string;
}

export interface Addon {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
}

// Order Types (unchanged, keep as before)
export type OrderStatus =
  | "pending"
  | "accepted"
  | "preparing"
  | "ready"
  | "picked_up"
  | "on_the_way"
  | "delivered"
  | "cancelled"
  | "rejected";

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  driver_id?: string;
  restaurant_id: string;
  items: OrderItem[];
  status: OrderStatus;
  total_amount: OrderAmount;
  delivery_info: DeliveryInfo;
  timeline: OrderEvent[];
  payment_method: string;
  payment_status: "pending" | "paid" | "failed" | "refunded";
  rating?: OrderRating;
  is_scheduled: boolean;
  scheduled_for?: string;
  cancellation?: CancellationInfo;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  menu_item_id: string;
  name: string;
  quantity: number;
  price: number;
  addons: OrderItemAddon[];
  total: number;
  notes?: string;
}

export interface OrderItemAddon {
  addon_id: string;
  name: string;
  price: number;
}

export interface OrderAmount {
  subtotal: number;
  delivery_fee: number;
  service_charge: number;
  discount: number;
  tax: number;
  total: number;
}

export interface DeliveryInfo {
  address: Address;
  notes?: string;
  contact_name: string;
  contact_phone: string;
  estimated_delivery: string;
  actual_delivery?: string;
}

export interface OrderEvent {
  status: OrderStatus;
  timestamp: string;
  actor_id?: string;
  actor_type?: "customer" | "driver" | "restaurant" | "system";
  notes?: string;
}

export interface OrderRating {
  food_rating: number;
  delivery_rating: number;
  restaurant_rating: number;
  comment?: string;
  rated_at: string;
}

export interface CancellationInfo {
  reason: string;
  cancelled_by: string;
  role: string;
  timestamp: string;
  refund_amount?: number;
}

// Utility Types (unchanged)
export interface GeoLocation {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface Address {
  id: string;
  label: string;
  address: string;
  location: GeoLocation;
  is_default: boolean;
  created_at: string;
}

export interface Vehicle {
  type: "bicycle" | "motorcycle" | "car";
  model?: string;
  color?: string;
  plate?: string;
  year?: number;
}

export interface Document {
  id: string;
  type: "license" | "insurance" | "registration";
  url: string;
  status: "pending" | "approved" | "rejected";
  verified_at?: string;
  created_at: string;
}

export interface OpeningHours {
  monday: TimeSlot[];
  tuesday: TimeSlot[];
  wednesday: TimeSlot[];
  thursday: TimeSlot[];
  friday: TimeSlot[];
  saturday: TimeSlot[];
  sunday: TimeSlot[];
}

export interface TimeSlot {
  open: string; // "09:00"
  close: string; // "22:00"
}

export interface DriverEarnings {
  today: number;
  this_week: number;
  this_month: number;
  total: number;
  pending: number;
  last_payout_at?: string;
}

// Cart Types
export interface CartItem {
  id: string;
  menu_item: MenuItem;
  quantity: number;
  selected_addons: Addon[];
  special_instructions?: string;
}

// Notification Types
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: "order" | "system" | "promotion";
  data?: any;
  is_read: boolean;
  created_at: string;
}

// Chat Types
export interface ChatMessage {
  id: string;
  order_id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

// Pagination Types
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

// Error Response
export interface ErrorResponse {
  error: string;
  message?: string;
  details?: any;
}

// API Request Options
export interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, any>;
  timeout?: number;
}

// WebSocket Types
export interface WebSocketMessage {
  type: "order_update" | "chat_message" | "location_update" | "notification";
  data: any;
  timestamp: string;
}

// API Status Types
export interface HealthCheckResponse {
  status: "healthy" | "unhealthy";
  timestamp: number;
  services?: {
    database: boolean;
    redis: boolean;
    storage: boolean;
  };
}
