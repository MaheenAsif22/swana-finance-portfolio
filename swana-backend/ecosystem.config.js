// Usage: pm2 start ecosystem.config.js --env production
module.exports = {
  apps: [{
    name:         'swana-api',
    script:       'src/server.js',
    instances:    1,               // SQLite = single instance
    autorestart:  true,
    watch:        false,
    max_memory_restart: '300M',
    env_production: {
      NODE_ENV: 'production',
      PORT:     3001,
    },
  }],
};
