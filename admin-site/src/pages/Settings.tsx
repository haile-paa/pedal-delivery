import React, { useState } from "react";
import { FiSave } from "react-icons/fi";

const Settings: React.FC = () => {
  const [settings, setSettings] = useState({
    siteName: "FoodAdmin",
    adminEmail: "admin@foodadmin.com",
    currency: "ETB",
    timezone: "Africa/Addis_Ababa",
    enableNotifications: true,
    maintenanceMode: false,
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Save settings logic here
    console.log("Settings saved:", settings);
    alert("Settings saved (demo)");
  };

  return (
    <div>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold text-gray-800'>Settings</h1>
        <p className='text-gray-600'>Manage platform configuration</p>
      </div>

      <div className='rounded-lg bg-white p-6 shadow'>
        <form onSubmit={handleSubmit} className='space-y-6'>
          <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
            <div>
              <label className='mb-2 block text-sm font-medium text-gray-700'>
                Site Name
              </label>
              <input
                type='text'
                name='siteName'
                value={settings.siteName}
                onChange={handleChange}
                className='w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none'
              />
            </div>
            <div>
              <label className='mb-2 block text-sm font-medium text-gray-700'>
                Admin Email
              </label>
              <input
                type='email'
                name='adminEmail'
                value={settings.adminEmail}
                onChange={handleChange}
                className='w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none'
              />
            </div>
            <div>
              <label className='mb-2 block text-sm font-medium text-gray-700'>
                Currency
              </label>
              <select
                name='currency'
                value={settings.currency}
                onChange={handleChange}
                className='w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none'
              >
                <option value='ETB'>ETB (Ethiopian Birr)</option>
                <option value='USD'>USD (US Dollar)</option>
                <option value='EUR'>EUR (Euro)</option>
              </select>
            </div>
            <div>
              <label className='mb-2 block text-sm font-medium text-gray-700'>
                Timezone
              </label>
              <select
                name='timezone'
                value={settings.timezone}
                onChange={handleChange}
                className='w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none'
              >
                <option value='Africa/Addis_Ababa'>
                  East Africa Time (Addis Ababa)
                </option>
                <option value='UTC'>UTC</option>
                <option value='America/New_York'>Eastern Time</option>
              </select>
            </div>
          </div>

          <div className='space-y-4'>
            <div className='flex items-center'>
              <input
                type='checkbox'
                name='enableNotifications'
                id='enableNotifications'
                checked={settings.enableNotifications}
                onChange={handleChange}
                className='h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500'
              />
              <label
                htmlFor='enableNotifications'
                className='ml-2 text-sm text-gray-700'
              >
                Enable email notifications
              </label>
            </div>
            <div className='flex items-center'>
              <input
                type='checkbox'
                name='maintenanceMode'
                id='maintenanceMode'
                checked={settings.maintenanceMode}
                onChange={handleChange}
                className='h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500'
              />
              <label
                htmlFor='maintenanceMode'
                className='ml-2 text-sm text-gray-700'
              >
                Maintenance mode (disable frontend access)
              </label>
            </div>
          </div>

          <div className='flex justify-end'>
            <button
              type='submit'
              className='flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700'
            >
              <FiSave /> Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;
