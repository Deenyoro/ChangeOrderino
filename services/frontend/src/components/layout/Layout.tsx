/**
 * Main layout component
 */

import React, { useEffect } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useDispatch } from 'react-redux';
import { setIsMobile } from '../../store/slices/uiSlice';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const dispatch = useDispatch();
  const isMobile = useIsMobile();

  useEffect(() => {
    dispatch(setIsMobile(isMobile));
  }, [isMobile, dispatch]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};
