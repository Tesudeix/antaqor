module.exports = {
  apps: [
    {
      name: "antaqor",
      script: "node_modules/.bin/next",
      args: "start",
      cwd: "/var/www/antaqor",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        MONGODB_URI: "mongodb://admin:5ff0dd1723e840e7b965833b87@178.128.104.98:27017/antaqor?authSource=admin",
      },
      max_memory_restart: "700M",
      // Restart loop protection: if the app dies too quickly too many times, stop retrying.
      min_uptime: "30s",
      max_restarts: 10,
      restart_delay: 3000,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "/var/www/antaqor/logs/error.log",
      out_file: "/var/www/antaqor/logs/out.log",
      merge_logs: true,
    },
  ],
};
