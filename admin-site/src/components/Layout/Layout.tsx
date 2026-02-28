import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";

const Layout: React.FC = () => {
  return (
    <div className='flex min-h-screen bg-gray-50'>
      {/* Sidebar handles its own positioning and mobile toggle */}
      <Sidebar />

      {/* Main content area – flex column to stack header and main */}
      <div className='flex-1 flex flex-col overflow-hidden'>
        <Header />
        <main className='flex-1 overflow-auto p-4 lg:p-6'>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
