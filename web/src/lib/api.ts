import { getStoredPopupToken } from 'better-auth/client/plugins'
import { apiOrigin } from './config'

/**
 * Thin fetch wrapper for the Hono API. All privileged logic lives server-side;
 * the SPA only ever talks to /api/* (never to Postgres directly).
 */

export class ApiError extends Error {
  status: number
  data?: unknown

  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Cross-origin the session cookie is dropped by the browser, so the token the
  // sign-in popup handed back is what actually authenticates these calls.
  const token = getStoredPopupToken()

  const res = await fetch(`${apiOrigin}/api${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  const isJson = res.headers.get('content-type')?.includes('application/json')
  const body = isJson ? await res.json() : await res.text()

  if (!res.ok) {
    const message =
      (isJson && body && typeof body === 'object' && 'error' in body
        ? (body as { error: string }).error
        : undefined) ?? `Request failed (${res.status})`
    throw new ApiError(message, res.status, body)
  }

  return body as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(data ?? {}) }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(data ?? {}) }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(data ?? {}) }),
  delete: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: 'DELETE',
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    }),
}
