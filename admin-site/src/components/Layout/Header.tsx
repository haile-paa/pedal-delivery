import React, { useState } from "react";
import { FiSearch, FiBell } from "react-icons/fi";

const Header: React.FC = () => {
  const [search, setSearch] = useState("");

  return (
    <header className='sticky top-0 z-10 border-b bg-white px-6 py-4'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center'>
          <div className='relative'>
            <FiSearch className='absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400' />
            <input
              type='text'
              placeholder='Search orders, restaurants...'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className='rounded-lg border border-gray-300 pl-10 pr-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200'
            />
          </div>
        </div>

        <div className='flex items-center space-x-4'>
          <button className='relative rounded-full p-2 hover:bg-gray-100'>
            <FiBell className='h-5 w-5' />
            <span className='absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500'></span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
