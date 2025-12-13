import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Home,
    ChevronDown,
    ChevronRight,
    ChevronLeft,
    RotateCw,
    Box,
    Cat,
    Music,
    Video,
    Palette,
    FileText
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import toast from 'react-hot-toast';
import { useTheme } from '../contexts/ThemeContext';
import { useWebSocket } from '../contexts/WebSocketContext';

// Convert kebab-case to PascalCase for lucide-react imports
const kebabToPascal = (str) => {
    return str
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
};

// Dynamic icon lookup from lucide-react
const getIcon = (iconName) => {
    if (!iconName) return Box;
    const pascalName = kebabToPascal(iconName);
    return LucideIcons[pascalName] || Box;
};

function Navigation({ sidebarOpen, toggleSidebar, plugins = [] }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { themeName, cycleTheme, themes } = useTheme();
    const { appInfo } = useWebSocket();
    const [expandedSections, setExpandedSections] = useState({});
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [restarting, setRestarting] = useState(false);
    const [confirmRestart, setConfirmRestart] = useState(false);
    const [prevTheme, setPrevTheme] = useState(themeName);

    // Show toast when theme changes
    useEffect(() => {
        if (prevTheme !== themeName) {
            toast.success(`Theme: ${themes[themeName]?.name || themeName}`, { duration: 1500 });
            setPrevTheme(themeName);
        }
    }, [themeName, prevTheme, themes]);

    // Build navigation sections dynamically from plugins
    const navigationSections = useMemo(() => {
        const sections = [
            {
                title: 'Dashboard',
                icon: Home,
                path: '/',
                single: true
            },
            // Divider between Dashboard and content pages
            { divider: true }
        ];

        // Collect all content items to sort alphabetically
        const contentItems = [];

        // Group plugins by their navSection
        const sectionMap = {};

        plugins.forEach(plugin => {
            // Read nav config from nested navConfig object or fallback to defaults
            const navConfig = plugin.navConfig || {};
            const navSection = navConfig.navSection;
            const navTitle = navConfig.navTitle || plugin.name?.replace('void-plugin-', '') || 'Plugin';
            const navIcon = navConfig.navIcon || 'box';

            const navItem = {
                title: navTitle,
                path: plugin.mountPath,
                icon: getIcon(navIcon)
            };

            if (navSection === null || navSection === '' || navSection === undefined) {
                // Standalone nav item (no parent section)
                contentItems.push({
                    ...navItem,
                    single: true
                });
            } else {
                // Group under a section
                const sectionName = navSection;
                if (!sectionMap[sectionName]) {
                    sectionMap[sectionName] = [];
                }
                sectionMap[sectionName].push(navItem);
            }
        });

        // Add grouped sections to content items
        Object.entries(sectionMap).forEach(([sectionName, children]) => {
            // Determine section icon based on name
            let sectionIcon = Box;
            if (sectionName.toLowerCase() === 'clawed') sectionIcon = Cat;
            else if (sectionName.toLowerCase() === 'audio') sectionIcon = Music;
            else if (sectionName.toLowerCase() === 'media') sectionIcon = Video;

            contentItems.push({
                title: sectionName,
                icon: sectionIcon,
                children
            });
        });

        // Add core pages
        contentItems.push({
            title: 'Logs',
            icon: FileText,
            path: '/logs',
            single: true
        });

        contentItems.push({
            title: 'Plugins',
            icon: Box,
            path: '/plugins',
            single: true
        });

        // Sort all content items alphabetically by title
        contentItems.sort((a, b) => a.title.localeCompare(b.title));

        // Add sorted content items to sections
        sections.push(...contentItems);

        return sections;
    }, [plugins]);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Auto-expand sections when on a sub-page
    useEffect(() => {
        const newExpandedSections = {};

        navigationSections.forEach(section => {
            if (section.children) {
                const isChildActive = section.children.some(child =>
                    location.pathname === child.path || location.pathname.startsWith(child.path + '/')
                );
                if (isChildActive) {
                    newExpandedSections[section.title] = true;
                }
            }
        });

        setExpandedSections(prev => ({ ...prev, ...newExpandedSections }));
    }, [location.pathname, plugins]);

    const toggleSection = (title) => {
        setExpandedSections(prev => ({
            ...prev,
            [title]: !prev[title]
        }));
    };

    const isActive = (path) => {
        return location.pathname === path;
    };

    const isSectionActive = (section) => {
        if (section.single && section.path) {
            return location.pathname === section.path;
        }
        if (section.children) {
            return section.children.some(child => location.pathname === child.path);
        }
        return false;
    };

    const handleNavigation = (path) => {
        navigate(path);
        // On mobile, close sidebar after navigation
        if (window.innerWidth < 768) {
            toggleSidebar();
        }
    };

    const handleRestart = async () => {
        setRestarting(true);
        setConfirmRestart(false);
        toast.loading('Restarting application...');

        // Mock restart
        setTimeout(() => {
            window.location.reload();
        }, 2000);
    };

    return (
        <>
            {/* Sidebar */}
            <div
                data-testid="nav-sidebar"
                className={`fixed left-0 transition-all duration-300 border-r border-border ${isMobile
                    ? (sidebarOpen ? 'translate-x-0 z-50' : '-translate-x-full z-40')
                    : (sidebarOpen ? 'translate-x-0' : 'translate-x-0')
                    }`}
                style={{
                    top: isMobile ? '56px' : '0', // Start below header on mobile
                    height: isMobile ? 'calc(100% - 56px)' : '100%', // Adjust height on mobile
                    width: sidebarOpen ? '250px' : (isMobile ? '250px' : '60px'),
                    backgroundColor: 'var(--color-surface-solid)', // Solid opaque background for sidebar
                }}
            >
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div
                        className="p-4 border-b border-border flex items-center justify-between"
                        style={{
                            display: isMobile ? 'none' : 'flex', // Hide on mobile since we have mobile header
                        }}
                    >
                        <h1
                            className={`font-bold flex items-center gap-2 text-primary ${sidebarOpen ? 'text-xl' : 'text-sm'}`}
                            style={{
                                display: sidebarOpen ? 'flex' : 'none',
                            }}
                        >
                            <span style={{ textShadow: 'none' }}>🐈‍⬛</span> @void:~
                        </h1>
                        {!sidebarOpen && !isMobile && (
                            <div className="text-primary text-2xl" style={{ textShadow: 'none' }}>🐈‍⬛</div>
                        )}
                        {/* Desktop toggle button */}
                        {!isMobile && (
                            <button
                                data-testid="nav-sidebar-toggle"
                                onClick={toggleSidebar}
                                className="p-2 rounded hover:bg-opacity-10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center text-text-primary"
                            >
                                {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
                            </button>
                        )}
                    </div>

                    {/* Navigation sections */}
                    <nav className="flex-1 overflow-y-auto p-4">
                        {navigationSections.map((section, index) => (
                            section.divider ? (
                                <div key={`divider-${index}`} className="my-3 border-t border-border" />
                            ) : (
                            <div key={section.title} className="mb-2">
                                {section.single ? (
                                    // Single item navigation
                                    <button
                                        data-testid={`nav-link-${section.title.toLowerCase().replace(/\s+/g, '-')}`}
                                        onClick={() => handleNavigation(section.path)}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors min-h-[44px] ${isActive(section.path)
                                            ? 'bg-primary/10 text-primary'
                                            : 'hover:bg-border/50 text-text-primary'
                                            }`}
                                        style={{
                                            justifyContent: sidebarOpen ? 'flex-start' : 'center',
                                        }}
                                        title={!sidebarOpen ? section.title : undefined}
                                    >
                                        <section.icon size={20} className="flex-shrink-0" />
                                        {sidebarOpen && <span>{section.title}</span>}
                                    </button>
                                ) : (
                                    // Collapsible section
                                    <>
                                        <button
                                            data-testid={`nav-section-${section.title.toLowerCase().replace(/\s+/g, '-')}`}
                                            onClick={() => {
                                                if (sidebarOpen) {
                                                    toggleSection(section.title);
                                                } else if (section.children && section.children.length > 0) {
                                                    // When collapsed, navigate to first child
                                                    handleNavigation(section.children[0].path);
                                                }
                                            }}
                                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors min-h-[44px] ${isSectionActive(section)
                                                ? 'bg-primary/10 text-primary'
                                                : 'hover:bg-border/50 text-text-primary'
                                                }`}
                                            style={{
                                                justifyContent: sidebarOpen ? 'space-between' : 'center',
                                            }}
                                            title={!sidebarOpen ? section.title : undefined}
                                        >
                                            <div className={`flex items-center ${sidebarOpen ? 'gap-3' : ''}`}>
                                                <section.icon size={20} className="flex-shrink-0" />
                                                {sidebarOpen && <span>{section.title}</span>}
                                            </div>
                                            {sidebarOpen && (
                                                expandedSections[section.title] ? (
                                                    <ChevronDown size={16} />
                                                ) : (
                                                    <ChevronRight size={16} />
                                                )
                                            )}
                                        </button>

                                        {/* Children items */}
                                        {expandedSections[section.title] && sidebarOpen && (
                                            <div className="ml-4 mt-1">
                                                {section.children.map((child) => (
                                                    <button
                                                        key={child.path}
                                                        data-testid={`nav-link-${child.path.replace(/\//g, '-').substring(1)}`}
                                                        onClick={() => handleNavigation(child.path)}
                                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm min-h-[44px] ${isActive(child.path)
                                                            ? 'bg-primary/10 text-primary'
                                                            : 'hover:bg-border/50 text-secondary'
                                                            }`}
                                                    >
                                                        {child.icon && <child.icon size={16} />}
                                                        <span>{child.title}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                            )
                        ))}
                    </nav>

                    {/* Footer */}
                    <div className="p-4 border-t border-border text-sm text-secondary">
                        <div className="flex items-center justify-between">
                            {sidebarOpen && <span>v{appInfo.version || '...'}</span>}
                            <div className="flex items-center gap-1">
                                <button
                                    data-testid="nav-theme-button"
                                    onClick={() => {
                                        cycleTheme();
                                    }}
                                    className="p-2 rounded-lg transition-colors hover:bg-opacity-10 min-w-[44px] min-h-[44px] flex items-center justify-center bg-transparent text-text-primary"
                                    title={`Theme: ${themeName} (click to cycle)`}
                                >
                                    <Palette size={18} />
                                </button>
                                <button
                                    data-testid="nav-restart-button"
                                    onClick={() => setConfirmRestart(true)}
                                    disabled={restarting}
                                    className={`p-2 rounded-lg transition-colors hover:bg-opacity-10 min-w-[44px] min-h-[44px] flex items-center justify-center bg-transparent text-text-primary ${restarting ? 'opacity-50' : ''}`}
                                    title="Restart application"
                                >
                                    <RotateCw size={18} className={restarting ? 'animate-spin' : ''} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Overlay for mobile */}
            {sidebarOpen && isMobile && (
                <div
                    data-testid="nav-mobile-overlay"
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={toggleSidebar}
                    style={{
                        top: '56px', // Start below mobile header
                    }}
                />
            )}

            {/* Restart Confirmation Modal */}
            {confirmRestart && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[100]" onClick={() => setConfirmRestart(false)}>
                    <div
                        data-testid="nav-restart-modal"
                        className="rounded-lg max-w-sm w-full p-6 shadow-xl bg-surface border border-border"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start gap-3 mb-4">
                            <div className="text-2xl">⚠️</div>
                            <div className="flex-1">
                                <h3 className="font-semibold mb-2 text-text-primary">
                                    Restart Application?
                                </h3>
                                <p className="text-sm text-secondary">
                                    This will restart the server and reload the page. It will take approximately 10 seconds.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                data-testid="nav-restart-cancel"
                                onClick={() => setConfirmRestart(false)}
                                className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors min-h-[44px] btn-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                data-testid="nav-restart-confirm"
                                onClick={handleRestart}
                                className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors min-h-[44px] btn-primary"
                            >
                                Restart
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default Navigation;
