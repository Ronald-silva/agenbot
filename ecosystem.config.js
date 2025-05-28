// ecosystem.config.js - Configuração PM2 para o bot
module.exports = {
  apps: [{
    name: 'felipe-bot',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 8080
    },
    // Logs
    out_file: './logs/app.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    // Outras configurações
    node_args: '--max-old-space-size=512',
    exec_mode: 'fork'
  }]
};
