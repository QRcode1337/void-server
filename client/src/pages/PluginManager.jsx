import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Settings,
  Box,
  X,
  Save,
  RotateCw,
  Download,
  Trash2,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
  Package,
  PackagePlus,
  Link as LinkIcon,
  Hammer,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import toast from 'react-hot-toast';
import IconPicker from '../components/IconPicker';
import { useWebSocket } from '../contexts/WebSocketContext';

// Convert kebab-case to PascalCase for lucide-react imports
const kebabToPascal = str => {
  return str
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
};

// Get icon component dynamically
const getPluginIcon = iconName => {
  if (!iconName) return Box;
  const pascalName = kebabToPascal(iconName);
  return LucideIcons[pascalName] || Box;
};

const SECTION_PRESETS = [
  { value: '', label: 'Standalone (no parent section)' },
  { value: 'Plugins', label: 'Plugins' },
  { value: 'Clawed', label: 'Clawed' },
  { value: 'Audio', label: 'Audio' },
  { value: 'Media', label: 'Media' },
  { value: 'Tools', label: 'Tools' },
];

const PluginManager = () => {
  const { plugins: _plugins, setPlugins } = useOutletContext() || {
    plugins: [],
    setPlugins: () => {},
  };
  void _plugins; // Used by parent context
  const { on, off } = useWebSocket();

  // Plugin data state
  const [installedPlugins, setInstalledPlugins] = useState([]);
  const [availablePlugins, setAvailablePlugins] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [activeTab, setActiveTab] = useState('installed');
  const [pendingChanges, setPendingChanges] = useState([]);
  const [rebuilding, setRebuilding] = useState(null); // Plugin name being rebuilt

  // Modal states
  const [editingPlugin, setEditingPlugin] = useState(null);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [customSection, setCustomSection] = useState('');

  const [showInstallUrl, setShowInstallUrl] = useState(false);
  const [installUrl, setInstallUrl] = useState('');
  const [installing, setInstalling] = useState(null);

  const [uninstallingPlugin, setUninstallingPlugin] = useState(null);
  const [togglingPlugin, setTogglingPlugin] = useState(null);
  const [restarting, setRestarting] = useState(false);

  // Listen for rebuild WebSocket events
  useEffect(() => {
    const handleRebuildComplete = ({ plugin }) => {
      setRebuilding(null);
      setPendingChanges(prev => prev.filter(c => c.plugin !== plugin));
      toast.dismiss('rebuild');
      toast.success(`Plugin "${plugin}" is ready! Reloading...`, { duration: 3000 });
      setTimeout(() => window.location.reload(), 1500);
    };

    const handleRebuildFailed = ({ plugin, error }) => {
      setRebuilding(null);
      toast.dismiss('rebuild');
      toast.error(`Client rebuild failed: ${error}. Restart required.`, { duration: 8000 });
      // Add to pending changes so user can manually restart
      setPendingChanges(prev => [...prev, { type: 'install', plugin }]);
    };

    on('plugin:rebuild:complete', handleRebuildComplete);
    on('plugin:rebuild:failed', handleRebuildFailed);

    return () => {
      off('plugin:rebuild:complete', handleRebuildComplete);
      off('plugin:rebuild:failed', handleRebuildFailed);
    };
  }, [on, off]);

  // Handle server restart
  const handleRestart = async () => {
    setRestarting(true);
    toast.loading('Restarting server...', { id: 'restart' });

    await fetch('/api/server/restart', { method: 'POST' });

    // Wait for server to come back up
    let attempts = 0;
    const maxAttempts = 30;
    const checkServer = async () => {
      attempts++;
      const response = await fetch('/api/plugins').catch(() => null);
      if (response?.ok) {
        toast.success('Server restarted. Reloading...', { id: 'restart' });
        // Full page reload to reinitialize plugins and navigation
        setTimeout(() => window.location.reload(), 500);
      } else if (attempts < maxAttempts) {
        setTimeout(checkServer, 1000);
      } else {
        toast.error('Server restart timed out. Please refresh the page.', { id: 'restart' });
        setRestarting(false);
      }
    };

    // Start checking after a short delay
    setTimeout(checkServer, 2000);
  };

  // Fetch plugins data
  const fetchPlugins = useCallback(async () => {
    setLoading(true);
    const response = await fetch('/api/plugins');
    if (response.ok) {
      const data = await response.json();
      setInstalledPlugins(data.installed || []);
      setAvailablePlugins(data.available || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPlugins();
  }, [fetchPlugins]);

  // Handle enable/disable toggle
  const handleToggle = async plugin => {
    setTogglingPlugin(plugin.name);
    const newEnabled = !plugin.enabled;

    const response = await fetch(`/api/plugins/${plugin.name}/enable`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: newEnabled }),
    });

    const result = await response.json();
    setTogglingPlugin(null);

    if (result.success) {
      setInstalledPlugins(prev =>
        prev.map(p => (p.name === plugin.name ? { ...p, enabled: newEnabled } : p))
      );

      // In Docker, client rebuilds automatically
      if (result.rebuilding) {
        setRebuilding(plugin.name);
        toast.loading('Rebuilding client bundle...', { id: 'rebuild', duration: 60000 });
      } else if (result.requiresRestart) {
        setPendingChanges(prev => [
          ...prev,
          { type: 'toggle', plugin: plugin.name, action: newEnabled ? 'enable' : 'disable' },
        ]);
        toast.success(result.message, { duration: 4000 });
      } else {
        toast.success(result.message, { duration: 4000 });
      }
    } else {
      toast.error(result.error || 'Failed to toggle plugin');
    }
  };

  // Handle install from manifest
  const handleInstall = async plugin => {
    setInstalling(plugin.name);

    const response = await fetch('/api/plugins/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plugin: plugin.name }),
    });

    const result = await response.json();
    setInstalling(null);

    if (result.success) {
      // In Docker, client rebuilds automatically
      if (result.rebuilding) {
        setRebuilding(plugin.name);
        toast.loading('Rebuilding client bundle...', { id: 'rebuild', duration: 60000 });
      } else {
        setPendingChanges(prev => [...prev, { type: 'install', plugin: plugin.name }]);
        toast.success(result.message, { duration: 5000 });
      }
      fetchPlugins();
    } else {
      toast.error(result.error || 'Failed to install plugin');
    }
  };

  // Handle install from URL
  const handleInstallFromUrl = async () => {
    if (!installUrl.trim()) return;

    setInstalling('url');

    const response = await fetch('/api/plugins/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gitUrl: installUrl.trim() }),
    });

    const result = await response.json();
    setInstalling(null);

    if (result.success) {
      setShowInstallUrl(false);
      setInstallUrl('');
      // In Docker, client rebuilds automatically
      if (result.rebuilding) {
        setRebuilding(result.plugin);
        toast.loading('Rebuilding client bundle...', { id: 'rebuild', duration: 60000 });
      } else {
        setPendingChanges(prev => [...prev, { type: 'install', plugin: result.plugin }]);
        toast.success(result.message, { duration: 5000 });
      }
      fetchPlugins();
    } else {
      toast.error(result.error || 'Failed to install plugin');
    }
  };

  // Handle uninstall
  const handleUninstall = async plugin => {
    const response = await fetch(`/api/plugins/${plugin.name}`, {
      method: 'DELETE',
    });

    const result = await response.json();
    setUninstallingPlugin(null);

    if (result.success) {
      setInstalledPlugins(prev => prev.filter(p => p.name !== plugin.name));
      setPendingChanges(prev => [...prev, { type: 'uninstall', plugin: plugin.name }]);
      toast.success(result.message, { duration: 5000 });
      fetchPlugins();
    } else {
      toast.error(result.error || 'Failed to uninstall plugin');
    }
  };

  // Configuration modal handlers
  const openEditModal = plugin => {
    setEditingPlugin(plugin);
    setFormData({
      mountPath: plugin.mountPath,
      navSection: plugin.navConfig?.navSection || '',
      navTitle: plugin.navConfig?.navTitle || '',
      navIcon: plugin.navConfig?.navIcon || 'box',
    });
    const isPreset = SECTION_PRESETS.some(p => p.value === (plugin.navConfig?.navSection || ''));
    setCustomSection(isPreset ? '' : plugin.navConfig?.navSection || '');
  };

  const closeEditModal = () => {
    setEditingPlugin(null);
    setFormData({});
    setCustomSection('');
  };

  const handleSave = async () => {
    setSaving(true);
    const navSection = customSection || formData.navSection;

    const response = await fetch(`/api/plugins/${editingPlugin.name}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mountPath: formData.mountPath,
        navSection: navSection === '' ? null : navSection,
        navTitle: formData.navTitle,
        navIcon: formData.navIcon,
      }),
    });

    const result = await response.json();
    setSaving(false);

    if (result.success) {
      setPlugins(prev =>
        prev.map(p =>
          p.name === editingPlugin.name
            ? {
                ...p,
                navSection: navSection === '' ? null : navSection,
                navTitle: formData.navTitle,
                navIcon: formData.navIcon,
              }
            : p
        )
      );

      if (result.requiresRestart) {
        setPendingChanges(prev => [...prev, { type: 'config', plugin: editingPlugin.name }]);
        toast.success(result.message, { duration: 5000 });
      } else {
        toast.success('Plugin configuration saved');
      }
      closeEditModal();
      fetchPlugins();
    } else {
      toast.error(result.error || 'Failed to save configuration');
    }
  };

  const handleSectionChange = e => {
    const value = e.target.value;
    if (value === '__custom__') {
      setCustomSection('');
      setFormData(prev => ({ ...prev, navSection: '' }));
    } else {
      setCustomSection('');
      setFormData(prev => ({ ...prev, navSection: value }));
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Settings className="w-8 h-8 text-[var(--color-primary)]" />
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Plugin Manager</h1>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Install, configure, and manage plugins
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowInstallUrl(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <PackagePlus className="w-4 h-4" />
          Install from URL
        </button>
      </div>

      {/* Rebuilding Banner (Docker auto-rebuild) */}
      {rebuilding && (
        <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500 rounded-lg flex items-center gap-3">
          <Hammer className="w-5 h-5 text-blue-500 animate-pulse" />
          <div>
            <p className="font-medium text-blue-500">Rebuilding Client Bundle</p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Building plugin "{rebuilding}" into the client... This may take a minute.
            </p>
          </div>
          <RotateCw className="w-5 h-5 text-blue-500 animate-spin ml-auto" />
        </div>
      )}

      {/* Restart Required Banner */}
      {pendingChanges.length > 0 && !rebuilding && (
        <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <div>
              <p className="font-medium text-amber-500">Restart Required</p>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {pendingChanges.length} change(s) will take effect after restart
              </p>
            </div>
          </div>
          <button
            onClick={handleRestart}
            disabled={restarting}
            className="btn btn-primary flex items-center gap-2"
          >
            <RotateCw className={`w-4 h-4 ${restarting ? 'animate-spin' : ''}`} />
            {restarting ? 'Restarting...' : 'Restart Now'}
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-[var(--color-border)] mb-4">
        <button
          onClick={() => setActiveTab('installed')}
          className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'installed'
              ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          <Package className="w-4 h-4" />
          Installed ({installedPlugins.length})
        </button>
        <button
          onClick={() => setActiveTab('available')}
          className={`px-4 py-2 font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'available'
              ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          <Download className="w-4 h-4" />
          Available ({availablePlugins.length})
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="card text-center py-12">
          <RotateCw className="w-8 h-8 mx-auto mb-4 text-[var(--color-text-secondary)] animate-spin" />
          <p className="text-[var(--color-text-secondary)]">Loading plugins...</p>
        </div>
      )}

      {/* Installed Plugins Tab */}
      {!loading && activeTab === 'installed' && (
        <div className="space-y-4">
          {installedPlugins.length === 0 ? (
            <div className="card text-center py-12">
              <Box className="w-12 h-12 mx-auto mb-4 text-[var(--color-text-secondary)]" />
              <p className="text-[var(--color-text-secondary)]">No plugins installed</p>
              <button onClick={() => setActiveTab('available')} className="btn btn-secondary mt-4">
                Browse Available Plugins
              </button>
            </div>
          ) : (
            installedPlugins.map(plugin => {
              const PluginIcon = getPluginIcon(plugin.navConfig?.navIcon);
              const isDisabled = plugin.enabled === false;

              return (
                <div key={plugin.name} className={`card ${isDisabled ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          isDisabled ? 'bg-[var(--color-border)]' : 'bg-[var(--color-background)]'
                        }`}
                      >
                        <PluginIcon
                          className={`w-6 h-6 ${
                            isDisabled
                              ? 'text-[var(--color-text-secondary)]'
                              : 'text-[var(--color-primary)]'
                          }`}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-[var(--color-text-primary)]">
                            {plugin.navConfig?.navTitle || plugin.name.replace('void-plugin-', '')}
                          </h3>
                          <span
                            className={`badge ${isDisabled ? 'badge-secondary' : 'badge-success'}`}
                          >
                            {isDisabled ? 'disabled' : 'enabled'}
                          </span>
                          {plugin.loaded && <span className="badge badge-info">loaded</span>}
                          <span className="badge badge-secondary text-xs">
                            {plugin.installationType}
                          </span>
                          {plugin.builtIn && (
                            <span className="badge badge-primary text-xs">built-in</span>
                          )}
                        </div>
                        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                          Mount:{' '}
                          <code className="text-[var(--color-primary)]">{plugin.mountPath}</code>
                        </p>
                        {plugin.description && (
                          <p className="text-sm text-[var(--color-text-secondary)] mt-1 max-w-md">
                            {plugin.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Enable/Disable Toggle */}
                      <button
                        onClick={() => handleToggle(plugin)}
                        disabled={togglingPlugin === plugin.name}
                        className={`p-2 rounded-lg transition-colors ${
                          isDisabled
                            ? 'text-[var(--color-text-secondary)] hover:text-green-500'
                            : 'text-green-500 hover:text-[var(--color-text-secondary)]'
                        }`}
                        title={isDisabled ? 'Enable' : 'Disable'}
                      >
                        {togglingPlugin === plugin.name ? (
                          <RotateCw className="w-5 h-5 animate-spin" />
                        ) : isDisabled ? (
                          <ToggleLeft className="w-5 h-5" />
                        ) : (
                          <ToggleRight className="w-5 h-5" />
                        )}
                      </button>

                      {/* Configure */}
                      <button
                        onClick={() => openEditModal(plugin)}
                        className="btn btn-secondary flex items-center gap-2"
                      >
                        <Settings className="w-4 h-4" />
                        Configure
                      </button>

                      {/* Uninstall - hidden for built-in plugins */}
                      {!plugin.builtIn && (
                        <button
                          onClick={() => setUninstallingPlugin(plugin)}
                          className="p-2 text-[var(--color-text-secondary)] hover:text-red-500 transition-colors"
                          title="Uninstall"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Available Plugins Tab */}
      {!loading && activeTab === 'available' && (
        <div className="space-y-4">
          {availablePlugins.length === 0 ? (
            <div className="card text-center py-12">
              <Package className="w-12 h-12 mx-auto mb-4 text-[var(--color-text-secondary)]" />
              <p className="text-[var(--color-text-secondary)]">All plugins are installed</p>
              <p className="text-sm text-[var(--color-text-secondary)] mt-2">
                Or install a plugin from a custom URL using the button above
              </p>
            </div>
          ) : (
            availablePlugins.map(plugin => {
              const PluginIcon = getPluginIcon(plugin.icon);

              return (
                <div
                  key={plugin.name}
                  className="card hover:border-[var(--color-primary)] transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-[var(--color-background)] flex items-center justify-center">
                        <PluginIcon className="w-6 h-6 text-[var(--color-primary)]" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-[var(--color-text-primary)]">
                          {plugin.name.replace('void-plugin-', '')}
                        </h3>
                        <p className="text-sm text-[var(--color-text-secondary)] mt-1 max-w-md">
                          {plugin.description}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          {plugin.category && (
                            <span className="badge badge-secondary">{plugin.category}</span>
                          )}
                          {plugin.author && (
                            <span className="text-xs text-[var(--color-text-secondary)]">
                              by {plugin.author}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleInstall(plugin)}
                      disabled={installing === plugin.name}
                      className="btn btn-primary flex items-center gap-2"
                    >
                      {installing === plugin.name ? (
                        <>
                          <RotateCw className="w-4 h-4 animate-spin" />
                          Installing...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          Install
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Install from URL Modal */}
      {showInstallUrl && (
        <div
          className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4"
          onClick={() => setShowInstallUrl(false)}
        >
          <div
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg w-full max-w-lg"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                <LinkIcon className="w-5 h-5" />
                Install Plugin from URL
              </h2>
              <button
                onClick={() => setShowInstallUrl(false)}
                className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="form-group">
                <label className="form-label">Git Repository URL</label>
                <input
                  type="url"
                  value={installUrl}
                  onChange={e => setInstallUrl(e.target.value)}
                  placeholder="https://github.com/org/void-plugin-example.git"
                  className="form-input"
                  autoFocus
                />
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  Enter the full URL to a git repository containing a void-server plugin
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-[var(--color-border)]">
              <button onClick={() => setShowInstallUrl(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleInstallFromUrl}
                disabled={!installUrl.trim() || installing === 'url'}
                className="btn btn-primary flex items-center gap-2"
              >
                {installing === 'url' ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    Installing...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Install Plugin
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Uninstall Confirmation Modal */}
      {uninstallingPlugin && (
        <div
          className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4"
          onClick={() => setUninstallingPlugin(null)}
        >
          <div
            className="bg-[var(--color-surface)] border border-red-500 rounded-lg w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
                Uninstall {uninstallingPlugin.navConfig?.navTitle || uninstallingPlugin.name}?
              </h2>
              <p className="text-[var(--color-text-secondary)] mb-6">
                This will remove the plugin and require a server restart.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setUninstallingPlugin(null)}
                  className="flex-1 btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUninstall(uninstallingPlugin)}
                  className="flex-1 btn bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Uninstall
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Configuration Modal */}
      {editingPlugin && (
        <div
          className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4"
          onClick={closeEditModal}
        >
          <div
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg w-full max-w-lg"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                Configure {editingPlugin.name}
              </h2>
              <button
                onClick={closeEditModal}
                className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="form-group">
                <label className="form-label">Mount Path</label>
                <input
                  type="text"
                  value={formData.mountPath}
                  onChange={e => setFormData(prev => ({ ...prev, mountPath: e.target.value }))}
                  className="form-input"
                  placeholder="/audio"
                />
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  URL path where the plugin is accessible. Requires restart.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Navigation Title</label>
                <input
                  type="text"
                  value={formData.navTitle}
                  onChange={e => setFormData(prev => ({ ...prev, navTitle: e.target.value }))}
                  className="form-input"
                  placeholder="Audio"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Navigation Section</label>
                <select
                  value={customSection ? '__custom__' : formData.navSection}
                  onChange={handleSectionChange}
                  className="form-input"
                >
                  {SECTION_PRESETS.map(preset => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                  <option value="__custom__">Custom section...</option>
                </select>

                {(customSection !== '' || formData.navSection === '__custom__') && (
                  <input
                    type="text"
                    value={customSection}
                    onChange={e => setCustomSection(e.target.value)}
                    className="form-input mt-2"
                    placeholder="Enter custom section name"
                    autoFocus
                  />
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Navigation Icon</label>
                <IconPicker
                  value={formData.navIcon}
                  onChange={iconValue => setFormData(prev => ({ ...prev, navIcon: iconValue }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-[var(--color-border)]">
              <button onClick={closeEditModal} className="btn btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn btn-primary flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Configuration
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PluginManager;
