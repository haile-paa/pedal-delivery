import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import { restaurantAPI } from "../services/api";

const AddMenuItem: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    category: "",
    ingredients: [""],
    preparation_time: 15,
    is_available: true,
    image: "",
  });

  useEffect(() => {
    if (id) {
      fetchRestaurantDetails();
    }
  }, [id]);

  const fetchRestaurantDetails = async () => {
    try {
      const response = await restaurantAPI.getById(id!);
      setRestaurant(response.data);
    } catch (err) {
      console.error("Error fetching restaurant:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Add your API call here to create menu item
      // await restaurantAPI.addMenuItem(id!, formData);
      console.log("Adding menu item:", formData);

      // Navigate back to restaurant details
      navigate(`/restaurants/${id}`);
    } catch (err) {
      console.error("Error adding menu item:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!id) {
    return (
      <div className='p-6'>
        <div className='rounded-lg bg-red-50 p-6'>
          <h3 className='text-lg font-medium text-red-800'>Error</h3>
          <p className='mt-2 text-red-700'>Restaurant ID is missing</p>
          <button
            onClick={() => navigate("/restaurants")}
            className='mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700'
          >
            Back to Restaurants
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='p-6'>
      {/* Header */}
      <div className='mb-6 flex items-center'>
        <button
          onClick={() => navigate(`/restaurants/${id}`)}
          className='mr-4 rounded-lg p-2 hover:bg-gray-100'
        >
          <FiArrowLeft className='h-5 w-5' />
        </button>
        <div className='flex-1'>
          <h1 className='text-2xl font-bold text-gray-800'>Add Menu Item</h1>
          <p className='text-gray-600'>
            {restaurant ? `For ${restaurant.name}` : "Loading restaurant..."}
          </p>
        </div>
      </div>

      {/* Form */}
      <div className='rounded-lg bg-white p-6 shadow'>
        <form onSubmit={handleSubmit} className='space-y-6'>
          <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
            <div>
              <label className='block text-sm font-medium text-gray-700'>
                Item Name
              </label>
              <input
                type='text'
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className='mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                placeholder='Enter item name'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700'>
                Category
              </label>
              <input
                type='text'
                required
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className='mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                placeholder='e.g., Appetizer, Main Course, Dessert'
              />
            </div>

            <div className='md:col-span-2'>
              <label className='block text-sm font-medium text-gray-700'>
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
                className='mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                placeholder='Describe the menu item'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700'>
                Price (ETB)
              </label>
              <input
                type='number'
                required
                min='0'
                step='0.01'
                value={formData.price}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    price: parseFloat(e.target.value),
                  })
                }
                className='mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700'>
                Preparation Time (minutes)
              </label>
              <input
                type='number'
                min='1'
                value={formData.preparation_time}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    preparation_time: parseInt(e.target.value),
                  })
                }
                className='mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
              />
            </div>

            <div className='md:col-span-2'>
              <label className='block text-sm font-medium text-gray-700'>
                Ingredients (comma separated)
              </label>
              <input
                type='text'
                value={formData.ingredients.join(", ")}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    ingredients: e.target.value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  })
                }
                className='mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                placeholder='e.g., Chicken, Rice, Spices, Vegetables'
              />
            </div>

            <div className='md:col-span-2'>
              <label className='block text-sm font-medium text-gray-700'>
                Image URL
              </label>
              <input
                type='text'
                value={formData.image}
                onChange={(e) =>
                  setFormData({ ...formData, image: e.target.value })
                }
                className='mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                placeholder='https://example.com/image.jpg'
              />
              {formData.image && (
                <div className='mt-2'>
                  <img
                    src={formData.image}
                    alt='Preview'
                    className='h-32 w-32 rounded-lg object-cover'
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>

            <div>
              <label className='flex items-center'>
                <input
                  type='checkbox'
                  checked={formData.is_available}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      is_available: e.target.checked,
                    })
                  }
                  className='h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                />
                <span className='ml-2 text-sm text-gray-700'>
                  Available for ordering
                </span>
              </label>
            </div>
          </div>

          <div className='flex justify-end space-x-3 pt-6'>
            <button
              type='button'
              onClick={() => navigate(`/restaurants/${id}`)}
              className='rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50'
            >
              Cancel
            </button>
            <button
              type='submit'
              disabled={loading}
              className='rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50'
            >
              {loading ? "Adding..." : "Add Menu Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddMenuItem;
