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
        PORT: 4401
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
    ...(isProduction ? [] : [{
      name: 'void-client',
      script: 'npm',
      args: 'run dev',
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
