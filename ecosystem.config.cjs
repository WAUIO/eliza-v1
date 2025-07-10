module.exports = {
  apps: [
    {
      name: 'eliza-agent',
      cwd: '/var/www/eliza-evo',
      script: 'elizaos',
      args: 'start --character=characters/evolucia.character.json',
      env: {},
      autorestart: true,
      watch: false,
      max_memory_restart: '3G',
    }
  ]
};
