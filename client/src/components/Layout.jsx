import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Navigation from './Navigation';
import MobileHeader from './MobileHeader';
import ServerLogsViewer from './ServerLogsViewer';
import { WebSocketProvider } from '../contexts/WebSocketContext';

const Layout = () => {
    const [plugins, setPlugins] = useState([]);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

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

    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    };

    return (
        <WebSocketProvider>
            <div className="flex h-screen overflow-hidden text-[var(--color-text-primary)]">
                <Toaster position="top-right" />

                {/* Mobile Header */}
                <MobileHeader sidebarOpen={sidebarOpen} toggleSidebar={toggleSidebar} />

                {/* Navigation Sidebar */}
                <Navigation
                    sidebarOpen={sidebarOpen}
                    toggleSidebar={toggleSidebar}
                    plugins={plugins}
                />

                {/* Main Content Area */}
                <div
                    className="flex-1 flex flex-col overflow-hidden transition-all duration-300"
                    style={{
                        marginLeft: isMobile ? '0' : (sidebarOpen ? '250px' : '60px'),
                        marginTop: isMobile ? '56px' : '0',
                        paddingBottom: '48px' // Space for ServerLogsViewer footer
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
