  module.exports = {
    apps: [
      {
        name: 'autoback',
        script: 'build/index.js',
        interpreter: 'bun', 
        node_args: '--env-file=.env',
        env: {
          NODE_ENV: 'production',
        },
        autorestart: true,
        watch: false,
      },
    ],
  };