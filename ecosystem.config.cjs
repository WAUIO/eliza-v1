module.exports = {
  apps: [
    {
      name: 'eliza-agent',
      cwd: '/var/www/eliza-evo',
      script: 'elizaos',
      args: 'start --character=characters/evolucia.character.json',
      env: {
        NODE_ENV: 'production',
        SERVER_PORT: 3000
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '3G',
    }
  ]
};
