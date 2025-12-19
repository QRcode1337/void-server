const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
  apps: [
    {
      name: 'void-server',
      script: './server/index.js',
      cwd: './',
      // Disable watch in production
      watch: isProduction ? false : ['server', 'plugins'],
      ignore_watch: ['node_modules', 'logs', '*.log', '.git'],
      watch_delay: 1000,
      env: {
        NODE_ENV: 'development',
        PORT: 4420,
        // Neo4j (Docker on localhost)
        NEO4J_URI: 'bolt://localhost:7687',
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'voidserver',
        // IPFS (Docker on localhost)
        IPFS_API_URL: 'http://localhost:5001',
        IPFS_GATEWAY_URL: 'http://localhost:8080',
        // Ollama (native on localhost)
        OLLAMA_URL: 'http://localhost:11434/v1'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 4401
      },
      error_file: './logs/server-error.log',
      out_file: './logs/server-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 3000
    },
    // Client dev server - only runs in development
    // Runs vite directly (not via npm) for Windows compatibility
    ...(isProduction ? [] : [{
      name: 'void-client',
      script: './node_modules/vite/bin/vite.js',
      cwd: './client',
      env: {
        NODE_ENV: 'development'
      },
      error_file: '../logs/client-error.log',
      out_file: '../logs/client-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    }])
  ]
};
