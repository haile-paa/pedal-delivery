import React, { useState, useEffect } from "react";
import { FiSave } from "react-icons/fi";
import { useAuth } from "../contexts/AuthContext";
import { adminAPI } from "../services/api";

interface AdminProfile {
  phone: string;
  email: string;
  firstName: string;
  lastName?: string;
}

const Settings: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<AdminProfile>({
    phone: user?.phone || "",
    email: user?.email || "",
    firstName: user?.firstName || "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        setLoading(true);
        const response = await adminAPI.getProfile();
        setProfile(response.data);
      } catch (err: any) {
        console.error("Failed to fetch admin profile", err);
        setError("Could not load profile. Please refresh.");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await adminAPI.updateProfile({
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
      });
      setSuccess("Profile updated successfully");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className='flex justify-center items-center h-64'>
        <div className='text-lg'>Loading profile...</div>
      </div>
    );
  }

  return (
    <div>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold text-gray-800'>Settings</h1>
        <p className='text-gray-600'>Manage your admin profile</p>
      </div>

      <div className='rounded-lg bg-white p-6 shadow'>
        {error && (
          <div className='mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600'>
            {error}
          </div>
        )}
        {success && (
          <div className='mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-600'>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className='space-y-6'>
          <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
            {/* Phone (read‑only) */}
            <div>
              <label className='mb-2 block text-sm font-medium text-gray-700'>
                Phone Number
              </label>
              <input
                type='tel'
                value={profile.phone}
                readOnly
                className='w-full rounded-lg border border-gray-300 bg-gray-100 px-4 py-2 text-gray-500 cursor-not-allowed'
              />
              <p className='mt-1 text-xs text-gray-500'>
                Phone number cannot be changed
              </p>
            </div>

            {/* Email */}
            <div>
              <label className='mb-2 block text-sm font-medium text-gray-700'>
                Email Address
              </label>
              <input
                type='email'
                name='email'
                value={profile.email}
                onChange={handleChange}
                className='w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none'
                placeholder='admin@example.com'
              />
            </div>

            {/* First Name */}
            <div>
              <label className='mb-2 block text-sm font-medium text-gray-700'>
                First Name
              </label>
              <input
                type='text'
                name='firstName'
                value={profile.firstName}
                onChange={handleChange}
                className='w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none'
                placeholder='Your name'
              />
            </div>
          </div>

          <div className='flex justify-end'>
            <button
              type='submit'
              disabled={saving}
              className='flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50'
            >
              {saving ? (
                <>
                  <div className='h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent'></div>
                  Saving...
                </>
              ) : (
                <>
                  <FiSave /> Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;
