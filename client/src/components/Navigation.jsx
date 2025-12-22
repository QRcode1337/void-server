import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Box,
  Cat,
  Music,
  Video,
  FileText,
  Settings,
  MessageSquare,
  FileCode,
  Braces,
  Brain,
  Globe,
  Network,
  ArrowUpCircle,
  RefreshCw,
  HardDrive,
  Copy,
  X,
  Terminal,
  Check,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import toast from 'react-hot-toast';
import { useWebSocket } from '../contexts/WebSocketContext';

// Convert kebab-case to PascalCase for lucide-react imports
const kebabToPascal = str => {
  return str
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
};

// Dynamic icon lookup from lucide-react
const getIcon = iconName => {
  if (!iconName) return Box;
  const pascalName = kebabToPascal(iconName);
  return LucideIcons[pascalName] || Box;
};

function Navigation({ sidebarOpen, toggleSidebar, plugins = [] }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { appInfo, setLogsExpanded } = useWebSocket();
  const [expandedSections, setExpandedSections] = useState({});
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [dockerModal, setDockerModal] = useState({ show: false, command: '' });
  const [copied, setCopied] = useState(false);

  // Poll for server to come back after update
  const pollForRestart = () => {
    const poll = setInterval(async () => {
      const healthRes = await fetch('/api/health');
      if (healthRes.ok) {
        clearInterval(poll);
        window.location.reload();
      }
    }, 2000);
  };

  // Handle update action (auto-detects Docker vs native)
  const handleUpdate = useCallback(async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    setLogsExpanded(true); // Expand logs to show update progress

    // Dismiss update available toast first
    toast.dismiss('update-available');
    toast.loading('Updating...', { id: 'update-progress' });

    // Use unified update endpoint (auto-detects Docker vs native)
    const res = await fetch('/api/version/update', { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      toast.success('Update started! Server will restart shortly.', {
        id: 'update-progress',
      });
      // Poll for server to come back
      pollForRestart();
      return;
    }

    // Update failed - check if it's a Docker issue
    toast.dismiss('update-progress');

    if (data.error && data.error.includes('Watchtower')) {
      // Docker mode but Watchtower unavailable - show manual command modal
      const command = 'docker compose down && docker compose pull && docker compose up -d';
      setDockerModal({
        show: true,
        command,
        watchtowerError: data.error,
      });
    } else {
      // Other error
      toast.error(`Update failed: ${data.error || 'Unknown error'}`);
    }
    setIsUpdating(false);
  }, [isUpdating, setLogsExpanded]);

  // Check for updates periodically
  useEffect(() => {
    const checkForUpdate = async () => {
      // Skip if already updating
      if (isUpdating) return;

      const res = await fetch('/api/version/check');
      const data = await res.json();
      if (data.success && data.updateAvailable) {
        setUpdateInfo(data);
        // Show persistent toast notification (only if not already shown)
        toast(
          t => (
            <div className="flex items-center gap-3">
              <ArrowUpCircle className="text-primary flex-shrink-0" size={20} />
              <div className="flex-1">
                <div className="font-medium">Update Available</div>
                <div className="text-sm text-secondary">
                  v{data.currentVersion} → v{data.latestVersion}
                </div>
              </div>
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  handleUpdate();
                }}
                className="px-3 py-1 bg-[var(--color-primary)] text-background rounded text-sm hover:bg-[var(--color-primary)]/80"
              >
                Update
              </button>
              <button
                onClick={() => toast.dismiss(t.id)}
                className="text-secondary hover:text-text-primary"
              >
                ✕
              </button>
            </div>
          ),
          { duration: Infinity, id: 'update-available' }
        );
      }
    };

    // Check on mount (unless already updating)
    if (!isUpdating) {
      checkForUpdate();
    }

    // Check every 30 minutes
    const interval = setInterval(checkForUpdate, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [handleUpdate, isUpdating]);

  // Copy Docker command to clipboard
  const copyDockerCommand = async () => {
    await navigator.clipboard.writeText(dockerModal.command);
    setCopied(true);
    toast.success('Command copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  // Build navigation sections dynamically from plugins
  const navigationSections = useMemo(() => {
    const sections = [
      {
        title: 'Dashboard',
        icon: Home,
        path: '/',
        single: true,
      },
      // Divider between Dashboard and content pages
      { divider: true },
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
        icon: getIcon(navIcon),
      };

      if (navSection === null || navSection === '' || navSection === undefined) {
        // Standalone nav item (no parent section)
        contentItems.push({
          ...navItem,
          single: true,
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
        children,
      });
    });

    // Add core pages
    contentItems.push({
      title: 'Chat',
      icon: MessageSquare,
      path: '/chat',
      single: true,
    });

    contentItems.push({
      title: 'Logs',
      icon: FileText,
      path: '/logs',
      single: true,
    });

    contentItems.push({
      title: 'Memories',
      icon: Brain,
      path: '/memories',
      single: true,
    });

    contentItems.push({
      title: 'Browsers',
      icon: Globe,
      path: '/browsers',
      single: true,
    });

    contentItems.push({
      title: 'Federation',
      icon: Network,
      path: '/federation',
      single: true,
    });

    contentItems.push({
      title: 'IPFS',
      icon: HardDrive,
      path: '/ipfs',
      single: true,
    });

    contentItems.push({
      title: 'Plugins',
      icon: Box,
      path: '/plugins',
      single: true,
    });

    contentItems.push({
      title: 'Prompts',
      icon: FileCode,
      children: [
        { title: 'Templates', icon: FileCode, path: '/prompts/templates' },
        { title: 'Variables', icon: Braces, path: '/prompts/variables' },
      ],
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
        const isChildActive = section.children.some(
          child =>
            location.pathname === child.path || location.pathname.startsWith(child.path + '/')
        );
        if (isChildActive) {
          newExpandedSections[section.title] = true;
        }
      }
    });

    setExpandedSections(prev => ({ ...prev, ...newExpandedSections }));
  }, [location.pathname, plugins, navigationSections]);

  const toggleSection = title => {
    setExpandedSections(prev => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  const isActive = path => {
    return location.pathname === path;
  };

  const isSectionActive = section => {
    if (section.single && section.path) {
      return location.pathname === section.path;
    }
    if (section.children) {
      return section.children.some(child => location.pathname === child.path);
    }
    return false;
  };

  const handleNavigation = path => {
    navigate(path);
    // On mobile, close sidebar after navigation
    if (window.innerWidth < 768) {
      toggleSidebar();
    }
  };

  return (
    <>
      {/* Sidebar */}
      <div
        data-testid="nav-sidebar"
        className={`fixed left-0 transition-all duration-300 border-r border-border ${
          isMobile
            ? sidebarOpen
              ? 'translate-x-0 z-50'
              : '-translate-x-full z-40'
            : sidebarOpen
              ? 'translate-x-0'
              : 'translate-x-0'
        }`}
        style={{
          top: isMobile ? '56px' : '0', // Start below header on mobile
          height: isMobile ? 'calc(100% - 56px)' : '100%', // Adjust height on mobile
          width: sidebarOpen ? '250px' : isMobile ? '250px' : '60px',
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
              <button
                onClick={toggleSidebar}
                className="text-primary text-2xl hover:scale-110 transition-transform cursor-pointer"
                style={{ textShadow: 'none' }}
                title="Expand sidebar"
              >
                🐈‍⬛
              </button>
            )}
            {/* Desktop toggle button */}
            {!isMobile && sidebarOpen && (
              <button
                data-testid="nav-sidebar-toggle"
                onClick={toggleSidebar}
                className="p-2 rounded hover:bg-opacity-10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center text-text-primary"
              >
                <ChevronLeft size={20} />
              </button>
            )}
          </div>

          {/* Navigation sections */}
          <nav className="flex-1 overflow-y-auto p-4">
            {navigationSections.map((section, index) =>
              section.divider ? (
                <div key={`divider-${index}`} className="my-3 border-t border-border" />
              ) : (
                <div key={section.title} className="mb-2">
                  {section.single ? (
                    // Single item navigation
                    <button
                      data-testid={`nav-link-${section.title.toLowerCase().replace(/\s+/g, '-')}`}
                      onClick={() => handleNavigation(section.path)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors min-h-[44px] ${
                        isActive(section.path)
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
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors min-h-[44px] ${
                          isSectionActive(section)
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
                        {sidebarOpen &&
                          (expandedSections[section.title] ? (
                            <ChevronDown size={16} />
                          ) : (
                            <ChevronRight size={16} />
                          ))}
                      </button>

                      {/* Children items */}
                      {expandedSections[section.title] && sidebarOpen && (
                        <div className="ml-4 mt-1">
                          {section.children.map(child => (
                            <button
                              key={child.path}
                              data-testid={`nav-link-${child.path.replace(/\//g, '-').substring(1)}`}
                              onClick={() => handleNavigation(child.path)}
                              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm min-h-[44px] ${
                                isActive(child.path)
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
            )}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-border text-sm text-secondary">
            <div
              className={`flex items-center ${sidebarOpen ? 'justify-between' : 'justify-center'}`}
            >
              {sidebarOpen && (
                <div className="flex items-center gap-2">
                  <span>v{appInfo.version || '...'}</span>
                  {updateInfo && (
                    <button
                      onClick={handleUpdate}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
                      title={`Update to v${updateInfo.latestVersion}`}
                      disabled={isUpdating}
                    >
                      {isUpdating ? (
                        <RefreshCw size={12} className="animate-spin" />
                      ) : (
                        <ArrowUpCircle size={12} />
                      )}
                      <span>v{updateInfo.latestVersion}</span>
                    </button>
                  )}
                </div>
              )}
              <button
                data-testid="nav-settings-button"
                onClick={() => handleNavigation('/settings')}
                className={`p-2 rounded-lg transition-colors hover:bg-opacity-10 min-w-[44px] min-h-[44px] flex items-center justify-center bg-transparent ${isActive('/settings') ? 'text-primary' : 'text-text-primary'}`}
                title="Settings"
              >
                <Settings size={18} />
              </button>
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

      {/* Docker Update Modal */}
      {dockerModal.show && (
        <div
          className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4"
          onClick={() => setDockerModal({ show: false, command: '' })}
        >
          <div
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg w-full max-w-lg shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                  <Terminal size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                    Docker Update Required
                  </h2>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Run this command on your host machine
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDockerModal({ show: false, command: '' })}
                className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 space-y-4">
              {dockerModal.watchtowerError && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-sm text-yellow-500">
                    <strong>Automatic update unavailable:</strong> {dockerModal.watchtowerError}
                  </p>
                  <p className="text-xs text-yellow-500/70 mt-1">
                    Tip: Enable Watchtower in docker-compose.yml for automatic updates.
                  </p>
                </div>
              )}

              <p className="text-sm text-[var(--color-text-secondary)]">
                Run the following command on your host machine to update:
              </p>

              {/* Command Box */}
              <div className="relative">
                <pre className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-4 pr-12 font-mono text-sm text-[var(--color-text-primary)] overflow-x-auto whitespace-pre-wrap break-all">
                  {dockerModal.command}
                </pre>
                <button
                  onClick={copyDockerCommand}
                  className={`absolute top-2 right-2 p-2 rounded transition-colors ${
                    copied
                      ? 'bg-green-500/20 text-green-500'
                      : 'bg-[var(--color-surface)] hover:bg-[var(--color-border)] text-[var(--color-text-secondary)]'
                  }`}
                  title="Copy to clipboard"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>

              <p className="text-xs text-[var(--color-text-tertiary)]">
                This will stop the container, pull the latest image, and restart with the new
                version.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[var(--color-border)] flex justify-end gap-3">
              <button
                onClick={() => setDockerModal({ show: false, command: '' })}
                className="btn btn-secondary text-sm"
              >
                Close
              </button>
              <button
                onClick={copyDockerCommand}
                className="btn btn-primary text-sm flex items-center gap-2"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy Command'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Navigation;
