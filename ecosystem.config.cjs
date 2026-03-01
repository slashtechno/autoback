  module.exports = {
    apps: [
      {
        name: 'autoback',
        script: 'build/index.js',
        interpreter: 'bun',
        env: {
          NODE_ENV: 'production',
        },
        autorestart: true,
        watch: false,
      },
    ],
  };