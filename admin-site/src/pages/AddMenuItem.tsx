import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiUpload, FiX } from "react-icons/fi";
import { restaurantAPI, menuAPI, uploadAPI } from "../services/api";

const AddMenuItem: React.FC = () => {
  const { id: restaurantId, itemId } = useParams<{
    id: string;
    itemId: string;
  }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [fetching, setFetching] = useState(!!itemId);
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (restaurantId) {
      fetchRestaurantDetails();
    }
    if (itemId) {
      fetchMenuItem();
    }
  }, [restaurantId, itemId]);

  const fetchRestaurantDetails = async () => {
    try {
      const response = await restaurantAPI.getById(restaurantId!);
      setRestaurant(response.data);
    } catch (err) {
      console.error("Error fetching restaurant:", err);
    }
  };

  const fetchMenuItem = async () => {
    try {
      setFetching(true);
      const response = await restaurantAPI.getById(restaurantId!);
      const menuItem = response.data.menu.find(
        (item: any) => item._id === itemId,
      );
      if (menuItem) {
        setFormData({
          name: menuItem.name || "",
          description: menuItem.description || "",
          price: menuItem.price || 0,
          category: menuItem.category || "",
          ingredients: menuItem.ingredients?.length
            ? menuItem.ingredients
            : [""],
          preparation_time: menuItem.preparation_time || 15,
          is_available: menuItem.is_available ?? true,
          image: menuItem.image || "",
        });
      }
    } catch (err) {
      console.error("Error fetching menu item:", err);
    } finally {
      setFetching(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append("image", file);
      formData.append("type", "menu");
      const response = await uploadAPI.uploadImage(formData);
      setFormData((prev) => ({ ...prev, image: response.data.url }));
    } catch (err) {
      console.error("Failed to upload image:", err);
      alert("Image upload failed. Please try again.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
    // Reset input to allow uploading same file again
    e.target.value = "";
  };

  const removeImage = () => {
    setFormData((prev) => ({ ...prev, image: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const ingredients = formData.ingredients.filter(
        (ing) => ing.trim() !== "",
      );

      const payload = {
        ...formData,
        ingredients,
      };

      if (itemId) {
        await menuAPI.update(restaurantId!, itemId, payload);
        alert("Menu item updated successfully!");
      } else {
        await menuAPI.create(restaurantId!, payload);
        alert("Menu item added successfully!");
      }

      navigate(`/restaurants/${restaurantId}`);
    } catch (err) {
      console.error("Error saving menu item:", err);
      alert("Failed to save menu item. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleIngredientChange = (index: number, value: string) => {
    const newIngredients = [...formData.ingredients];
    newIngredients[index] = value;
    setFormData({ ...formData, ingredients: newIngredients });
  };

  const addIngredientField = () => {
    setFormData({ ...formData, ingredients: [...formData.ingredients, ""] });
  };

  const removeIngredientField = (index: number) => {
    if (formData.ingredients.length > 1) {
      const newIngredients = formData.ingredients.filter((_, i) => i !== index);
      setFormData({ ...formData, ingredients: newIngredients });
    }
  };

  if (!restaurantId) {
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

  if (fetching) {
    return (
      <div className='flex justify-center items-center h-64'>
        <div className='text-lg'>Loading menu item...</div>
      </div>
    );
  }

  return (
    <div className='p-6'>
      <div className='mb-6 flex items-center'>
        <button
          onClick={() => navigate(`/restaurants/${restaurantId}`)}
          className='mr-4 rounded-lg p-2 hover:bg-gray-100'
        >
          <FiArrowLeft className='h-5 w-5' />
        </button>
        <div className='flex-1'>
          <h1 className='text-2xl font-bold text-gray-800'>
            {itemId ? "Edit Menu Item" : "Add Menu Item"}
          </h1>
          <p className='text-gray-600'>
            {restaurant ? `For ${restaurant.name}` : "Loading restaurant..."}
          </p>
        </div>
      </div>

      <div className='rounded-lg bg-white p-6 shadow'>
        <form onSubmit={handleSubmit} className='space-y-6'>
          <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
            <div>
              <label className='block text-sm font-medium text-gray-700'>
                Item Name *
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
                Category *
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
                Ingredients
              </label>
              {formData.ingredients.map((ing, index) => (
                <div key={index} className='flex items-center mt-2'>
                  <input
                    type='text'
                    value={ing}
                    onChange={(e) =>
                      handleIngredientChange(index, e.target.value)
                    }
                    className='flex-1 rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                    placeholder={`Ingredient ${index + 1}`}
                  />
                  {formData.ingredients.length > 1 && (
                    <button
                      type='button'
                      onClick={() => removeIngredientField(index)}
                      className='ml-2 text-red-600 hover:text-red-800'
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type='button'
                onClick={addIngredientField}
                className='mt-2 text-sm text-blue-600 hover:text-blue-800'
              >
                + Add another ingredient
              </button>
            </div>

            <div className='md:col-span-2'>
              <label className='block text-sm font-medium text-gray-700'>
                Image
              </label>
              <div className='mt-1 flex items-center space-x-4'>
                <input
                  type='file'
                  ref={fileInputRef}
                  accept='image/*'
                  onChange={handleFileChange}
                  className='hidden'
                />
                <button
                  type='button'
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className='flex items-center rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50'
                >
                  {uploadingImage ? (
                    <>
                      <div className='mr-2 h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent'></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <FiUpload className='mr-2' />
                      Choose from gallery
                    </>
                  )}
                </button>
                {formData.image && (
                  <button
                    type='button'
                    onClick={removeImage}
                    className='text-red-600 hover:text-red-800'
                  >
                    <FiX className='h-5 w-5' />
                  </button>
                )}
              </div>
              {formData.image && (
                <div className='mt-2'>
                  <img
                    src={formData.image}
                    alt='Preview'
                    className='h-32 w-32 rounded-lg object-cover'
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
                    setFormData({ ...formData, is_available: e.target.checked })
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
              onClick={() => navigate(`/restaurants/${restaurantId}`)}
              className='rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50'
            >
              Cancel
            </button>
            <button
              type='submit'
              disabled={loading || uploadingImage}
              className='rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50'
            >
              {loading
                ? itemId
                  ? "Updating..."
                  : "Adding..."
                : itemId
                  ? "Update Menu Item"
                  : "Add Menu Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddMenuItem;
