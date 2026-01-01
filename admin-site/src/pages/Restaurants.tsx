import React, { useState, useEffect } from "react";
import {
  FiSearch,
  FiFilter,
  FiEdit2,
  FiTrash2,
  FiPlus,
  FiRefreshCw,
  FiMenu,
} from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";
import { restaurantAPI } from "../services/api";

interface Restaurant {
  _id: string;
  name: string;
  description: string;
  cuisine_type: string[];
  address: string;
  phone: string;
  email?: string;
  delivery_fee: number;
  min_order: number;
  delivery_time: number;
  is_active: boolean;
  is_verified: boolean;
  images: string[];
  menu: any[];
  rating: number;
  total_reviews: number;
  created_at: string;
  updated_at: string;
}

const Restaurants: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch restaurants from backend
  const fetchRestaurants = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await restaurantAPI.getAll({
        page: 1,
        limit: 50,
        calculate_distance: false,
      });

      console.log("Restaurants API Response:", response);
      console.log("Response data:", response.data);
      console.log("Response data.data:", response.data?.data);

      // Handle different response structures
      let restaurantsData: Restaurant[] = [];

      if (response.data?.data && Array.isArray(response.data.data)) {
        restaurantsData = response.data.data;
        console.log("Using response.data.data:", restaurantsData);
      } else if (Array.isArray(response.data)) {
        restaurantsData = response.data;
        console.log("Using response.data as array:", restaurantsData);
      } else if (response.data && typeof response.data === "object") {
        // If it's an object with a restaurants property
        if (Array.isArray(response.data.restaurants)) {
          restaurantsData = response.data.restaurants;
          console.log("Using response.data.restaurants:", restaurantsData);
        } else if (Array.isArray(response.data.items)) {
          restaurantsData = response.data.items;
          console.log("Using response.data.items:", restaurantsData);
        }
      }

      // Log each restaurant's ID
      restaurantsData.forEach((restaurant, index) => {
        console.log(`Restaurant ${index + 1}:`, {
          name: restaurant.name,
          _id: restaurant._id,
          id: (restaurant as any).id, // Check for id property too
          hasValidId: !!restaurant._id || !!(restaurant as any).id,
        });
      });

      // Normalize restaurant IDs - ensure _id is always set
      const normalizedRestaurants = restaurantsData.map((restaurant) => {
        const id = restaurant._id || (restaurant as any).id;
        return {
          ...restaurant,
          _id: id,
          id: id, // Also set id property for consistency
        };
      });

      setRestaurants(normalizedRestaurants);
    } catch (err: any) {
      console.error("Error fetching restaurants:", err);
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to load restaurants"
      );
      setRestaurants([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchRestaurants();
  }, []);

  // Handle refresh
  const handleRefresh = () => {
    setRefreshing(true);
    fetchRestaurants();
  };

  // Handle delete restaurant
  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this restaurant?")) {
      return;
    }

    try {
      await restaurantAPI.delete(id);
      // Remove from local state
      setRestaurants((prev) =>
        prev.filter((restaurant) => restaurant._id !== id)
      );
      alert("Restaurant deleted successfully");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to delete restaurant");
    }
  };

  // Handle toggle active status
  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const updatedRestaurant = { is_active: !currentStatus };
      await restaurantAPI.update(id, updatedRestaurant);

      // Update local state
      setRestaurants((prev) =>
        prev.map((restaurant) =>
          restaurant._id === id
            ? { ...restaurant, is_active: !currentStatus }
            : restaurant
        )
      );
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to update restaurant status");
    }
  };

  // Filter restaurants based on search term and status
  const filteredRestaurants = restaurants.filter((restaurant) => {
    const matchesSearch =
      restaurant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      restaurant.description
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      restaurant.cuisine_type?.some((c) =>
        c.toLowerCase().includes(searchTerm.toLowerCase())
      ) ||
      restaurant.address?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && restaurant.is_active) ||
      (statusFilter === "inactive" && !restaurant.is_active);

    return matchesSearch && matchesStatus;
  });

  // Format delivery time (minutes to readable string)
  const formatDeliveryTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // View restaurant menu
  const viewRestaurantMenu = (restaurantId: string) => {
    if (!restaurantId) {
      console.error("Cannot view menu: Restaurant ID is undefined");
      alert("Cannot view menu: Restaurant ID is missing");
      return;
    }
    console.log("Navigating to restaurant menu:", restaurantId);
    navigate(`/restaurants/${restaurantId}`);
  };

  // Get restaurant ID safely
  const getRestaurantId = (restaurant: Restaurant): string => {
    return restaurant._id || (restaurant as any).id || "";
  };

  if (loading && !refreshing) {
    return (
      <div className='flex justify-center items-center h-64'>
        <div className='text-lg'>Loading restaurants...</div>
      </div>
    );
  }

  return (
    <div>
      <div className='mb-6 flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-gray-800'>Restaurants</h1>
          <p className='text-gray-600'>
            Manage all restaurants and their menus
          </p>
          {restaurants.length > 0 && (
            <p className='text-sm text-gray-500 mt-1'>
              Showing {filteredRestaurants.length} of {restaurants.length}{" "}
              restaurants
            </p>
          )}
        </div>
        <div className='flex items-center space-x-3'>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className='flex items-center rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50 disabled:opacity-50'
          >
            <FiRefreshCw
              className={`mr-2 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          <Link
            to='/restaurants/add'
            className='flex items-center rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700'
          >
            <FiPlus className='mr-2' />
            Add Restaurant
          </Link>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className='mb-6 rounded-lg bg-red-50 p-4'>
          <div className='flex items-center'>
            <div className='flex-shrink-0'>
              <div className='h-5 w-5 text-red-400'>!</div>
            </div>
            <div className='ml-3'>
              <h3 className='text-sm font-medium text-red-800'>{error}</h3>
              <div className='mt-2 text-sm text-red-700'>
                <p>
                  Make sure your backend server is running at
                  http://localhost:8080
                </p>
                <button
                  onClick={fetchRestaurants}
                  className='mt-2 text-sm font-medium text-red-600 hover:text-red-500'
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className='mb-6 rounded-lg bg-white p-4 shadow'>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <div className='relative'>
            <FiSearch className='absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400' />
            <input
              type='text'
              placeholder='Search restaurants, cuisines, address...'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className='w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200'
            />
          </div>

          <div className='flex items-center space-x-4'>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className='rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200'
            >
              <option value='all'>All Status</option>
              <option value='active'>Active</option>
              <option value='inactive'>Inactive</option>
            </select>
            <button className='flex items-center rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50'>
              <FiFilter className='mr-2' />
              Filters
            </button>
          </div>
        </div>
      </div>

      {/* Restaurants Grid */}
      {filteredRestaurants.length === 0 ? (
        <div className='rounded-lg bg-white p-12 text-center shadow'>
          {restaurants.length === 0 ? (
            <>
              <div className='mx-auto h-12 w-12 text-gray-400'>🏪</div>
              <h3 className='mt-4 text-lg font-medium text-gray-900'>
                No restaurants found
              </h3>
              <p className='mt-2 text-gray-500'>
                {error
                  ? "Failed to load restaurants. Check your connection."
                  : "No restaurants have been added yet."}
              </p>
              <div className='mt-6'>
                <Link
                  to='/restaurants/add'
                  className='inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700'
                >
                  <FiPlus className='mr-2' />
                  Add Your First Restaurant
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className='mx-auto h-12 w-12 text-gray-400'>🔍</div>
              <h3 className='mt-4 text-lg font-medium text-gray-900'>
                No matching restaurants
              </h3>
              <p className='mt-2 text-gray-500'>
                No restaurants match your search criteria. Try a different
                search.
              </p>
              <button
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                }}
                className='mt-4 text-blue-600 hover:text-blue-500'
              >
                Clear all filters
              </button>
            </>
          )}
        </div>
      ) : (
        <div className='grid grid-cols-1 gap-6'>
          {filteredRestaurants.map((restaurant, index) => {
            const restaurantId = getRestaurantId(restaurant);

            if (!restaurantId) {
              console.warn(
                `Restaurant at index ${index} has no ID:`,
                restaurant
              );
            }

            return (
              <div
                key={restaurantId || `restaurant-${index}`}
                className='rounded-lg bg-white p-6 shadow hover:shadow-md transition-shadow'
              >
                <div className='flex flex-col md:flex-row md:items-start md:justify-between'>
                  <div className='md:flex-1'>
                    <div className='flex items-start justify-between'>
                      <div>
                        <div className='flex items-center space-x-2'>
                          {restaurantId ? (
                            <Link
                              to={`/restaurants/${restaurantId}`}
                              className='text-lg font-semibold text-gray-800 hover:text-blue-600 hover:underline'
                              onClick={() =>
                                console.log(
                                  "Navigating to restaurant ID:",
                                  restaurantId
                                )
                              }
                            >
                              {restaurant.name}
                            </Link>
                          ) : (
                            <span className='text-lg font-semibold text-gray-800'>
                              {restaurant.name}
                              <span className='ml-2 text-xs text-red-500'>
                                (ID missing)
                              </span>
                            </span>
                          )}
                          <button
                            onClick={() => viewRestaurantMenu(restaurantId)}
                            disabled={!restaurantId}
                            title='View Menu'
                            className={`p-1 rounded hover:bg-gray-100 ${
                              !restaurantId
                                ? "opacity-50 cursor-not-allowed"
                                : ""
                            }`}
                          >
                            <FiMenu className='h-4 w-4 text-gray-600' />
                          </button>
                        </div>
                        <div className='mt-1 flex flex-wrap items-center gap-2'>
                          {restaurant.cuisine_type?.map((cuisine) => (
                            <span
                              key={cuisine}
                              className='rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800'
                            >
                              {cuisine}
                            </span>
                          ))}
                          <span className='flex items-center text-sm text-gray-600'>
                            ⭐ {restaurant.rating?.toFixed(1) || "N/A"}
                            {restaurant.total_reviews > 0 && (
                              <span className='ml-1'>
                                ({restaurant.total_reviews} reviews)
                              </span>
                            )}
                          </span>
                          {restaurant.is_verified && (
                            <span className='rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800'>
                              ✓ Verified
                            </span>
                          )}
                        </div>
                      </div>
                      <div className='flex items-center space-x-2'>
                        {restaurantId && (
                          <>
                            <Link
                              to={`/restaurants/${restaurantId}/edit`}
                              className='rounded-lg p-2 hover:bg-gray-100'
                              title='Edit Restaurant'
                            >
                              <FiEdit2 className='h-4 w-4 text-gray-600' />
                            </Link>
                            <button
                              onClick={() => handleDelete(restaurantId)}
                              className='rounded-lg p-2 hover:bg-gray-100'
                              title='Delete Restaurant'
                            >
                              <FiTrash2 className='h-4 w-4 text-red-600' />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {restaurant.description && (
                      <p className='mt-3 text-gray-600 line-clamp-2'>
                        {restaurant.description}
                      </p>
                    )}

                    <div className='mt-4 grid grid-cols-1 gap-4 md:grid-cols-2'>
                      <div>
                        <p className='text-sm text-gray-500'>Address</p>
                        <p className='font-medium'>
                          {restaurant.address || "N/A"}
                        </p>
                        <p className='text-sm text-gray-600'>
                          {restaurant.phone || "No phone"}
                          {restaurant.email && (
                            <span className='block'>{restaurant.email}</span>
                          )}
                        </p>
                      </div>
                      <div className='grid grid-cols-3 gap-4'>
                        <div>
                          <p className='text-sm text-gray-500'>Delivery Fee</p>
                          <p className='font-medium'>
                            ETB {restaurant.delivery_fee?.toFixed(2) || "0.00"}
                          </p>
                        </div>
                        <div>
                          <p className='text-sm text-gray-500'>Min Order</p>
                          <p className='font-medium'>
                            ETB {restaurant.min_order?.toFixed(2) || "0.00"}
                          </p>
                        </div>
                        <div>
                          <p className='text-sm text-gray-500'>Time</p>
                          <p className='font-medium'>
                            {formatDeliveryTime(restaurant.delivery_time)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Additional info */}
                    <div className='mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-500'>
                      <div>
                        <span className='font-medium'>Menu items:</span>{" "}
                        {restaurant.menu?.length || 0}
                      </div>
                      <div>
                        <span className='font-medium'>Added:</span>{" "}
                        {formatDate(restaurant.created_at)}
                      </div>
                      {restaurant.images && restaurant.images.length > 0 && (
                        <div>
                          <span className='font-medium'>Images:</span>{" "}
                          {restaurant.images.length}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className='mt-4 md:mt-0 md:ml-6 flex flex-col items-end space-y-3'>
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                        restaurant.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {restaurant.is_active ? "Active" : "Inactive"}
                    </span>

                    {restaurantId && (
                      <button
                        onClick={() =>
                          handleToggleStatus(restaurantId, restaurant.is_active)
                        }
                        className={`text-sm px-3 py-1 rounded ${
                          restaurant.is_active
                            ? "text-red-600 hover:text-red-800 hover:bg-red-50"
                            : "text-green-600 hover:text-green-800 hover:bg-green-50"
                        }`}
                      >
                        {restaurant.is_active ? "Deactivate" : "Activate"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Loading overlay for refresh */}
      {refreshing && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-lg p-6 flex items-center space-x-3'>
            <FiRefreshCw className='animate-spin h-5 w-5 text-blue-600' />
            <span>Refreshing restaurants...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Restaurants;
