/**
 * Where the API lives, and how to reach files under the deployed base path.
 * On GitHub Pages the SPA is static and the Hono server sits on another origin,
 * so VITE_API_ORIGIN is baked in at build time; empty means same-origin /api.
 */
export const apiOrigin = (import.meta.env.VITE_API_ORIGIN ?? '').replace(/\/$/, '')

/** Resolves a root-relative path (public file or route) against the base path. */
export function withBase(path: string) {
  return import.meta.env.BASE_URL.replace(/\/$/, '') + (path.startsWith('/') ? path : `/${path}`)
}
