import { Restaurant, MenuItem, Order, Customer, Driver } from "../types";

export const mockRestaurants: Restaurant[] = [
  {
    id: "1",
    name: "Burger Palace",
    image: "https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?w=500",
    rating: 4.5,
    deliveryTime: "20-30 min",
    minOrder: 15,
    deliveryFee: 2.99,
    categories: ["Burgers", "American", "Fast Food"],
    isOpen: true,
    location: {
      latitude: 40.7128,
      longitude: -74.006,
      address: "123 Main St, New York, NY",
    },
    description:
      "Best burgers in town with fresh ingredients and amazing flavors.",
  },
  {
    id: "2",
    name: "Sushi Garden",
    image: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=500",
    rating: 4.8,
    deliveryTime: "30-40 min",
    minOrder: 25,
    deliveryFee: 3.99,
    categories: ["Japanese", "Sushi", "Asian"],
    isOpen: true,
    location: {
      latitude: 40.7128,
      longitude: -74.006,
      address: "456 Oak Ave, New York, NY",
    },
    description: "Authentic Japanese sushi and traditional dishes.",
  },
  {
    id: "3",
    name: "Pizza Heaven",
    image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=500",
    rating: 4.3,
    deliveryTime: "25-35 min",
    minOrder: 20,
    deliveryFee: 1.99,
    categories: ["Pizza", "Italian", "Fast Food"],
    isOpen: false,
    location: {
      latitude: 40.7128,
      longitude: -74.006,
      address: "789 Pine St, New York, NY",
    },
    description: "Wood-fired pizzas with fresh toppings and delicious crust.",
  },
];

export const mockMenuItems: MenuItem[] = [
  {
    id: "1",
    name: "Classic Cheeseburger",
    description: "Beef patty with cheese, lettuce, tomato, and special sauce",
    price: 12.99,
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500",
    category: "Burgers",
    ingredients: ["Beef", "Cheese", "Lettuce", "Tomato", "Sauce"],
    isAvailable: true,
    variations: [
      { name: "Single", price: 12.99 },
      { name: "Double", price: 16.99 },
    ],
  },
  {
    id: "2",
    name: "California Roll",
    description: "Crab, avocado, and cucumber roll",
    price: 8.99,
    image: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=500",
    category: "Sushi",
    ingredients: ["Rice", "Crab", "Avocado", "Cucumber", "Nori"],
    isAvailable: true,
  },
];

export const mockOrders: Order[] = [
  {
    id: "1",
    customerId: "1",
    restaurantId: "1",
    restaurantName: "Burger Palace",
    items: [
      {
        menuItemId: "1",
        name: "Classic Cheeseburger",
        quantity: 2,
        price: 12.99,
        variation: "Double",
      },
    ],
    status: "delivered",
    total: 25.98,
    deliveryAddress: {
      id: "1",
      name: "Home",
      address: "123 Main St, New York, NY",
      location: { latitude: 40.7128, longitude: -74.006 },
      isDefault: true,
    },
    createdAt: new Date("2024-01-15"),
    estimatedDelivery: new Date("2024-01-15"),
  },
];

export const mockCustomer: Customer = {
  id: "1",
  phone: "+1234567890",
  email: "customer@example.com",
  name: "John Doe",
  role: "customer",
  addresses: [
    {
      id: "1",
      name: "Home",
      address: "123 Main St, New York, NY",
      location: { latitude: 40.7128, longitude: -74.006 },
      isDefault: true,
    },
  ],
  favoriteRestaurants: ["1", "2"],
  createdAt: new Date(),
};

export const mockDriver: Driver = {
  id: "2",
  phone: "+1234567891",
  email: "driver@example.com",
  name: "Mike Johnson",
  role: "driver",
  isOnline: false,
  vehicle: {
    type: "Motorcycle",
    plateNumber: "ABC123",
    color: "Red",
  },
  documents: [],
  rating: 4.8,
  totalTrips: 150,
  createdAt: new Date(),
};
