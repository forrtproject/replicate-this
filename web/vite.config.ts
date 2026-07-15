/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Auth only trusts this exact origin (WEB_ORIGIN) — fail loudly if the
    // port is taken instead of drifting to 5174 and breaking sign-in with 403s.
    port: 5173,
    strictPort: true,
    proxy: {
      // Forward API + auth calls to the Hono server during local dev
      '/api': 'http://localhost:8787',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
