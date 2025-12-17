import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useLocation, useOutletContext, Routes, Route } from 'react-router-dom';
import { Box, RefreshCw, AlertTriangle, Terminal, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { pluginModules } from 'virtual:plugins';

// Loading spinner component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-64">
    <RefreshCw className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
  </div>
);

// Error boundary for plugin components
class PluginErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <h3 className="text-red-400 font-semibold mb-2">Plugin Error</h3>
            <p className="text-red-300 text-sm font-mono">
              {this.state.error?.message || 'Unknown error'}
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const PluginViewer = ({ plugin: propPlugin }) => {
  const location = useLocation();
  const { plugins } = useOutletContext() || { plugins: [] };
  const [pluginComponent, setPluginComponent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [moduleNotFound, setModuleNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  // Use prop plugin or find from context based on path
  const plugin = propPlugin || plugins.find(p => location.pathname.startsWith(p.mountPath));

  // Get the sub-path within the plugin's mount
  const subPath = plugin ? location.pathname.slice(plugin.mountPath.length) || '' : '';

  const copyCommand = async () => {
    await navigator.clipboard.writeText('docker compose down && docker compose up -d --build');
    setCopied(true);
    toast.success('Command copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (!plugin) {
      setLoading(false);
      return;
    }

    // Get the plugin module from the virtual module
    const pluginModule = pluginModules[plugin.name];

    if (!pluginModule) {
      console.warn(`Plugin module not found for: ${plugin.name}. Client rebuild may be required.`);
      setModuleNotFound(true);
      setLoading(false);
      return;
    }

    setModuleNotFound(false);

    // Find the matching route from the plugin's routes
    const routes = pluginModule.routes || [];
    const matchingRoute =
      routes.find(r => {
        const routePath = r.path || '';
        return subPath === routePath || subPath === '/' + routePath;
      }) || routes[0];

    if (matchingRoute && pluginModule.componentMap) {
      const componentName = matchingRoute.component;
      const loadComponent = pluginModule.componentMap[componentName];

      if (loadComponent) {
        // Create a lazy component
        const LazyComponent = lazy(loadComponent);
        setPluginComponent(() => LazyComponent);
      } else {
        // Try direct export
        const DirectComponent = pluginModule[componentName];
        if (DirectComponent) {
          setPluginComponent(() => DirectComponent);
        }
      }
    } else {
      // If no routes defined, check for default export or first named export
      const moduleKeys = Object.keys(pluginModule).filter(
        k => !['routes', 'defaultNav', 'componentMap'].includes(k)
      );
      if (moduleKeys.length > 0) {
        const DefaultComponent = pluginModule[moduleKeys[0]];
        if (typeof DefaultComponent === 'function') {
          setPluginComponent(() => DefaultComponent);
        }
      }
    }

    setLoading(false);
  }, [plugin, subPath]);

  if (!plugin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-[var(--color-text-secondary)]">
        <Box className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-lg">No plugin found for this path</p>
        <p className="text-sm mt-2 font-mono">{location.pathname}</p>
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  // Plugin module not found in client bundle - needs rebuild
  if (moduleNotFound) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-lg bg-amber-500/10">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
              Client Rebuild Required
            </h2>
            <p className="text-[var(--color-text-secondary)]">
              {plugin.navConfig?.navTitle || plugin.name}
            </p>
          </div>
        </div>

        <div className="card space-y-4">
          <p className="text-[var(--color-text-secondary)]">
            This plugin was installed after the client was built. The server has loaded the plugin,
            but the browser needs an updated client bundle to display its interface.
          </p>

          <div className="bg-[var(--color-background)] rounded-lg p-4 border border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-3">
              <Terminal className="w-4 h-4 text-[var(--color-primary)]" />
              <span className="text-sm font-medium text-[var(--color-text-primary)]">
                For Docker installations, run:
              </span>
            </div>
            <div className="relative">
              <pre className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded p-3 pr-12 font-mono text-sm text-[var(--color-text-primary)] overflow-x-auto">
                docker compose down && docker compose up -d --build
              </pre>
              <button
                onClick={copyCommand}
                className={`absolute top-2 right-2 p-2 rounded transition-colors ${
                  copied
                    ? 'bg-green-500/20 text-green-500'
                    : 'bg-[var(--color-background)] hover:bg-[var(--color-border)] text-[var(--color-text-secondary)]'
                }`}
                title="Copy to clipboard"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          <p className="text-sm text-[var(--color-text-tertiary)]">
            For local development, restart the Vite dev server to pick up new plugins.
          </p>
        </div>
      </div>
    );
  }

  if (!pluginComponent) {
    // Plugin exists but has no client component
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-4">
          {plugin.navConfig?.navTitle || plugin.name}
        </h2>
        <div className="bg-[var(--color-surface)] rounded-lg p-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-[var(--color-text-secondary)]">Mount Path</span>
            <code className="text-[var(--color-primary)]">{plugin.mountPath}</code>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-text-secondary)]">Status</span>
            <span className="text-green-400">Active</span>
          </div>
          <p className="text-[var(--color-text-secondary)] text-sm mt-4">
            This plugin is active but has no client-side interface.
          </p>
        </div>
      </div>
    );
  }

  const PluginComponent = pluginComponent;

  return (
    <PluginErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <PluginComponent />
      </Suspense>
    </PluginErrorBoundary>
  );
};

export default PluginViewer;
