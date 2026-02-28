import React, { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { FiArrowLeft, FiUpload, FiSave, FiX } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { restaurantAPI, uploadAPI } from "../services/api";

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
}

interface MenuItemFormData {
  name: string;
  description: string;
  price: number;
  category: string;
  ingredients: string[];
  addons: any[];
  preparation_time: number;
  is_available: boolean;
  image: string;
}

// Types for uploaded images
interface UploadedImage {
  id: string;
  url: string;
  file: File;
  preview: string;
  uploading: boolean;
}

const AddRestaurant: React.FC = () => {
  const navigate = useNavigate();
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [menuItems, setMenuItems] = useState<MenuItemFormData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State for images
  const [restaurantImages, setRestaurantImages] = useState<UploadedImage[]>([]);
  const [uploadingRestaurantImages, setUploadingRestaurantImages] =
    useState(false);

  // Refs for file inputs
  const restaurantImageInputRef = useRef<HTMLInputElement>(null);
  const menuItemImageInputRefs = useRef<{
    [key: number]: HTMLInputElement | null;
  }>({});

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<RestaurantFormData>();

  const cuisines = [
    "Fast Food",
    "Italian",
    "Ethiopian",
    "American",
    "Asian",
    "Mexican",
    "Indian",
    "Chinese",
    "Pizza",
    "Burgers",
    "Seafood",
    "Vegetarian",
  ];

  // Image upload functions
  const handleRestaurantImageUpload = async (files: FileList) => {
    setUploadingRestaurantImages(true);
    const uploadedFiles = Array.from(files);

    for (const file of uploadedFiles) {
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      const tempId =
        Date.now().toString() + Math.random().toString(36).substr(2, 9);

      // Add to state with uploading status
      const newImage: UploadedImage = {
        id: tempId,
        url: "",
        file,
        preview: previewUrl,
        uploading: true,
      };

      setRestaurantImages((prev) => [...prev, newImage]);

      try {
        // Upload to backend
        const formData = new FormData();
        formData.append("image", file);
        formData.append("type", "restaurant");

        const response = await uploadAPI.uploadImage(formData);

        // Update image with URL from backend
        setRestaurantImages((prev) =>
          prev.map((img) =>
            img.id === tempId
              ? { ...img, url: response.data.url, uploading: false }
              : img,
          ),
        );
      } catch (err) {
        console.error("Failed to upload image:", err);
        setRestaurantImages((prev) =>
          prev.map((img) =>
            img.id === tempId ? { ...img, uploading: false } : img,
          ),
        );
      }
    }

    setUploadingRestaurantImages(false);
  };

  const handleMenuItemImageUpload = async (
    file: File,
    menuItemIndex: number,
  ) => {
    try {
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);

      // Update menu item with preview
      const updatedItems = [...menuItems];
      updatedItems[menuItemIndex] = {
        ...updatedItems[menuItemIndex],
        image: previewUrl, // Temporary preview
      };
      setMenuItems(updatedItems);

      // Upload to backend
      const formData = new FormData();
      formData.append("image", file);
      formData.append("type", "menu");

      const response = await uploadAPI.uploadImage(formData);

      // Update menu item with actual URL
      const finalUpdatedItems = [...menuItems];
      finalUpdatedItems[menuItemIndex] = {
        ...finalUpdatedItems[menuItemIndex],
        image: response.data.url,
      };
      setMenuItems(finalUpdatedItems);
    } catch (err) {
      console.error("Failed to upload menu item image:", err);
    }
  };

  const removeRestaurantImage = (id: string) => {
    setRestaurantImages((prev) => {
      const imageToRemove = prev.find((img) => img.id === id);
      if (imageToRemove?.preview) {
        URL.revokeObjectURL(imageToRemove.preview);
      }
      return prev.filter((img) => img.id !== id);
    });
  };

  const openImagePicker = (type: "restaurant" | "menu", index?: number) => {
    if (type === "restaurant" && restaurantImageInputRef.current) {
      restaurantImageInputRef.current.click();
    } else if (
      type === "menu" &&
      index !== undefined &&
      menuItemImageInputRefs.current[index]
    ) {
      menuItemImageInputRefs.current[index]?.click();
    }
  };

  // Update the existing functions
  const toggleCuisine = (cuisine: string) => {
    setSelectedCuisines((prev) =>
      prev.includes(cuisine)
        ? prev.filter((c) => c !== cuisine)
        : [...prev, cuisine],
    );
  };

  const addNewMenuItem = () => {
    setMenuItems([
      ...menuItems,
      {
        name: "",
        description: "",
        price: 0,
        category: "",
        ingredients: [],
        addons: [],
        preparation_time: 30,
        is_available: true,
        image: "",
      },
    ]);
  };

  const updateMenuItem = (
    index: number,
    field: keyof MenuItemFormData,
    value: any,
  ) => {
    const updatedItems = [...menuItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setMenuItems(updatedItems);
  };

  const removeMenuItem = (index: number) => {
    setMenuItems(menuItems.filter((_, i) => i !== index));
  };

  const addIngredientToMenuItem = (itemIndex: number) => {
    const ingredient = prompt("Enter ingredient:");
    if (ingredient && ingredient.trim()) {
      const updatedItems = [...menuItems];
      updatedItems[itemIndex].ingredients = [
        ...updatedItems[itemIndex].ingredients,
        ingredient.trim(),
      ];
      setMenuItems(updatedItems);
    }
  };

  const removeIngredient = (itemIndex: number, ingredientIndex: number) => {
    const updatedItems = [...menuItems];
    updatedItems[itemIndex].ingredients = updatedItems[
      itemIndex
    ].ingredients.filter((_, i) => i !== ingredientIndex);
    setMenuItems(updatedItems);
  };

  const onSubmit = async (data: RestaurantFormData) => {
    try {
      setLoading(true);
      setError(null);

      // Get uploaded image URLs
      const uploadedImageUrls = restaurantImages
        .filter((img) => img.url && !img.uploading)
        .map((img) => img.url);

      // Prepare the data for the backend
      const restaurantData = {
        name: data.name,
        description: data.description || "",
        cuisine_type: selectedCuisines,
        address: data.address,
        phone: data.phone,
        email: data.email || "",
        latitude: data.latitude || 9.032,
        longitude: data.longitude || 38.746,
        delivery_fee: data.delivery_fee || 0,
        min_order: data.min_order || 0,
        delivery_time: data.delivery_time || 45,
        images: uploadedImageUrls, // Use uploaded image URLs
        menu: menuItems.map((item) => ({
          name: item.name,
          description: item.description,
          price: item.price,
          category: item.category,
          ingredients: item.ingredients,
          addons: item.addons || [],
          preparation_time: item.preparation_time,
          is_available: item.is_available,
          image: item.image,
        })),
      };

      console.log("Submitting restaurant data:", restaurantData);

      // Call the backend API
      const response = await restaurantAPI.create(restaurantData);

      console.log("Restaurant created successfully:", response.data);

      // Show success message
      alert("Restaurant created successfully!");

      // Clean up preview URLs
      restaurantImages.forEach((img) => {
        if (img.preview) {
          URL.revokeObjectURL(img.preview);
        }
      });

      // Reset form and navigate back
      reset();
      setSelectedCuisines([]);
      setMenuItems([]);
      setRestaurantImages([]);
      navigate("/restaurants");
    } catch (err: any) {
      console.error("Error creating restaurant:", err);
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to create restaurant. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Hidden file inputs */}
      <input
        type='file'
        ref={restaurantImageInputRef}
        className='hidden'
        accept='image/*'
        multiple
        onChange={(e) => {
          if (e.target.files) {
            handleRestaurantImageUpload(e.target.files);
          }
          e.target.value = ""; // Reset input
        }}
      />

      <div className='mb-6 flex items-center'>
        <button
          onClick={() => navigate("/restaurants")}
          className='mr-4 rounded-lg p-2 hover:bg-gray-100'
        >
          <FiArrowLeft className='h-5 w-5' />
        </button>
        <div>
          <h1 className='text-2xl font-bold text-gray-800'>
            Add New Restaurant
          </h1>
          <p className='text-gray-600'>
            Fill in the details to add a new restaurant to the platform.
          </p>
        </div>
      </div>

      {error && (
        <div className='mb-6 rounded-lg bg-red-50 p-4'>
          <div className='flex'>
            <div className='shrink-0'>
              <div className='h-5 w-5 text-red-400'>!</div>
            </div>
            <div className='ml-3'>
              <h3 className='text-sm font-medium text-red-800'>Error</h3>
              <div className='mt-2 text-sm text-red-700'>
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className='space-y-8'>
        <div className='grid grid-cols-1 gap-8 lg:grid-cols-2'>
          {/* Left Column */}
          <div className='space-y-6'>
            {/* Basic Info - Same as before */}
            <div className='rounded-lg bg-white p-6 shadow'>
              <h2 className='mb-4 text-lg font-semibold text-gray-800'>
                Basic Info
              </h2>
              <div className='space-y-4'>
                <div>
                  <label className='mb-1 block text-sm font-medium text-gray-700'>
                    Restaurant Name *
                  </label>
                  <input
                    {...register("name", {
                      required: "Restaurant name is required",
                      minLength: {
                        value: 2,
                        message: "Name must be at least 2 characters",
                      },
                    })}
                    type='text'
                    className={`w-full rounded-lg border px-4 py-3 ${
                      errors.name ? "border-red-300" : "border-gray-300"
                    } focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200`}
                    placeholder='Enter restaurant name'
                  />
                  {errors.name && (
                    <p className='mt-1 text-sm text-red-600'>
                      {errors.name.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className='mb-1 block text-sm font-medium text-gray-700'>
                    Description
                  </label>
                  <textarea
                    {...register("description", {
                      maxLength: {
                        value: 500,
                        message: "Description cannot exceed 500 characters",
                      },
                    })}
                    rows={3}
                    className='w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200'
                    placeholder='Brief description of the restaurant'
                  />
                  {errors.description && (
                    <p className='mt-1 text-sm text-red-600'>
                      {errors.description.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className='mb-2 block text-sm font-medium text-gray-700'>
                    Cuisine Types *
                  </label>
                  <div className='grid grid-cols-3 gap-2 sm:grid-cols-4'>
                    {cuisines.map((cuisine) => (
                      <button
                        key={cuisine}
                        type='button'
                        onClick={() => toggleCuisine(cuisine)}
                        className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          selectedCuisines.includes(cuisine)
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                        }`}
                      >
                        {cuisine}
                      </button>
                    ))}
                  </div>
                  {selectedCuisines.length === 0 && (
                    <p className='mt-1 text-sm text-red-600'>
                      Please select at least one cuisine type
                    </p>
                  )}
                </div>

                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <label className='mb-1 block text-sm font-medium text-gray-700'>
                      Phone Number
                    </label>
                    <input
                      {...register("phone", {
                        pattern: {
                          value: /^\+?[0-9\s\-\(\)]+$/,
                          message: "Please enter a valid phone number",
                        },
                      })}
                      type='tel'
                      className={`w-full rounded-lg border px-4 py-3 ${
                        errors.phone ? "border-red-300" : "border-gray-300"
                      } focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200`}
                      placeholder='+251 900 000 000'
                    />
                    {errors.phone && (
                      <p className='mt-1 text-sm text-red-600'>
                        {errors.phone.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className='mb-1 block text-sm font-medium text-gray-700'>
                      Email
                    </label>
                    <input
                      {...register("email", {
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: "Invalid email address",
                        },
                      })}
                      type='email'
                      className='w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200'
                      placeholder='restaurant@email.com'
                    />
                    {errors.email && (
                      <p className='mt-1 text-sm text-red-600'>
                        {errors.email.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Location - Same as before */}
            <div className='rounded-lg bg-white p-6 shadow'>
              <h2 className='mb-4 text-lg font-semibold text-gray-800'>
                Location
              </h2>
              <div className='space-y-4'>
                <div>
                  <label className='mb-1 block text-sm font-medium text-gray-700'>
                    Address *
                  </label>
                  <input
                    {...register("address", {
                      required: "Address is required",
                    })}
                    type='text'
                    className={`w-full rounded-lg border px-4 py-3 ${
                      errors.address ? "border-red-300" : "border-gray-300"
                    } focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200`}
                    placeholder='Enter full address'
                  />
                  {errors.address && (
                    <p className='mt-1 text-sm text-red-600'>
                      {errors.address.message}
                    </p>
                  )}
                </div>

                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <label className='mb-1 block text-sm font-medium text-gray-700'>
                      Latitude *
                    </label>
                    <input
                      {...register("latitude", {
                        required: "Latitude is required",
                        valueAsNumber: true,
                        min: {
                          value: -90,
                          message: "Latitude must be between -90 and 90",
                        },
                        max: {
                          value: 90,
                          message: "Latitude must be between -90 and 90",
                        },
                      })}
                      type='number'
                      step='any'
                      className={`w-full rounded-lg border px-4 py-3 ${
                        errors.latitude ? "border-red-300" : "border-gray-300"
                      } focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200`}
                      placeholder='9.032'
                    />
                    {errors.latitude && (
                      <p className='mt-1 text-sm text-red-600'>
                        {errors.latitude.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className='mb-1 block text-sm font-medium text-gray-700'>
                      Longitude *
                    </label>
                    <input
                      {...register("longitude", {
                        required: "Longitude is required",
                        valueAsNumber: true,
                        min: {
                          value: -180,
                          message: "Longitude must be between -180 and 180",
                        },
                        max: {
                          value: 180,
                          message: "Longitude must be between -180 and 180",
                        },
                      })}
                      type='number'
                      step='any'
                      className={`w-full rounded-lg border px-4 py-3 ${
                        errors.longitude ? "border-red-300" : "border-gray-300"
                      } focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200`}
                      placeholder='38.746'
                    />
                    {errors.longitude && (
                      <p className='mt-1 text-sm text-red-600'>
                        {errors.longitude.message}
                      </p>
                    )}
                  </div>
                </div>
                <p className='text-xs text-gray-500'>
                  Default coordinates: Addis Ababa (9.032, 38.746)
                </p>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className='space-y-6'>
            {/* Delivery Settings - Same as before */}
            <div className='rounded-lg bg-white p-6 shadow'>
              <h2 className='mb-4 text-lg font-semibold text-gray-800'>
                Delivery Settings
              </h2>
              <div className='space-y-4'>
                <div className='grid grid-cols-3 gap-4'>
                  <div>
                    <label className='mb-1 block text-sm font-medium text-gray-700'>
                      Delivery Fee (ETB)
                    </label>
                    <input
                      {...register("delivery_fee", {
                        valueAsNumber: true,
                        min: {
                          value: 0,
                          message: "Delivery fee cannot be negative",
                        },
                      })}
                      type='number'
                      step='0.01'
                      className='w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200'
                      placeholder='25'
                    />
                    {errors.delivery_fee && (
                      <p className='mt-1 text-sm text-red-600'>
                        {errors.delivery_fee.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className='mb-1 block text-sm font-medium text-gray-700'>
                      Min Order (ETB)
                    </label>
                    <input
                      {...register("min_order", {
                        valueAsNumber: true,
                        min: {
                          value: 0,
                          message: "Minimum order cannot be negative",
                        },
                      })}
                      type='number'
                      step='0.01'
                      className='w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200'
                      placeholder='100'
                    />
                    {errors.min_order && (
                      <p className='mt-1 text-sm text-red-600'>
                        {errors.min_order.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className='mb-1 block text-sm font-medium text-gray-700'>
                      Delivery Time (min)
                    </label>
                    <input
                      {...register("delivery_time", {
                        valueAsNumber: true,
                        min: {
                          value: 1,
                          message: "Delivery time must be at least 1 minute",
                        },
                      })}
                      type='number'
                      className='w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200'
                      placeholder='45'
                    />
                    {errors.delivery_time && (
                      <p className='mt-1 text-sm text-red-600'>
                        {errors.delivery_time.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className='flex items-center'>
                  <input
                    type='checkbox'
                    id='active-status'
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className='h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                  />
                  <label
                    htmlFor='active-status'
                    className='ml-2 text-sm text-gray-700'
                  >
                    Active Status - Restaurant will be visible to customers
                  </label>
                </div>
              </div>
            </div>

            {/* Images Section - UPDATED with file upload */}
            <div className='rounded-lg bg-white p-6 shadow'>
              <h2 className='mb-4 text-lg font-semibold text-gray-800'>
                Restaurant Images
              </h2>

              <div className='space-y-4'>
                {/* Upload Button */}
                <div className='flex items-center justify-center w-full'>
                  <button
                    type='button'
                    onClick={() => openImagePicker("restaurant")}
                    disabled={uploadingRestaurantImages}
                    className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg border-gray-300 ${
                      uploadingRestaurantImages
                        ? "bg-gray-100 cursor-not-allowed"
                        : "hover:border-blue-500 hover:bg-blue-50 cursor-pointer"
                    }`}
                  >
                    {uploadingRestaurantImages ? (
                      <div className='flex flex-col items-center'>
                        <div className='h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent'></div>
                        <p className='mt-2 text-sm text-gray-600'>
                          Uploading...
                        </p>
                      </div>
                    ) : (
                      <>
                        <FiUpload className='h-8 w-8 text-gray-400' />
                        <p className='mt-2 text-sm text-gray-600'>
                          Click to upload images
                        </p>
                        <p className='text-xs text-gray-500'>
                          Upload from gallery or camera
                        </p>
                      </>
                    )}
                  </button>
                </div>

                {/* Image Preview Grid */}
                {restaurantImages.length > 0 && (
                  <div>
                    <h4 className='mb-2 text-sm font-medium text-gray-700'>
                      Uploaded Images (
                      {restaurantImages.filter((img) => !img.uploading).length})
                    </h4>
                    <div className='grid grid-cols-3 gap-3'>
                      {restaurantImages.map((image) => (
                        <div
                          key={image.id}
                          className='relative group rounded-lg overflow-hidden border border-gray-200'
                        >
                          {image.uploading ? (
                            <div className='h-24 w-full bg-gray-100 flex items-center justify-center'>
                              <div className='h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent'></div>
                            </div>
                          ) : (
                            <>
                              <img
                                src={image.preview || image.url}
                                alt='Restaurant preview'
                                className='h-24 w-full object-cover'
                              />
                              <button
                                type='button'
                                onClick={() => removeRestaurantImage(image.id)}
                                className='absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity'
                              >
                                <FiX className='h-3 w-3' />
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Menu Items - UPDATED with image upload */}
            <div className='rounded-lg bg-white p-6 shadow'>
              <div className='mb-4 flex items-center justify-between'>
                <h2 className='text-lg font-semibold text-gray-800'>
                  Menu Items
                </h2>
                <button
                  type='button'
                  onClick={addNewMenuItem}
                  className='flex items-center rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700'
                >
                  <FiUpload className='mr-2' />
                  Add Menu Item
                </button>
              </div>

              {menuItems.length === 0 ? (
                <div className='rounded-lg border-2 border-dashed border-gray-300 p-8 text-center'>
                  <FiUpload className='mx-auto h-12 w-12 text-gray-400' />
                  <p className='mt-2 text-gray-600'>No menu items added yet</p>
                  <p className='mt-1 text-sm text-gray-500'>
                    Click "Add Menu Item" to start building your menu
                  </p>
                </div>
              ) : (
                <div className='space-y-4'>
                  {menuItems.map((item, index) => {
                    // Create ref for each menu item's file input
                    if (!menuItemImageInputRefs.current[index]) {
                      menuItemImageInputRefs.current[index] = null;
                    }

                    return (
                      <div
                        key={index}
                        className='rounded-lg border border-gray-200 p-4'
                      >
                        {/* Hidden file input for menu item */}
                        <input
                          type='file'
                          ref={(el) => {
                            menuItemImageInputRefs.current[index] = el;
                          }}
                          className='hidden'
                          accept='image/*'
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleMenuItemImageUpload(
                                e.target.files[0],
                                index,
                              );
                            }
                            e.target.value = "";
                          }}
                        />

                        <div className='mb-3 flex items-center justify-between'>
                          <h3 className='font-medium text-gray-800'>
                            Menu Item #{index + 1}
                          </h3>
                          <button
                            type='button'
                            onClick={() => removeMenuItem(index)}
                            className='rounded-lg p-1 hover:bg-red-50'
                          >
                            <FiX className='h-4 w-4 text-red-600' />
                          </button>
                        </div>

                        <div className='space-y-3'>
                          <div>
                            <label className='mb-1 block text-sm font-medium text-gray-700'>
                              Name *
                            </label>
                            <input
                              type='text'
                              value={item.name}
                              onChange={(e) =>
                                updateMenuItem(index, "name", e.target.value)
                              }
                              className='w-full rounded-lg border border-gray-300 px-3 py-2'
                              placeholder='Item name'
                              required
                            />
                          </div>

                          <div>
                            <label className='mb-1 block text-sm font-medium text-gray-700'>
                              Description
                            </label>
                            <textarea
                              value={item.description}
                              onChange={(e) =>
                                updateMenuItem(
                                  index,
                                  "description",
                                  e.target.value,
                                )
                              }
                              rows={2}
                              className='w-full rounded-lg border border-gray-300 px-3 py-2'
                              placeholder='Item description'
                            />
                          </div>

                          <div className='grid grid-cols-2 gap-3'>
                            <div>
                              <label className='mb-1 block text-sm font-medium text-gray-700'>
                                Price (ETB) *
                              </label>
                              <input
                                type='number'
                                value={item.price}
                                onChange={(e) =>
                                  updateMenuItem(
                                    index,
                                    "price",
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                                step='0.01'
                                className='w-full rounded-lg border border-gray-300 px-3 py-2'
                                placeholder='0.00'
                                required
                              />
                            </div>

                            <div>
                              <label className='mb-1 block text-sm font-medium text-gray-700'>
                                Category *
                              </label>
                              <input
                                type='text'
                                value={item.category}
                                onChange={(e) =>
                                  updateMenuItem(
                                    index,
                                    "category",
                                    e.target.value,
                                  )
                                }
                                className='w-full rounded-lg border border-gray-300 px-3 py-2'
                                placeholder='e.g., Main Course, Appetizer'
                                required
                              />
                            </div>
                          </div>

                          <div className='grid grid-cols-2 gap-3'>
                            <div>
                              <label className='mb-1 block text-sm font-medium text-gray-700'>
                                Preparation Time (min)
                              </label>
                              <input
                                type='number'
                                value={item.preparation_time}
                                onChange={(e) =>
                                  updateMenuItem(
                                    index,
                                    "preparation_time",
                                    parseInt(e.target.value) || 0,
                                  )
                                }
                                className='w-full rounded-lg border border-gray-300 px-3 py-2'
                                placeholder='30'
                              />
                            </div>

                            <div>
                              <label className='mb-1 block text-sm font-medium text-gray-700'>
                                Image
                              </label>
                              <div className='flex items-center space-x-2'>
                                <button
                                  type='button'
                                  onClick={() => openImagePicker("menu", index)}
                                  className='flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50'
                                >
                                  {item.image ? "Change Image" : "Upload Image"}
                                </button>
                                {item.image && (
                                  <button
                                    type='button'
                                    onClick={() =>
                                      updateMenuItem(index, "image", "")
                                    }
                                    className='rounded-lg p-2 text-red-600 hover:bg-red-50'
                                  >
                                    <FiX className='h-4 w-4' />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Image Preview for Menu Item */}
                          {item.image && (
                            <div className='mt-2'>
                              <img
                                src={item.image}
                                alt='Menu item preview'
                                className='h-32 w-32 rounded-lg object-cover'
                              />
                            </div>
                          )}

                          <div>
                            <div className='mb-2 flex items-center justify-between'>
                              <label className='block text-sm font-medium text-gray-700'>
                                Ingredients
                              </label>
                              <button
                                type='button'
                                onClick={() => addIngredientToMenuItem(index)}
                                className='text-sm text-blue-600 hover:text-blue-800'
                              >
                                + Add Ingredient
                              </button>
                            </div>
                            {item.ingredients.length > 0 ? (
                              <div className='flex flex-wrap gap-2'>
                                {item.ingredients.map(
                                  (ingredient, ingIndex) => (
                                    <span
                                      key={ingIndex}
                                      className='inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm'
                                    >
                                      {ingredient}
                                      <button
                                        type='button'
                                        onClick={() =>
                                          removeIngredient(index, ingIndex)
                                        }
                                        className='ml-2 text-gray-500 hover:text-red-600'
                                      >
                                        <FiX className='h-3 w-3' />
                                      </button>
                                    </span>
                                  ),
                                )}
                              </div>
                            ) : (
                              <p className='text-sm text-gray-500'>
                                No ingredients added
                              </p>
                            )}
                          </div>

                          <div className='flex items-center'>
                            <input
                              type='checkbox'
                              id={`available-${index}`}
                              checked={item.is_available}
                              onChange={(e) =>
                                updateMenuItem(
                                  index,
                                  "is_available",
                                  e.target.checked,
                                )
                              }
                              className='h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                            />
                            <label
                              htmlFor={`available-${index}`}
                              className='ml-2 text-sm text-gray-700'
                            >
                              Item is available for order
                            </label>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className='flex justify-end space-x-4 border-t pt-6'>
          <button
            type='button'
            onClick={() => navigate("/restaurants")}
            className='rounded-lg border border-gray-300 px-6 py-2 font-medium text-gray-700 hover:bg-gray-50'
            disabled={loading || uploadingRestaurantImages}
          >
            Cancel
          </button>
          <button
            type='submit'
            disabled={
              loading ||
              selectedCuisines.length === 0 ||
              uploadingRestaurantImages ||
              restaurantImages.some((img) => img.uploading)
            }
            className='flex items-center rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50'
          >
            {loading || uploadingRestaurantImages ? (
              <>
                <div className='mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent'></div>
                {uploadingRestaurantImages
                  ? "Uploading Images..."
                  : "Creating..."}
              </>
            ) : (
              <>
                <FiSave className='mr-2' />
                Create Restaurant
              </>
            )}
          </button>
        </div>

        {selectedCuisines.length === 0 && (
          <div className='rounded-lg bg-yellow-50 p-4'>
            <p className='text-sm text-yellow-700'>
              <strong>Note:</strong> Please select at least one cuisine type
              before creating the restaurant.
            </p>
          </div>
        )}
      </form>
    </div>
  );
};

export default AddRestaurant;
