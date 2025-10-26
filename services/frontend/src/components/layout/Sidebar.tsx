/**
 * Sidebar navigation component
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, FileText, Settings, HelpCircle, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { setSidebarOpen, toggleSidebarCollapsed } from '../../store/slices/uiSlice';
import { useAuth } from '../../hooks/useAuth';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['admin', 'office_staff', 'project_manager'] },
  { name: 'Projects', href: '/projects', icon: FolderKanban, roles: ['admin', 'office_staff', 'project_manager'] },
  { name: 'TNM Tickets', href: '/tnm-tickets', icon: FileText, roles: ['admin', 'office_staff', 'project_manager'] },
  { name: 'Create TNM', href: '/tnm/create', icon: FileText, roles: ['foreman', 'admin', 'office_staff', 'project_manager'] },
  { name: 'Settings', href: '/settings', icon: Settings, roles: ['admin'] },
  { name: 'Help', href: '/help', icon: HelpCircle, roles: ['admin', 'office_staff', 'project_manager', 'foreman'] },
];

export const Sidebar: React.FC = () => {
  const { sidebarOpen, sidebarCollapsed } = useSelector((state: RootState) => state.ui);
  const { hasRole } = useAuth();
  const dispatch = useDispatch();

  const closeSidebar = () => dispatch(setSidebarOpen(false));
  const toggleCollapsed = () => dispatch(toggleSidebarCollapsed());

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
        className={`fixed top-0 left-0 z-50 h-full bg-white border-r border-gray-200 transform transition-all duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${sidebarCollapsed ? 'w-16' : 'w-64'}`}
      >
        {/* Mobile header */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 lg:hidden">
          <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
          <button onClick={closeSidebar} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Desktop collapse toggle */}
        <div className="hidden lg:flex items-center justify-between h-12 px-2 border-b border-gray-200">
          {!sidebarCollapsed && (
            <div className="px-2">
              <div className="text-center">
                <div className="text-xs text-gray-500">© 2025 KawaConnect LLC</div>
                <a
                  href="https://kawaconnect.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                >
                  kawaconnect.com
                </a>
              </div>
            </div>
          )}
          <button
            onClick={toggleCollapsed}
            className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
        </div>

        <nav className="px-2 py-4 space-y-1">
          {filteredNavigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={closeSidebar}
              title={sidebarCollapsed ? item.name : undefined}
              className={({ isActive }) =>
                `flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>{item.name}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
};
