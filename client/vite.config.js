import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import discoverPlugins from './vite-plugin-discover-plugins.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    discoverPlugins({
      pluginsDir: path.resolve(__dirname, '../plugins')
    }),
    react(),
    tailwindcss()
  ],
  resolve: {
    // Preserve symlinks for plugin development
    preserveSymlinks: true,
    alias: {
      // Alias for cleaner plugin imports
      '@plugins': path.resolve(__dirname, '../plugins'),
      // Ensure plugins use host's dependencies (avoid duplicate instances)
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react-router-dom': path.resolve(__dirname, 'node_modules/react-router-dom'),
      'react-hot-toast': path.resolve(__dirname, 'node_modules/react-hot-toast'),
      '@heroicons/react': path.resolve(__dirname, 'node_modules/@heroicons/react'),
      'lucide-react': path.resolve(__dirname, 'node_modules/lucide-react'),
      'tone': path.resolve(__dirname, 'node_modules/tone')
    }
  },
  // Allow imports from outside the client directory (for plugins)
  server: {
    port: 4480,
    fs: {
      allow: ['..']
    },
    // Configure HMR to connect to Vite's port when app is loaded via Express
    hmr: {
      port: 4480
    },
    // Proxy API and WebSocket calls to Express server
    proxy: {
      '/api': {
        target: 'http://localhost:4401',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:4401',
        ws: true
      },
      // Plugin APIs should hit the server (UI stays on Vite)
      '/wallet/api': {
        target: 'http://localhost:4401',
        changeOrigin: true
      },
      '/wallet/socket.io': {
        target: 'http://localhost:4401',
        ws: true
      }
    }
  },
  // Optimize dependencies for plugins
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'react-hot-toast']
  },
  // Production build optimizations
  build: {
    // Disable source maps in production for faster builds
    sourcemap: false,
    // Reduce chunk size warnings threshold
    chunkSizeWarningLimit: 1000
  }
})
