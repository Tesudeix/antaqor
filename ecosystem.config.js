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
      },
      max_memory_restart: "500M",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "/var/www/antaqor/logs/error.log",
      out_file: "/var/www/antaqor/logs/out.log",
      merge_logs: true,
    },
  ],
};
