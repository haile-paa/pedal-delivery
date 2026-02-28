import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiEdit2,
  FiEye,
  FiEyeOff,
  FiFilter,
} from "react-icons/fi";
import { restaurantAPI } from "../../services/api";

interface MenuItem {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  ingredients: string[];
  addons: any[];
  preparation_time: number;
  is_available: boolean;
  image: string;
  created_at: string;
  updated_at: string;
}

interface RestaurantDetail {
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
  menu: MenuItem[];
  rating: number;
  total_reviews: number;
  created_at: string;
  updated_at: string;
}

const RestaurantDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<RestaurantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuFilter, setMenuFilter] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false); // for mobile filter toggle

  useEffect(() => {
    fetchRestaurantDetails();
  }, [id]);

  const fetchRestaurantDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await restaurantAPI.getById(id!);
      const data = response.data;

      // Normalize restaurant ID: ensure _id exists (fallback to id)
      data._id = data._id || data.id;

      // Normalize menu items: ensure each has _id (fallback to id)
      if (data.menu && Array.isArray(data.menu)) {
        data.menu = data.menu.map((item: any) => ({
          ...item,
          _id: item._id || item.id,
        }));
      }

      setRestaurant(data);
    } catch (err: any) {
      console.error("Error fetching restaurant details:", err);
      setError(
        err.response?.data?.error || "Failed to load restaurant details",
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleMenuItemAvailability = async (
    itemId: string,
    currentStatus: boolean,
  ) => {
    try {
      if (restaurant) {
        const updatedMenu = restaurant.menu.map((item) =>
          item._id === itemId
            ? { ...item, is_available: !currentStatus }
            : item,
        );
        setRestaurant({ ...restaurant, menu: updatedMenu });
      }
    } catch (err) {
      console.error("Error toggling menu item availability:", err);
    }
  };

  const getCategories = () => {
    if (!restaurant?.menu) return [];
    const categories = restaurant.menu.map((item) => item.category);
    return Array.from(new Set(categories));
  };

  const getFilteredMenu = () => {
    if (!restaurant?.menu) return [];

    let filtered = restaurant.menu;

    if (menuFilter === "available") {
      filtered = filtered.filter((item) => item.is_available);
    } else if (menuFilter === "unavailable") {
      filtered = filtered.filter((item) => !item.is_available);
    }

    if (selectedCategory) {
      filtered = filtered.filter((item) => item.category === selectedCategory);
    }

    return filtered;
  };

  if (loading) {
    return (
      <div className='flex justify-center items-center h-64'>
        <div className='text-lg'>Loading restaurant details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='rounded-lg bg-red-50 p-4 sm:p-6'>
        <h3 className='text-base sm:text-lg font-medium text-red-800'>Error</h3>
        <p className='mt-2 text-sm sm:text-base text-red-700'>{error}</p>
        <button
          onClick={() => navigate("/restaurants")}
          className='mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm sm:text-base text-white hover:bg-blue-700'
        >
          Back to Restaurants
        </button>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className='text-center py-12 px-4'>
        <h3 className='text-lg font-medium text-gray-900'>
          Restaurant not found
        </h3>
        <button
          onClick={() => navigate("/restaurants")}
          className='mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm sm:text-base text-white hover:bg-blue-700'
        >
          Back to Restaurants
        </button>
      </div>
    );
  }

  const categories = getCategories();
  const filteredMenu = getFilteredMenu();

  return (
    <div className='px-4 sm:px-6 lg:px-8 py-4 sm:py-6'>
      {/* Header */}
      <div className='mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center gap-4'>
        <button
          onClick={() => navigate("/restaurants")}
          className='self-start rounded-lg p-2 hover:bg-gray-100'
        >
          <FiArrowLeft className='h-5 w-5' />
        </button>
        <div className='flex-1'>
          <h1 className='text-xl sm:text-2xl font-bold text-gray-800 break-words'>
            {restaurant.name}
          </h1>
          <div className='mt-1 flex flex-wrap items-center gap-2'>
            {restaurant.cuisine_type?.map((cuisine) => (
              <span
                key={cuisine}
                className='rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800'
              >
                {cuisine}
              </span>
            ))}
            <span
              className={`rounded-full px-2 py-1 text-xs font-medium ${
                restaurant.is_active
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {restaurant.is_active ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
        <div className='flex justify-end'>
          <button
            onClick={() => navigate(`/restaurants/${restaurant._id}/edit`)}
            className='flex items-center rounded-lg border border-gray-300 px-3 py-2 sm:px-4 sm:py-2 text-sm sm:text-base hover:bg-gray-50'
          >
            <FiEdit2 className='mr-2 h-4 w-4' />
            Edit
          </button>
        </div>
      </div>

      {/* Restaurant Info */}
      <div className='mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3'>
        <div className='rounded-lg bg-white p-4 sm:p-6 shadow lg:col-span-2'>
          <h2 className='mb-3 sm:mb-4 text-base sm:text-lg font-semibold text-gray-800'>
            Restaurant Information
          </h2>
          <div className='space-y-3 sm:space-y-4'>
            <div>
              <h3 className='text-xs sm:text-sm font-medium text-gray-500'>
                Description
              </h3>
              <p className='mt-1 text-sm sm:text-base text-gray-900'>
                {restaurant.description || "No description provided"}
              </p>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div>
                <h3 className='text-xs sm:text-sm font-medium text-gray-500'>
                  Address
                </h3>
                <p className='mt-1 text-sm sm:text-base text-gray-900 break-words'>
                  {restaurant.address}
                </p>
              </div>
              <div>
                <h3 className='text-xs sm:text-sm font-medium text-gray-500'>
                  Contact
                </h3>
                <p className='mt-1 text-sm sm:text-base text-gray-900'>
                  {restaurant.phone}
                </p>
                {restaurant.email && (
                  <p className='mt-1 text-sm sm:text-base text-gray-900 break-words'>
                    {restaurant.email}
                  </p>
                )}
              </div>
            </div>

            <div className='grid grid-cols-3 gap-2 sm:gap-4'>
              <div>
                <h3 className='text-xs sm:text-sm font-medium text-gray-500'>
                  Delivery Fee
                </h3>
                <p className='mt-1 text-sm sm:text-base font-semibold text-gray-900'>
                  ETB {restaurant.delivery_fee?.toFixed(2) || "0.00"}
                </p>
              </div>
              <div>
                <h3 className='text-xs sm:text-sm font-medium text-gray-500'>
                  Min Order
                </h3>
                <p className='mt-1 text-sm sm:text-base font-semibold text-gray-900'>
                  ETB {restaurant.min_order?.toFixed(2) || "0.00"}
                </p>
              </div>
              <div>
                <h3 className='text-xs sm:text-sm font-medium text-gray-500'>
                  Delivery Time
                </h3>
                <p className='mt-1 text-sm sm:text-base font-semibold text-gray-900'>
                  {restaurant.delivery_time} min
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Restaurant Images */}
        <div className='rounded-lg bg-white p-4 sm:p-6 shadow'>
          <h2 className='mb-3 sm:mb-4 text-base sm:text-lg font-semibold text-gray-800'>
            Images
          </h2>
          {restaurant.images && restaurant.images.length > 0 ? (
            <div className='grid grid-cols-2 gap-2 sm:gap-3'>
              {restaurant.images.slice(0, 4).map((image, index) => (
                <div
                  key={index}
                  className='aspect-square overflow-hidden rounded-lg'
                >
                  <img
                    src={image}
                    alt={`Restaurant ${index + 1}`}
                    className='h-full w-full object-cover'
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className='text-sm text-gray-500'>No images uploaded</p>
          )}
        </div>
      </div>

      {/* Menu Section */}
      <div className='rounded-lg bg-white p-4 sm:p-6 shadow'>
        {/* Header with title and add button */}
        <div className='mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
          <div>
            <h2 className='text-base sm:text-lg font-semibold text-gray-800'>
              Menu
            </h2>
            <p className='text-xs sm:text-sm text-gray-600'>
              {restaurant.menu?.length || 0} items total
            </p>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            {/* Filter toggle for mobile */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className='sm:hidden flex items-center rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50'
            >
              <FiFilter className='mr-2' />
              Filters
            </button>
            <button
              onClick={() =>
                navigate(`/restaurants/${restaurant._id}/menu/add`)
              }
              className='rounded-lg bg-blue-600 px-3 py-2 sm:px-4 sm:py-2 text-sm text-white hover:bg-blue-700 whitespace-nowrap'
            >
              Add Item
            </button>
          </div>
        </div>

        {/* Filters - visible on mobile when toggled, always visible on sm+ */}
        <div className={`${showFilters ? "block" : "hidden"} sm:block mb-4`}>
          <div className='flex flex-col sm:flex-row sm:items-center gap-3'>
            {categories.length > 0 && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className='w-full sm:w-auto rounded-lg border border-gray-300 px-3 py-2 text-sm'
              >
                <option value=''>All Categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            )}

            <select
              value={menuFilter}
              onChange={(e) => setMenuFilter(e.target.value)}
              className='w-full sm:w-auto rounded-lg border border-gray-300 px-3 py-2 text-sm'
            >
              <option value='all'>All Items</option>
              <option value='available'>Available Only</option>
              <option value='unavailable'>Unavailable Only</option>
            </select>
          </div>
        </div>

        {filteredMenu.length === 0 ? (
          <div className='rounded-lg border-2 border-dashed border-gray-300 p-6 sm:p-8 text-center'>
            <p className='text-sm sm:text-base text-gray-600'>
              No menu items found
            </p>
            <p className='mt-1 text-xs sm:text-sm text-gray-500'>
              Add menu items to start serving customers
            </p>
            <button
              onClick={() =>
                navigate(`/restaurants/${restaurant._id}/menu/add`)
              }
              className='mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700'
            >
              Add First Item
            </button>
          </div>
        ) : (
          <>
            {/* Table view - hidden on small screens, visible on md+ */}
            <div className='hidden md:block overflow-x-auto border border-gray-200 rounded-lg'>
              <table className='min-w-full divide-y divide-gray-200'>
                <thead className='bg-gray-50'>
                  <tr>
                    <th className='px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500'>
                      Item
                    </th>
                    <th className='px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500'>
                      Category
                    </th>
                    <th className='px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500'>
                      Price
                    </th>
                    <th className='px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500'>
                      Prep Time
                    </th>
                    <th className='px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500'>
                      Status
                    </th>
                    <th className='px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500'>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-gray-200 bg-white'>
                  {filteredMenu.map((item) => (
                    <tr key={item._id} className='hover:bg-gray-50'>
                      <td className='px-4 py-4'>
                        <div className='flex items-center'>
                          {item.image && (
                            <div className='h-10 w-10 shrink-0'>
                              <img
                                className='h-10 w-10 rounded-full object-cover'
                                src={item.image}
                                alt={item.name}
                              />
                            </div>
                          )}
                          <div className='ml-3'>
                            <div className='text-sm font-medium text-gray-900'>
                              {item.name}
                            </div>
                            <div className='text-xs text-gray-500'>
                              {item.description && item.description.length > 40
                                ? `${item.description.substring(0, 40)}...`
                                : item.description}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className='px-4 py-4'>
                        <span className='inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800'>
                          {item.category}
                        </span>
                      </td>
                      <td className='px-4 py-4 text-sm font-semibold text-gray-900'>
                        ETB {item.price?.toFixed(2)}
                      </td>
                      <td className='px-4 py-4 text-sm text-gray-500'>
                        {item.preparation_time} min
                      </td>
                      <td className='px-4 py-4'>
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                            item.is_available
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {item.is_available ? "Available" : "Unavailable"}
                        </span>
                      </td>
                      <td className='px-4 py-4 text-sm font-medium'>
                        <div className='flex flex-col items-start gap-2'>
                          <button
                            onClick={() =>
                              toggleMenuItemAvailability(
                                item._id,
                                item.is_available,
                              )
                            }
                            className={`flex items-center text-xs ${
                              item.is_available
                                ? "text-yellow-600 hover:text-yellow-900"
                                : "text-green-600 hover:text-green-900"
                            }`}
                          >
                            {item.is_available ? (
                              <>
                                <FiEyeOff className='mr-1 h-3 w-3' />
                                Unavailable
                              </>
                            ) : (
                              <>
                                <FiEye className='mr-1 h-3 w-3' />
                                Available
                              </>
                            )}
                          </button>
                          <button
                            onClick={() =>
                              navigate(
                                `/restaurants/${restaurant._id}/menu/${item._id}/edit`,
                              )
                            }
                            className='text-blue-600 hover:text-blue-900 text-xs'
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Grid view - visible on small screens, hidden on md+ */}
            <div className='grid grid-cols-1 gap-4 md:hidden'>
              {filteredMenu.map((item) => (
                <div
                  key={item._id}
                  className='overflow-hidden rounded-lg border border-gray-200'
                >
                  {item.image && (
                    <div className='aspect-w-16 aspect-h-9'>
                      <img
                        src={item.image}
                        alt={item.name}
                        className='h-40 w-full object-cover'
                      />
                    </div>
                  )}
                  <div className='p-4'>
                    <div className='flex items-start justify-between'>
                      <div className='flex-1'>
                        <h4 className='font-semibold text-gray-900'>
                          {item.name}
                        </h4>
                        <p className='mt-1 text-sm text-gray-600'>
                          {item.category}
                        </p>
                      </div>
                      <span className='rounded-lg bg-blue-100 px-2 py-1 text-sm font-semibold text-blue-800 whitespace-nowrap ml-2'>
                        ETB {item.price?.toFixed(2)}
                      </span>
                    </div>
                    <p className='mt-2 text-sm text-gray-600 line-clamp-2'>
                      {item.description}
                    </p>
                    {item.ingredients && item.ingredients.length > 0 && (
                      <div className='mt-3'>
                        <p className='text-xs font-medium text-gray-500'>
                          Ingredients:
                        </p>
                        <div className='mt-1 flex flex-wrap gap-1'>
                          {item.ingredients
                            .slice(0, 3)
                            .map((ingredient, idx) => (
                              <span
                                key={idx}
                                className='rounded-full bg-gray-100 px-2 py-1 text-xs'
                              >
                                {ingredient}
                              </span>
                            ))}
                          {item.ingredients.length > 3 && (
                            <span className='rounded-full bg-gray-100 px-2 py-1 text-xs'>
                              +{item.ingredients.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    <div className='mt-4 flex items-center justify-between'>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          item.is_available
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {item.is_available ? "Available" : "Unavailable"}
                      </span>
                      <span className='text-xs text-gray-500'>
                        {item.preparation_time} min
                      </span>
                    </div>
                    <div className='mt-4 flex justify-end space-x-3'>
                      <button
                        onClick={() =>
                          toggleMenuItemAvailability(
                            item._id,
                            item.is_available,
                          )
                        }
                        className={`text-sm ${
                          item.is_available
                            ? "text-yellow-600 hover:text-yellow-900"
                            : "text-green-600 hover:text-green-900"
                        }`}
                      >
                        {item.is_available
                          ? "Make Unavailable"
                          : "Make Available"}
                      </button>
                      <button
                        onClick={() =>
                          navigate(
                            `/restaurants/${restaurant._id}/menu/${item._id}/edit`,
                          )
                        }
                        className='text-sm text-blue-600 hover:text-blue-900'
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* The duplicate grid view at bottom is removed - we already have responsive handling above */}
    </div>
  );
};

export default RestaurantDetail;
