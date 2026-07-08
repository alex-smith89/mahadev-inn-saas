module.exports = {
  apps: [{
    name: 'mahadev-server',
    script: 'npm',
    args: 'run start:dev',
    interpreter: 'none',  // ✅ Important: Don't use node interpreter
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      PORT: 4000
    }
  }]
};