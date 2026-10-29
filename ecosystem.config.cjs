module.exports = {
  apps: [
    {
      name: 'campaignflow-api',
      script: 'src/server.js',
      cwd: './backend',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    },
    {
      name: 'campaignflow-worker',
      script: 'src/queues/campaignQueue.js',
      cwd: './backend',
      instances: 2,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
