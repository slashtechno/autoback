module.exports = {
  apps: [
    {
      name: 'autoback',
      script: 'build/index.js',
      // Load .env file — requires Node.js 20.6+
      node_args: '--env-file=.env',
      env: {
        NODE_ENV: 'production',
      },
      autorestart: true,
      watch: false,
    },
  ],
};
