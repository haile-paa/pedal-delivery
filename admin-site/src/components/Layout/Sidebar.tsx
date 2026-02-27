import React from "react";
import { NavLink } from "react-router-dom";
import {
  FiHome,
  FiShoppingBag,
  FiTruck,
  FiBarChart2,
  FiSettings,
  FiLogOut,
} from "react-icons/fi";
import { useAuth } from "../../contexts/AuthContext";

const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();

  const navItems = [
    { path: "/dashboard", icon: FiHome, label: "Dashboard" },
    { path: "/restaurants", icon: FiShoppingBag, label: "Restaurants" },
    { path: "/drivers", icon: FiTruck, label: "Drivers" },
    { path: "/orders", icon: FiBarChart2, label: "Orders" },
    // { path: "/analytics", icon: FiBarChart2, label: "Analytics" },
    { path: "/settings", icon: FiSettings, label: "Settings" },
  ];

  // Extract initials for avatar
  const getInitials = (name: string) => {
    if (!name) return "A";
    return name.charAt(0).toUpperCase();
  };

  const getUserName = () => {
    if (!user) return "Admin User";
    if (user.firstName) return user.firstName;
    if (user.email) return user.email.split("@")[0];
    if (user.phone) return user.phone;
    return "Admin";
  };

  return (
    <div className='fixed left-0 top-0 h-screen w-64 bg-gray-900 text-white'>
      <div className='p-6'>
        <h1 className='text-2xl font-bold'>PedalDelivery</h1>
      </div>

      <nav className='mt-8'>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center px-6 py-3 text-gray-300 hover:bg-gray-800 hover:text-white ${
                isActive ? "bg-gray-800 text-white" : ""
              }`
            }
          >
            <item.icon className='mr-3 h-5 w-5' />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className='absolute bottom-0 w-full p-6'>
        <div className='mb-4 flex items-center'>
          <div className='flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-semibold'>
            {getInitials(getUserName())}
          </div>
          <div className='ml-3'>
            <p className='text-sm font-medium'>{getUserName()}</p>
            <p className='text-xs text-gray-400'>Admin</p>
          </div>
        </div>

        <button
          onClick={logout}
          className='flex w-full items-center rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-300 hover:bg-gray-700'
        >
          <FiLogOut className='mr-2 h-4 w-4' />
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
