import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiEdit2, FiEye, FiEyeOff } from "react-icons/fi";
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
      // Update locally (you might want to call an API here)
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
      <div className='rounded-lg bg-red-50 p-6'>
        <h3 className='text-lg font-medium text-red-800'>Error</h3>
        <p className='mt-2 text-red-700'>{error}</p>
        <button
          onClick={() => navigate("/restaurants")}
          className='mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700'
        >
          Back to Restaurants
        </button>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className='text-center py-12'>
        <h3 className='text-lg font-medium text-gray-900'>
          Restaurant not found
        </h3>
        <button
          onClick={() => navigate("/restaurants")}
          className='mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700'
        >
          Back to Restaurants
        </button>
      </div>
    );
  }

  const categories = getCategories();
  const filteredMenu = getFilteredMenu();

  return (
    <div>
      {/* Header */}
      <div className='mb-6 flex items-center'>
        <button
          onClick={() => navigate("/restaurants")}
          className='mr-4 rounded-lg p-2 hover:bg-gray-100'
        >
          <FiArrowLeft className='h-5 w-5' />
        </button>
        <div className='flex-1'>
          <h1 className='text-2xl font-bold text-gray-800'>
            {restaurant.name}
          </h1>
          <div className='mt-1 flex items-center space-x-2'>
            {restaurant.cuisine_type?.map((cuisine) => (
              <span
                key={cuisine}
                className='rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800'
              >
                {cuisine}
              </span>
            ))}
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                restaurant.is_active
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {restaurant.is_active ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
        <div className='flex space-x-2'>
          <button
            onClick={() => navigate(`/restaurants/${restaurant._id}/edit`)}
            className='flex items-center rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-50'
          >
            <FiEdit2 className='mr-2' />
            Edit
          </button>
        </div>
      </div>

      {/* Restaurant Info */}
      <div className='mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3'>
        <div className='rounded-lg bg-white p-6 shadow lg:col-span-2'>
          <h2 className='mb-4 text-lg font-semibold text-gray-800'>
            Restaurant Information
          </h2>
          <div className='space-y-4'>
            <div>
              <h3 className='text-sm font-medium text-gray-500'>Description</h3>
              <p className='mt-1 text-gray-900'>
                {restaurant.description || "No description provided"}
              </p>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div>
                <h3 className='text-sm font-medium text-gray-500'>Address</h3>
                <p className='mt-1 text-gray-900'>{restaurant.address}</p>
              </div>
              <div>
                <h3 className='text-sm font-medium text-gray-500'>Contact</h3>
                <p className='mt-1 text-gray-900'>{restaurant.phone}</p>
                {restaurant.email && (
                  <p className='mt-1 text-gray-900'>{restaurant.email}</p>
                )}
              </div>
            </div>

            <div className='grid grid-cols-3 gap-4'>
              <div>
                <h3 className='text-sm font-medium text-gray-500'>
                  Delivery Fee
                </h3>
                <p className='mt-1 text-lg font-semibold text-gray-900'>
                  ETB {restaurant.delivery_fee?.toFixed(2) || "0.00"}
                </p>
              </div>
              <div>
                <h3 className='text-sm font-medium text-gray-500'>Min Order</h3>
                <p className='mt-1 text-lg font-semibold text-gray-900'>
                  ETB {restaurant.min_order?.toFixed(2) || "0.00"}
                </p>
              </div>
              <div>
                <h3 className='text-sm font-medium text-gray-500'>
                  Delivery Time
                </h3>
                <p className='mt-1 text-lg font-semibold text-gray-900'>
                  {restaurant.delivery_time} min
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Restaurant Images */}
        <div className='rounded-lg bg-white p-6 shadow'>
          <h2 className='mb-4 text-lg font-semibold text-gray-800'>Images</h2>
          {restaurant.images && restaurant.images.length > 0 ? (
            <div className='grid grid-cols-2 gap-3'>
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
            <p className='text-gray-500'>No images uploaded</p>
          )}
        </div>
      </div>

      {/* Menu Section */}
      <div className='rounded-lg bg-white p-6 shadow'>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <h2 className='text-lg font-semibold text-gray-800'>Menu</h2>
            <p className='text-sm text-gray-600'>
              {restaurant.menu?.length || 0} items total
            </p>
          </div>

          <div className='flex space-x-4'>
            {categories.length > 0 && (
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className='rounded-lg border border-gray-300 px-4 py-2'
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
              className='rounded-lg border border-gray-300 px-4 py-2'
            >
              <option value='all'>All Items</option>
              <option value='available'>Available Only</option>
              <option value='unavailable'>Unavailable Only</option>
            </select>

            <button
              onClick={() =>
                navigate(`/restaurants/${restaurant._id}/menu/add`)
              }
              className='rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700'
            >
              Add Menu Item
            </button>
          </div>
        </div>

        {filteredMenu.length === 0 ? (
          <div className='rounded-lg border-2 border-dashed border-gray-300 p-8 text-center'>
            <p className='text-gray-600'>No menu items found</p>
            <p className='mt-1 text-sm text-gray-500'>
              Add menu items to start serving customers
            </p>
            <button
              onClick={() =>
                navigate(`/restaurants/${restaurant._id}/menu/add`)
              }
              className='mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700'
            >
              Add First Item
            </button>
          </div>
        ) : (
          <div className='overflow-hidden border border-gray-200 sm:rounded-lg'>
            <table className='min-w-full divide-y divide-gray-200'>
              <thead className='bg-gray-50'>
                <tr>
                  <th className='px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500'>
                    Item
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500'>
                    Category
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500'>
                    Price
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500'>
                    Preparation Time
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500'>
                    Status
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500'>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-200 bg-white'>
                {filteredMenu.map((item) => (
                  <tr key={item._id} className='hover:bg-gray-50'>
                    <td className='px-6 py-4'>
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
                        <div className='ml-4'>
                          <div className='text-sm font-medium text-gray-900'>
                            {item.name}
                          </div>
                          <div className='text-sm text-gray-500'>
                            {item.description && item.description.length > 50
                              ? `${item.description.substring(0, 50)}...`
                              : item.description}
                          </div>
                          {item.ingredients && item.ingredients.length > 0 && (
                            <div className='mt-1'>
                              <span className='text-xs text-gray-500'>
                                Ingredients:{" "}
                                {item.ingredients.slice(0, 2).join(", ")}
                                {item.ingredients.length > 2 && "..."}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className='px-6 py-4'>
                      <span className='inline-flex rounded-full bg-green-100 px-2 py-1 text-xs font-semibold leading-5 text-green-800'>
                        {item.category}
                      </span>
                    </td>
                    <td className='px-6 py-4 text-sm font-semibold text-gray-900'>
                      ETB {item.price?.toFixed(2)}
                    </td>
                    <td className='px-6 py-4 text-sm text-gray-500'>
                      {item.preparation_time} min
                    </td>
                    <td className='px-6 py-4'>
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold leading-5 ${
                          item.is_available
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {item.is_available ? "Available" : "Unavailable"}
                      </span>
                    </td>
                    <td className='px-6 py-4 text-sm font-medium'>
                      <div className='flex space-x-2'>
                        <button
                          onClick={() =>
                            toggleMenuItemAvailability(
                              item._id,
                              item.is_available,
                            )
                          }
                          className={`${
                            item.is_available
                              ? "text-yellow-600 hover:text-yellow-900"
                              : "text-green-600 hover:text-green-900"
                          }`}
                        >
                          {item.is_available ? (
                            <>
                              <FiEyeOff className='inline h-4 w-4' />
                              <span className='ml-1'>Make Unavailable</span>
                            </>
                          ) : (
                            <>
                              <FiEye className='inline h-4 w-4' />
                              <span className='ml-1'>Make Available</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() =>
                            navigate(
                              `/restaurants/${restaurant._id}/menu/${item._id}/edit`,
                            )
                          }
                          className='text-blue-600 hover:text-blue-900'
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
        )}
      </div>

      {/* Menu Items Grid View (Alternative) */}
      <div className='mt-6'>
        <h3 className='mb-4 text-lg font-semibold text-gray-800'>
          Menu Items Grid View
        </h3>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
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
                    className='h-48 w-full object-cover'
                  />
                </div>
              )}
              <div className='p-4'>
                <div className='flex items-start justify-between'>
                  <div>
                    <h4 className='font-semibold text-gray-900'>{item.name}</h4>
                    <p className='mt-1 text-sm text-gray-600'>
                      {item.category}
                    </p>
                  </div>
                  <span className='rounded-lg bg-blue-100 px-2 py-1 text-sm font-semibold text-blue-800'>
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
                      {item.ingredients.slice(0, 3).map((ingredient, idx) => (
                        <span
                          key={idx}
                          className='rounded-full bg-gray-100 px-2 py-1 text-xs'
                        >
                          {ingredient}
                        </span>
                      ))}
                      {item.ingredients.length > 3 && (
                        <span className='rounded-full bg-gray-100 px-2 py-1 text-xs'>
                          +{item.ingredients.length - 3} more
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
                  <span className='text-sm text-gray-500'>
                    {item.preparation_time} min
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RestaurantDetail;
