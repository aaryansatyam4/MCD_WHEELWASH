module.exports = {
  apps: [
    {
      name: 'wheelwash-monitor',
      script: './backend/dist/server.js',
      cwd: './backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5001,
      },
    },
  ],
};
