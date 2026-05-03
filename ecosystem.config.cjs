/**
 * اجرای پایدار با PM2 از ریشهٔ ریپو:
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup
 */
const path = require("path");

module.exports = {
  apps: [
    {
      name: "pantomime-fa",
      cwd: __dirname,
      script: path.join(__dirname, "server.js"),
      instances: 1,
      autorestart: true,
      max_memory_restart: "250M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
