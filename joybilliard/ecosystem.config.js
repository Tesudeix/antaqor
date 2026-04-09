module.exports = {
  apps: [
    {
      name: "joybilliard",
      script: "server.js",
      cwd: "/var/www/joybilliard",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
        MONGODB_URI: "mongodb://127.0.0.1:27017/joybilliard"
      },
      max_memory_restart: "300M",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "/var/www/joybilliard/logs/error.log",
      out_file: "/var/www/joybilliard/logs/out.log",
      merge_logs: true,
    },
  ],
};
