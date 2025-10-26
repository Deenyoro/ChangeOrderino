/**
 * Header component
 */

import React from 'react';
import { Menu, LogOut, User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useDispatch } from 'react-redux';
import { toggleSidebar } from '../../store/slices/uiSlice';
import { EmailNotificationBell } from '../common/EmailNotificationBell';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const dispatch = useDispatch();

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left side */}
          <div className="flex items-center">
            <button
              onClick={() => dispatch(toggleSidebar())}
              className="text-gray-500 hover:text-gray-700 focus:outline-none lg:hidden"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="ml-4 text-xl font-bold text-gray-900">ChangeOrderino</h1>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            <EmailNotificationBell />
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">{user?.full_name}</span>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
