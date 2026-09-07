module.exports = {
  apps: [
    {
      name: 'replicate-this-api',
      script: 'dist/index.js',
      // dotenv reads .env relative to the working directory, not the script.
      cwd: __dirname,
      // Fork, not cluster: the sign-up email hand-off in src/auth.ts is an
      // in-process Map, so a second worker would drop notification addresses.
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '512M',
      time: true,
    },
  ],
}
