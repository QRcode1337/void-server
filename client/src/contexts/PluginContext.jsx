import React, { createContext, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * PluginContext provides basePath-aware navigation and routing utilities
 * for plugin components that need to work with dynamic mount paths.
 */
const PluginContext = createContext({
  basePath: '',
  navigate: () => {},
  location: null,
  buildPath: path => path,
});

export const usePlugin = () => useContext(PluginContext);

/**
 * PluginProvider wraps plugin components to provide basePath-aware utilities
 *
 * @param {string} basePath - The mount path for this plugin (e.g., '/audio')
 * @param {ReactNode} children - Plugin component tree
 */
export function PluginProvider({ basePath = '', children }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Build a full path from a relative plugin path
  const buildPath = relativePath => {
    if (!relativePath) return basePath;
    if (relativePath.startsWith('/')) {
      // Absolute path - check if it starts with basePath
      if (relativePath.startsWith(basePath)) {
        return relativePath;
      }
      // Prepend basePath
      return `${basePath}${relativePath}`;
    }
    // Relative path
    return `${basePath}/${relativePath}`;
  };

  // Navigate relative to the plugin's basePath
  const pluginNavigate = (to, options) => {
    if (typeof to === 'string') {
      navigate(buildPath(to), options);
    } else {
      // Handle object form of navigation
      navigate(
        {
          ...to,
          pathname: buildPath(to.pathname),
        },
        options
      );
    }
  };

  // Get the current path relative to the plugin's basePath
  const getRelativePath = () => {
    if (location.pathname.startsWith(basePath)) {
      return location.pathname.slice(basePath.length) || '/';
    }
    return location.pathname;
  };

  const value = {
    basePath,
    navigate: pluginNavigate,
    location,
    buildPath,
    getRelativePath,
  };

  return <PluginContext.Provider value={value}>{children}</PluginContext.Provider>;
}

export default PluginContext;
