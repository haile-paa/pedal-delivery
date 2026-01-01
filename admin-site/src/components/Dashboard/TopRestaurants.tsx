import React from "react";
import { FiStar } from "react-icons/fi";

interface Restaurant {
  id: number;
  name: string;
  orders: number;
  rating: number;
}

interface TopRestaurantsProps {
  restaurants: Restaurant[];
}

const TopRestaurants: React.FC<TopRestaurantsProps> = ({ restaurants }) => {
  return (
    <div className='rounded-lg bg-white p-6 shadow'>
      <div className='mb-4 flex items-center justify-between'>
        <h3 className='text-lg font-semibold text-gray-800'>Top Restaurants</h3>
        <button className='text-sm text-blue-600 hover:text-blue-800'>
          View All
        </button>
      </div>

      <div className='space-y-4'>
        {restaurants.map((restaurant, index) => (
          <div
            key={restaurant.id}
            className='flex items-center justify-between rounded-lg border border-gray-200 p-4'
          >
            <div className='flex items-center'>
              <div className='flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 font-bold text-gray-800'>
                #{index + 1}
              </div>
              <div className='ml-4'>
                <h4 className='font-medium text-gray-800'>{restaurant.name}</h4>
                <div className='mt-1 flex items-center text-sm text-gray-600'>
                  <FiStar className='mr-1 h-4 w-4 text-yellow-500' />
                  {restaurant.rating} • {restaurant.orders.toLocaleString()}{" "}
                  orders
                </div>
              </div>
            </div>
            <button className='rounded-lg bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 hover:bg-blue-100'>
              View
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TopRestaurants;
