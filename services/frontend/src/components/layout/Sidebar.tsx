/**
 * Sidebar navigation component
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, FileText, X } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { setSidebarOpen } from '../../store/slices/uiSlice';
import { useAuth } from '../../hooks/useAuth';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin', 'office_staff', 'project_manager'] },
  { name: 'Projects', href: '/projects', icon: FolderKanban, roles: ['admin', 'office_staff', 'project_manager'] },
  { name: 'TNM Tickets', href: '/tnm-tickets', icon: FileText, roles: ['admin', 'office_staff', 'project_manager', 'foreman'] },
  { name: 'Create TNM', href: '/tnm/create', icon: FileText, roles: ['foreman'] },
];

export const Sidebar: React.FC = () => {
  const { sidebarOpen } = useSelector((state: RootState) => state.ui);
  const { hasRole } = useAuth();
  const dispatch = useDispatch();

  const closeSidebar = () => dispatch(setSidebarOpen(false));

  const filteredNavigation = navigation.filter((item) =>
    item.roles.some((role) => hasRole(role))
  );

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-900 bg-opacity-50 z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 lg:hidden">
          <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
          <button onClick={closeSidebar} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="px-3 py-4 space-y-1">
          {filteredNavigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={closeSidebar}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
};
