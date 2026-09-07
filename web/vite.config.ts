/// <reference types="vitest/config" />
import { defineConfig, type Connect, type Plugin, type PreviewServer, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import pkg from './package.json' with { type: 'json' }

// GitHub Pages serves the project site under /<repo>/, so every asset and route
// hangs off the homepage path. Applied in dev too, so base bugs surface locally.
const base = new URL(pkg.homepage).pathname + '/'

// Anything Vite (or the dev API proxy) owns at the origin root.
const PASSTHROUGH = /^\/(api\/|@|node_modules\/|__|\.well-known\/)/

// Without this, hitting http://localhost:5173/ answers with Vite's "did you mean
// to visit /replicate-this/" notice instead of the app.
function redirectRootToBase(): Plugin {
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const url = req.url || '/'
    if (url.startsWith(base) || PASSTHROUGH.test(url)) return next()
    res.statusCode = 302
    res.setHeader('Location', base.replace(/\/$/, '') + url)
    res.end()
  }
  return {
    name: 'redirect-root-to-base',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(middleware)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), redirectRootToBase()],
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
    open: base,
    proxy: {
      // Forward API + auth calls to the Hono server during local dev
      '/api': 'http://localhost:8787',
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
