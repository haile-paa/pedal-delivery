import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { FiArrowLeft, FiSave } from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { restaurantAPI } from "../services/api";

interface RestaurantFormData {
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
  images: string[];
}

const EditRestaurant: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [menuItems, setMenuItems] = useState<any[]>([]);

  // Only include what you're actually using
  const { handleSubmit, reset } = useForm<RestaurantFormData>();

  // Fetch restaurant data
  useEffect(() => {
    const fetchRestaurant = async () => {
      try {
        setFetching(true);
        const response = await restaurantAPI.getById(id!);
        const data = response.data;

        setSelectedCuisines(data.cuisine_type || []);
        setIsActive(data.is_active);
        setMenuItems(data.menu || []);

        // Reset form with restaurant data
        reset({
          name: data.name,
          description: data.description || "",
          cuisine_type: data.cuisine_type || [],
          address: data.address,
          phone: data.phone,
          email: data.email || "",
          latitude: data.location?.coordinates?.[1] || 0,
          longitude: data.location?.coordinates?.[0] || 0,
          delivery_fee: data.delivery_fee || 0,
          min_order: data.min_order || 0,
          delivery_time: data.delivery_time || 0,
          images: data.images || [],
        });
      } catch (err: any) {
        setError("Failed to load restaurant data");
        console.error("Error fetching restaurant:", err);
      } finally {
        setFetching(false);
      }
    };

    if (id) {
      fetchRestaurant();
    }
  }, [id, reset]);

  const onSubmit = async (data: RestaurantFormData) => {
    try {
      setLoading(true);
      setError("");

      const formData = {
        ...data,
        cuisine_type: selectedCuisines,
        is_active: isActive,
        menu: menuItems,
      };

      await restaurantAPI.update(id!, formData);

      alert("Restaurant updated successfully");
      navigate("/restaurants");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update restaurant");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className='flex justify-center items-center h-64'>
        <div className='text-lg'>Loading restaurant data...</div>
      </div>
    );
  }

  return (
    <div>
      <div className='mb-6 flex items-center'>
        <button
          onClick={() => navigate("/restaurants")}
          className='mr-4 rounded-lg p-2 hover:bg-gray-100'
        >
          <FiArrowLeft className='h-5 w-5' />
        </button>
        <div>
          <h1 className='text-2xl font-bold text-gray-800'>Edit Restaurant</h1>
          <p className='text-gray-600'>Update restaurant details</p>
        </div>
      </div>

      {error && (
        <div className='mb-6 rounded-lg bg-red-50 p-4'>
          <p className='text-red-700'>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className='space-y-8'>
        {/* Form fields would go here */}

        <div className='flex justify-end space-x-4 border-t pt-6'>
          <button
            type='button'
            onClick={() => navigate("/restaurants")}
            className='rounded-lg border border-gray-300 px-6 py-2 font-medium text-gray-700 hover:bg-gray-50'
          >
            Cancel
          </button>
          <button
            type='submit'
            disabled={loading}
            className='flex items-center rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50'
          >
            <FiSave className='mr-2' />
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditRestaurant;
