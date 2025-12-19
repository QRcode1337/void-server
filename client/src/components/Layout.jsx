import React, { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navigation from './Navigation';
import MobileHeader from './MobileHeader';
import ServerLogsViewer from './ServerLogsViewer';
import { WebSocketProvider } from '../contexts/WebSocketContext';

const Layout = () => {
  const [plugins, setPlugins] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Sidebar open state - persisted in localStorage
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (window.innerWidth < 768) return false; // Always collapsed on mobile
    const savedState = localStorage.getItem('sidebarOpen');
    return savedState === null ? true : savedState === 'true'; // Default to open on desktop
  });

  useEffect(() => {
    fetch('/api/plugins')
      .then(res => res.json())
      .then(data => {
        // API returns { installed, available, loadedPlugins }
        // Navigation needs the installed plugins that are enabled
        const enabledPlugins = (data.installed || []).filter(p => p.enabled !== false);
        setPlugins(enabledPlugins);
      })
      .catch(err => console.error('Failed to fetch plugins:', err));
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Persist sidebar state to localStorage (desktop only)
  useEffect(() => {
    if (!isMobile) {
      localStorage.setItem('sidebarOpen', sidebarOpen.toString());
    }
  }, [sidebarOpen, isMobile]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);

  return (
    <WebSocketProvider>
      <div className="flex h-screen overflow-hidden text-[var(--color-text-primary)]">
        <Toaster position="top-right" />

        {/* Mobile Header */}
        <MobileHeader sidebarOpen={sidebarOpen} toggleSidebar={toggleSidebar} />

        {/* Navigation Sidebar */}
        <Navigation sidebarOpen={sidebarOpen} toggleSidebar={toggleSidebar} plugins={plugins} />

        {/* Main Content Area */}
        <div
          className="flex-1 flex flex-col overflow-hidden transition-all duration-300"
          style={{
            marginLeft: isMobile ? '0' : sidebarOpen ? '250px' : '60px',
            marginTop: isMobile ? '56px' : '0',
            paddingBottom: '48px', // Space for ServerLogsViewer footer
          }}
        >
          <main className="flex-1 overflow-y-auto p-2 md:p-6">
            <Outlet context={{ plugins, setPlugins }} />
          </main>
        </div>

        {/* Fixed Footer with Server Logs */}
        <ServerLogsViewer sidebarOpen={sidebarOpen} />
      </div>
    </WebSocketProvider>
  );
};

export default Layout;
