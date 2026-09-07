import { POPUP_TOKEN_STORAGE_KEY } from 'better-auth/client/plugins'
import { apiOrigin } from './config'

const POPUP_NAME = 'better-auth-oauth'
const TIMEOUT_MS = 5 * 60_000
const CLOSED_POLL_MS = 500

type Provider = { provider: string } | { providerId: string }
type Outcome =
  | { status: 'success'; token: string }
  | { status: 'error'; message: string }

/**
 * Better Auth's own `signIn.popup` stores the returned token only when the page
 * is in an iframe; a top-level page has its token cleared and falls back to the
 * session cookie. Cross-site that cookie never arrives, so the flow fails with
 * POPUP_SIGN_IN_FAILED despite a perfectly good sign-in. This drives the same
 * endpoint and keeps the token, under the key the bearer helpers already read.
 */
export async function signInWithPopup(
  provider: Provider,
  callbackURL?: string,
): Promise<string | null> {
  const nonce = crypto.randomUUID()
  const url = new URL(`${apiOrigin}/api/auth/oauth-popup/start`)
  // The endpoint takes both kinds of provider in the same query parameter.
  url.searchParams.set('provider', 'provider' in provider ? provider.provider : provider.providerId)
  url.searchParams.set('popupOrigin', window.location.origin)
  url.searchParams.set('popupNonce', nonce)
  if (callbackURL) url.searchParams.set('callbackURL', callbackURL)

  const popup = window.open(url.toString(), POPUP_NAME, 'width=500,height=600')
  if (!popup) return 'Your browser blocked the sign-in window. Allow pop-ups and try again.'

  const outcome = await waitForToken(popup, new URL(apiOrigin).origin, nonce)
  if (outcome.status === 'error') return outcome.message

  try {
    window.localStorage.setItem(POPUP_TOKEN_STORAGE_KEY, outcome.token)
  } catch {
    return 'Could not store the sign-in token. Check that site data is allowed.'
  }
  return null
}

function waitForToken(popup: Window, authOrigin: string, nonce: string): Promise<Outcome> {
  return new Promise((resolve) => {
    let settled = false
    const settle = (outcome: Outcome) => {
      if (settled) return
      settled = true
      window.removeEventListener('message', onMessage)
      clearInterval(closedPoll)
      clearTimeout(timeout)
      try {
        if (!popup.closed) popup.close()
      } catch {
        // Cross-origin popups can refuse close(); the outcome still stands.
      }
      resolve(outcome)
    }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== authOrigin) return
      const data = event.data as { type?: string; nonce?: string; token?: string; error?: { code?: string; description?: string } }
      if (data?.type !== 'better-auth:oauth-popup' || data.nonce !== nonce) return
      if (data.error) {
        settle({ status: 'error', message: data.error.description || data.error.code || 'Sign-in failed.' })
        return
      }
      if (typeof data.token === 'string' && data.token) {
        settle({ status: 'success', token: data.token })
      }
    }

    const closedPoll = setInterval(() => {
      if (popup.closed) settle({ status: 'error', message: 'Sign-in window was closed.' })
    }, CLOSED_POLL_MS)
    const timeout = setTimeout(() => settle({ status: 'error', message: 'Sign-in timed out.' }), TIMEOUT_MS)
    window.addEventListener('message', onMessage)
  })
}
