import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navigation from './Navigation';
import MobileHeader from './MobileHeader';
import ServerLogsViewer from './ServerLogsViewer';
import { WebSocketProvider } from '../contexts/WebSocketContext';

const Layout = () => {
  const location = useLocation();
  const [plugins, setPlugins] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Auto-collapse setting (default: true = enabled)
  const [autoCollapseNav, setAutoCollapseNav] = useState(() => {
    const saved = localStorage.getItem('autoCollapseNav');
    return saved === null ? true : saved === 'true';
  });

  // Sidebar open state - depends on auto-collapse setting
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (window.innerWidth < 768) return false; // Always collapsed on mobile
    const autoCollapse = localStorage.getItem('autoCollapseNav');
    const isAutoCollapse = autoCollapse === null ? true : autoCollapse === 'true';
    if (isAutoCollapse) return false; // Start collapsed when auto-collapse enabled
    // When auto-collapse disabled, restore previous state
    const savedState = localStorage.getItem('sidebarOpen');
    return savedState === 'true';
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

  // Auto-collapse sidebar on route change (desktop only, when enabled)
  // Intentionally only depends on pathname - we collapse on navigation, not state changes
  useEffect(() => {
    if (!isMobile && autoCollapseNav && sidebarOpen) {
      setSidebarOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Persist sidebar state when auto-collapse is disabled
  useEffect(() => {
    if (!autoCollapseNav && !isMobile) {
      localStorage.setItem('sidebarOpen', sidebarOpen.toString());
    }
  }, [sidebarOpen, autoCollapseNav, isMobile]);

  // Listen for auto-collapse setting changes from other components
  useEffect(() => {
    const handleStorageChange = e => {
      if (e.key === 'autoCollapseNav') {
        const newValue = e.newValue === 'true';
        setAutoCollapseNav(newValue);
        if (newValue && !isMobile) {
          setSidebarOpen(false);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [isMobile]);

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
