import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";

const Layout: React.FC = () => {
  return (
    <div className='flex h-screen bg-gray-50'>
      <Sidebar />
      <div className='ml-64 flex-1 overflow-auto'>
        <Header />
        <main className='p-6'>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
