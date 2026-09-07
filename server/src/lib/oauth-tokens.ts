/**
 * Provider tokens carry PII the rest of the system deliberately never stores: a
 * Google `id_token` is a JWT with the real name and email inside it. The app
 * never calls a provider again after sign-in — the OAuth round trip only
 * establishes identity — so the tokens have no use once the account row exists.
 *
 * `stripOAuthTokens` is wired into Better Auth's `account.create.before` and
 * `account.update.before` hooks, which cover every write path: first sign-in,
 * repeat sign-in (which otherwise refreshes the stored tokens), and account
 * linking. The hook result is merged over the pending write, so returning only
 * these keys leaves `provider_id`, `account_id` and `scope` untouched.
 */
export function stripOAuthTokens<T extends Record<string, unknown>>(account: T) {
  return {
    ...account,
    accessToken: null,
    refreshToken: null,
    idToken: null,
  }
}
