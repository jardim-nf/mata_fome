import React from 'react';
import { IoClose, IoRestaurant } from 'react-icons/io5';

export default function ChatHeader({ onClose, statusText }) {
  return (
    <div className="px-5 py-4 flex items-center justify-between bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 bg-gradient-to-tr from-red-600 to-orange-500 text-white rounded-full flex items-center justify-center shadow-md ring-2 ring-white">
          <IoRestaurant className="text-2xl" />
        </div>
        <div>
          <span className="font-bold text-gray-900 text-lg block leading-tight">Jucleildo</span>
          <span className="text-xs text-gray-500 flex items-center gap-1 font-medium">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> {statusText}
          </span>
        </div>
      </div>
      <button onClick={onClose} className="w-9 h-9 flex items-center justify-center bg-gray-50 text-gray-400 rounded-full hover:bg-red-50 hover:text-red-500 transition">
        <IoClose size={22} />
      </button>
    </div>
  );
}