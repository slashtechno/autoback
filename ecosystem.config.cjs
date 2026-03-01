module.exports = {
  apps: [
    {
      name: 'autoback',
      script: 'build/index.js',
      env: {
        NODE_ENV: 'production',
      },
      autorestart: true,
      watch: false,
    },
  ],
};