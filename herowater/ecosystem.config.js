module.exports = {
  apps: [
    {
      name: "herowater",
      script: "server.js",
      cwd: "/var/www/herowater",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 5000,
        MONGODB_URI: "mongodb://127.0.0.1:27017/herowater"
      },
      max_memory_restart: "300M",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "/var/www/herowater/logs/error.log",
      out_file: "/var/www/herowater/logs/out.log",
      merge_logs: true,
    },
  ],
};
