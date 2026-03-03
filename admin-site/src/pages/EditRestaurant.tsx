import React, { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { FiArrowLeft, FiSave, FiUpload, FiX } from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
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

interface UploadedImage {
  id: string;
  url: string;
  file?: File;
  preview: string;
  uploading: boolean;
}

const EditRestaurant: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [restaurantImages, setRestaurantImages] = useState<UploadedImage[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RestaurantFormData>();

  const cuisines = [
    "Fast Food", "Italian", "Ethiopian", "American", "Asian",
    "Mexican", "Indian", "Chinese", "Pizza", "Burgers", "Seafood", "Vegetarian"
  ];

  // Fetch restaurant data
  useEffect(() => {
    const fetchRestaurant = async () => {
      try {
        setFetching(true);
        const response = await restaurantAPI.getById(id!);
        const data = response.data;

        // Normalize ID (in case backend uses 'id')
        data._id = data._id || data.id;

        setSelectedCuisines(data.cuisine_type || []);
        setIsActive(data.is_active);

        // Populate form fields
        reset({
          name: data.name,
          description: data.description || "",
          address: data.address,
          phone: data.phone,
          email: data.email || "",
          latitude: data.location?.coordinates?.[1] || 9.032,
          longitude: data.location?.coordinates?.[0] || 38.746,
          delivery_fee: data.delivery_fee || 0,
          min_order: data.min_order || 0,
          delivery_time: data.delivery_time || 45,
        });

        // Load existing images
        if (data.images && data.images.length) {
          const loadedImages = data.images.map((url: string, index: number) => ({
            id: `existing-${index}`,
            url,
            preview: url,
            uploading: false,
          }));
          setRestaurantImages(loadedImages);
        }
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

  // Image upload handlers
  const handleImageUpload = async (files: FileList) => {
    setUploadingImages(true);
    const uploadedFiles = Array.from(files);

    for (const file of uploadedFiles) {
      const previewUrl = URL.createObjectURL(file);
      const tempId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

      const newImage: UploadedImage = {
        id: tempId,
        url: "",
        file,
        preview: previewUrl,
        uploading: true,
      };
      setRestaurantImages((prev) => [...prev, newImage]);

      try {
        const formData = new FormData();
        formData.append("image", file);
        formData.append("type", "restaurant");
        const response = await uploadAPI.uploadImage(formData);
        setRestaurantImages((prev) =>
          prev.map((img) =>
            img.id === tempId
              ? { ...img, url: response.data.url, uploading: false }
              : img
          )
        );
      } catch (err) {
        console.error("Failed to upload image:", err);
        setRestaurantImages((prev) =>
          prev.map((img) =>
            img.id === tempId ? { ...img, uploading: false } : img
          )
        );
      }
    }
    setUploadingImages(false);
  };

  const removeImage = (id: string) => {
    setRestaurantImages((prev) => {
      const imageToRemove = prev.find((img) => img.id === id);
      if (imageToRemove?.preview && !imageToRemove.url.startsWith("http")) {
        URL.revokeObjectURL(imageToRemove.preview);
      }
      return prev.filter((img) => img.id !== id);
    });
  };

  const toggleCuisine = (cuisine: string) => {
    setSelectedCuisines((prev) =>
      prev.includes(cuisine)
        ? prev.filter((c) => c !== cuisine)
        : [...prev, cuisine]
    );
  };

  const onSubmit = async (data: RestaurantFormData) => {
    try {
      setLoading(true);
      setError("");

      // Get final image URLs
      const uploadedImageUrls = restaurantImages
        .filter((img) => img.url && !img.uploading)
        .map((img) => img.url);

      const formData = {
        ...data,
        cuisine_type: selectedCuisines,
        is_active: isActive,
        images: uploadedImageUrls,
        // If backend expects location object, use this:
        // location: {
        //   type: "Point",
        //   coordinates: [data.longitude, data.latitude]
        // }
      };

      await restaurantAPI.update(id!, formData);
      alert("Restaurant updated successfully");
      navigate("/restaurants");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update restaurant");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading restaurant data...</div>
      </div>
    );
  }

  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        multiple
        onChange={(e) => {
          if (e.target.files) handleImageUpload(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="mb-6 flex items-center">
        <button
          onClick={() => navigate("/restaurants")}
          className="mr-4 rounded-lg p-2 hover:bg-gray-100"
        >
          <FiArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Edit Restaurant</h1>
          <p className="text-gray-600">Update restaurant details</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Left Column – Basic Info & Location */}
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-semibold text-gray-800">Basic Info</h2>
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Restaurant Name *
                  </label>
                  <input
                    {...register("name", { required: "Name is required" })}
                    className={`w-full rounded-lg border px-4 py-3 ${
                      errors.name ? "border-red-300" : "border-gray-300"
                    } focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200`}
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    {...register("description")}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                {/* Cuisine Types */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Cuisine Types *
                  </label>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {cuisines.map((cuisine) => (
                      <button
                        key={cuisine}
                        type="button"
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
                    <p className="mt-1 text-sm text-red-600">
                      Please select at least one cuisine type
                    </p>
                  )}
                </div>

                {/* Phone & Email */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Phone Number
                    </label>
                    <input
                      {...register("phone")}
                      type="tel"
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <input
                      {...register("email")}
                      type="email"
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-semibold text-gray-800">Location</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Address *
                  </label>
                  <input
                    {...register("address", { required: "Address is required" })}
                    className={`w-full rounded-lg border px-4 py-3 ${
                      errors.address ? "border-red-300" : "border-gray-300"
                    } focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200`}
                  />
                  {errors.address && (
                    <p className="mt-1 text-sm text-red-600">{errors.address.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Latitude *
                    </label>
                    <input
                      {...register("latitude", {
                        required: "Latitude is required",
                        valueAsNumber: true,
                      })}
                      type="number"
                      step="any"
                      className={`w-full rounded-lg border px-4 py-3 ${
                        errors.latitude ? "border-red-300" : "border-gray-300"
                      } focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200`}
                    />
                    {errors.latitude && (
                      <p className="mt-1 text-sm text-red-600">{errors.latitude.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Longitude *
                    </label>
                    <input
                      {...register("longitude", {
                        required: "Longitude is required",
                        valueAsNumber: true,
                      })}
                      type="number"
                      step="any"
                      className={`w-full rounded-lg border px-4 py-3 ${
                        errors.longitude ? "border-red-300" : "border-gray-300"
                      } focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200`}
                    />
                    {errors.longitude && (
                      <p className="mt-1 text-sm text-red-600">{errors.longitude.message}</p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  Default: Addis Ababa (9.032, 38.746)
                </p>
              </div>
            </div>
          </div>

          {/* Right Column – Delivery & Images */}
          <div className="space-y-6">
            {/* Delivery Settings */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-semibold text-gray-800">
                Delivery Settings
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Delivery Fee (ETB)
                    </label>
                    <input
                      {...register("delivery_fee", { valueAsNumber: true })}
                      type="number"
                      step="0.01"
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Min Order (ETB)
                    </label>
                    <input
                      {...register("min_order", { valueAsNumber: true })}
                      type="number"
                      step="0.01"
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Delivery Time (min)
                    </label>
                    <input
                      {...register("delivery_time", { valueAsNumber: true })}
                      type="number"
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="active-status"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="active-status" className="ml-2 text-sm text-gray-700">
                    Active – Restaurant is visible to customers
                  </label>
                </div>
              </div>
            </div>

            {/* Restaurant Images */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-semibold text-gray-800">Restaurant Images</h2>
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImages}
                  className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg border-gray-300 hover:border-blue-500 hover:bg-blue-50 cursor-pointer disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  {uploadingImages ? (
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                      <p className="mt-2 text-sm text-gray-600">Uploading...</p>
                    </div>
                  ) : (
                    <>
                      <FiUpload className="h-8 w-8 text-gray-400" />
                      <p className="mt-2 text-sm text-gray-600">Click to upload images</p>
                      <p className="text-xs text-gray-500">Upload from gallery or camera</p>
                    </>
                  )}
                </button>

                {restaurantImages.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-medium text-gray-700">
                      Images ({restaurantImages.filter((img) => !img.uploading).length})
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      {restaurantImages.map((image) => (
                        <div
                          key={image.id}
                          className="relative group rounded-lg overflow-hidden border border-gray-200"
                        >
                          {image.uploading ? (
                            <div className="h-24 w-full bg-gray-100 flex items-center justify-center">
                              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                            </div>
                          ) : (
                            <>
                              <img
                                src={image.preview || image.url}
                                alt="Restaurant preview"
                                className="h-24 w-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => removeImage(image.id)}
                                className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <FiX className="h-3 w-3" />
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
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-4 border-t pt-6">
          <button
            type="button"
            onClick={() => navigate("/restaurants")}
            className="rounded-lg border border-gray-300 px-6 py-2 font-medium text-gray-700 hover:bg-gray-50"
            disabled={loading || uploadingImages}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || uploadingImages || selectedCuisines.length === 0}
            className="flex items-center rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                Saving...
              </>
            ) : (
              <>
                <FiSave className="mr-2" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditRestaurant;