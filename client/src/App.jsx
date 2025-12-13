import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import PluginManager from './pages/PluginManager';
import LogsPage from './pages/LogsPage';
import PluginViewer from './pages/PluginViewer';

function App() {
  const [plugins, setPlugins] = useState([]);
  const [pluginsLoaded, setPluginsLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/plugins')
      .then(res => res.json())
      .then(data => {
        // API returns { installed, available, loadedPlugins }
        const enabledPlugins = (data.installed || []).filter(p => p.enabled !== false);
        setPlugins(enabledPlugins);
        setPluginsLoaded(true);
      })
      .catch(err => {
        console.error('Failed to load plugins:', err);
        setPluginsLoaded(true);
      });
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="logs" element={<LogsPage />} />
        <Route path="plugins" element={<PluginManager />} />

        {/* Dynamic plugin routes - all handled by PluginViewer */}
        {pluginsLoaded && plugins.map(plugin => (
          <Route
            key={plugin.name}
            path={`${plugin.mountPath.replace(/^\//, '')}/*`}
            element={<PluginViewer plugin={plugin} />}
          />
        ))}

        {/* Loading state */}
        {!pluginsLoaded && (
          <Route path="*" element={
            <div className="flex items-center justify-center h-64">
              <div className="text-[var(--color-text-secondary)]">Loading...</div>
            </div>
          } />
        )}

        {/* Catch-all for unmatched routes */}
        {pluginsLoaded && <Route path="*" element={<PluginViewer />} />}
      </Route>
    </Routes>
  );
}

export default App;
