// pm2 process definition for the Snapnkeep v2 server.
// Manage with: pm2 [status|logs|restart] snapnkeep-server
module.exports = {
  apps: [
    {
      name: "snapnkeep-server",
      cwd: "/home/snapnkeep/servers/v2/server",
      script: "server.js",
      interpreter: "/usr/local/bin/node",
      env: { NODE_ENV: "production" },
      max_memory_restart: "500M",
      restart_delay: 2000,
      time: true, // timestamps in logs
    },
  ],
};
