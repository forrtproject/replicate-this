import { randomUUID } from 'node:crypto'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { genericOAuth, bearer, oauthPopup } from 'better-auth/plugins'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { config } from '@/lib/env'
import { deterministicEmail } from '@/lib/crypto'
import { initialDisplayName } from '@/lib/pseudonym'
import { notify } from '@/lib/notify'
import { stripOAuthTokens } from '@/lib/oauth-tokens'
import { defaultEmailPrefs } from '@/types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Real provider details (email, profile name), waiting to be written to the row
 * they belong to. `mapProfileToUser` is the only place they are visible, but the
 * user row doesn't exist yet there — so we park them here, keyed by the dummy
 * email (which is derived from the real one, so both sides agree), and the
 * user-create hooks pick them up. Entries are consumed once and expire quickly:
 * a returning user never reaches the create hooks, so their entry is dropped.
 */
const SIGNUP_PROFILE_TTL_MS = 10 * 60_000
interface SignupProfile {
  email: string
  name: string
  at: number
}
const signupProfiles = new Map<string, SignupProfile>()

function rememberSignupProfile(key: string, email: string, name: string): void {
  const now = Date.now()
  for (const [k, v] of signupProfiles) {
    if (now - v.at > SIGNUP_PROFILE_TTL_MS) signupProfiles.delete(k)
  }
  signupProfiles.set(key, { email, name, at: now })
}

/** The details captured at sign-in, without consuming them. */
function peekSignupProfile(key: string): SignupProfile | null {
  const hit = signupProfiles.get(key)
  if (!hit || Date.now() - hit.at > SIGNUP_PROFILE_TTL_MS) return null
  return hit
}

/** Pops the details captured at sign-in. */
function takeSignupProfile(key: string): SignupProfile | null {
  const hit = peekSignupProfile(key)
  signupProfiles.delete(key)
  return hit
}

/**
 * Replace the OAuth profile with a stripped user. `basis` is the value the dummy
 * login email is derived from — the real email for Google/GitHub (so the same
 * person links across providers), or the ORCID iD when no email is exposed.
 * Runs in mapProfileToUser, i.e. BEFORE Better Auth's existing-user lookup, so the
 * dummy email is what it matches on — which is what makes account linking work.
 *
 * When the provider gave us a real address we keep it for notifications, and
 * the profile name becomes the new account's starting display name (see
 * `rememberSignupProfile`); the login email itself stays a dummy either way.
 */
function anonymize(basis: string | null | undefined, profileName?: string | null) {
  const email = deterministicEmail(basis || randomUUID(), config.emailPepper)
  const real = basis?.trim().toLowerCase() ?? ''
  rememberSignupProfile(email, EMAIL_RE.test(real) ? real : '', profileName?.trim() ?? '')
  return {
    // Placeholder — the user.create.before hook replaces it with the display name.
    name: 'Anonymous Researcher',
    email,
    emailVerified: true,
    image: null,
  }
}

const hasCreds = (p: { clientId: string; clientSecret: string }) =>
  Boolean(p.clientId && p.clientSecret)

/** Which providers are actually configured — exposed to the sign-in page. */
export const enabledProviders = {
  google: hasCreds(config.google),
  github: hasCreds(config.github),
  orcid: hasCreds(config.orcid),
}

// Only register providers that have credentials; Better Auth throws otherwise.
type SocialCfg = {
  clientId: string
  clientSecret: string
  scope?: string[]
  mapProfileToUser: (profile: any) => ReturnType<typeof anonymize>
}
const socialProviders: Record<string, SocialCfg> = {}
if (enabledProviders.google) {
  socialProviders.google = {
    clientId: config.google.clientId,
    clientSecret: config.google.clientSecret,
    // `profile` only for the display name suggested at sign-up.
    scope: ['openid', 'email', 'profile'],
    mapProfileToUser: (p) => anonymize(p?.email, p?.name),
  }
}
if (enabledProviders.github) {
  socialProviders.github = {
    clientId: config.github.clientId,
    clientSecret: config.github.clientSecret,
    mapProfileToUser: (p) => anonymize(p?.email, p?.name),
  }
}

const orcidConfig = enabledProviders.orcid
  ? [
      {
        providerId: 'orcid',
        clientId: config.orcid.clientId,
        clientSecret: config.orcid.clientSecret,
        discoveryUrl: 'https://orcid.org/.well-known/openid-configuration',
        scopes: ['openid'],
        mapProfileToUser: (p: any) =>
          anonymize(
            p?.sub,
            p?.name || [p?.given_name, p?.family_name].filter(Boolean).join(' '),
          ),
      },
    ]
  : []

const crossSite =
  new URL(config.betterAuthUrl).host !== new URL(config.webOrigin).host

export const auth = betterAuth({
  baseURL: config.betterAuthUrl,
  secret: config.betterAuthSecret,
  basePath: '/api/auth',
  trustedOrigins: config.webOrigins,

  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),

  /**
   * The login email is always a dummy, on every creation path. Idempotent —
   * never re-hashes an email that is already a @privacy.forrt.org dummy. `id` is
   * left untouched (Better Auth's own id is non-identifying and it looks users
   * up by it).
   *
   * The name starts as the provider profile name (we encourage real names),
   * falling back to a random pseudonym (e.g. "BrightQuasar42") when there is
   * none or it is unusable. Name changes go through PATCH /api/profile/name
   * (which enforces uniqueness), so Better Auth's own update path drops them.
   *
   * `after` seeds the notification settings a new account starts with: the
   * address from the provider (blank for ORCID, which exposes none — those users
   * enter one in their profile) and every email category switched on. Written
   * directly rather than through `before`, since these are our own columns and
   * not part of Better Auth's user model. It also leaves a welcome message in
   * the in-app inbox.
   */
  databaseHooks: {
    user: {
      create: {
        before: async (user) => ({
          data: {
            ...user,
            name: await initialDisplayName(peekSignupProfile(user.email ?? '')?.name),
            email: user.email?.endsWith('@privacy.forrt.org')
              ? user.email
              : deterministicEmail(user.email || user.id, config.emailPepper),
            emailVerified: true,
            image: null,
          },
        }),
        after: async (user) => {
          await db
            .update(schema.user)
            .set({
              notificationEmail: takeSignupProfile(user.email)?.email ?? '',
              emailPrefs: defaultEmailPrefs(),
              updatedAt: new Date(),
            })
            .where(eq(schema.user.id, user.id))
          await notify([{ userUid: user.id, type: 'welcome' }])
        },
      },
      update: {
        before: async (user) => {
          const { name: _ignored, ...rest } = user as Record<string, unknown>
          return { data: rest }
        },
      },
    },
    // Provider tokens are never written to the database: see
    // `stripOAuthTokens`. `create` covers first sign-in and account linking,
    // `update` covers repeat sign-in, which otherwise refreshes them in place.
    account: {
      create: { before: async (account) => ({ data: stripOAuthTokens(account) }) },
      update: { before: async (account) => ({ data: stripOAuthTokens(account) }) },
    },
  },

  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'user',
        input: false, // never settable by the client
      },
      // Surfaced in the session so the client can redirect new users to the
      // post-signup walkthrough exactly once. Set server-side via POST /profile/onboarded.
      onboarded: {
        type: 'boolean',
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },

  account: {
    // Link accounts that resolve to the same dummy email (i.e. the same real
    // person across providers). Trusted so linking is allowed without extra
    // verification — the providers already verified the underlying email.
    accountLinking: {
      enabled: true,
      trustedProviders: ['google', 'github', 'orcid'],
    },
    // Better Auth double-checks the OAuth state against a cookie it sets on the
    // API domain during sign-in. Cross-site that is a third-party cookie, which
    // many browsers refuse to store, and the callback then fails with
    // state_mismatch. The state itself is a single-use random value held in the
    // verification table — the cookie is only defence in depth, so drop it when
    // the two are on different sites.
    skipStateCookieCheck: crossSite,
  },

  socialProviders,

  plugins: [
    ...(orcidConfig.length ? [genericOAuth({ config: orcidConfig })] : []),
    // Cross-site, the session cookie is third-party and current browsers drop
    // it, so the SPA never sees a session however well the callback goes. The
    // popup flow posts the session token back to the opener instead, and bearer
    // lets the SPA present it as an Authorization header.
    ...(crossSite ? [oauthPopup(), bearer()] : []),
  ],

  advanced: {
    cookiePrefix: 'replicate-this',
    useSecureCookies: config.isProd,
    defaultCookieAttributes: {
      httpOnly: true,
      // The web app and the API are separate hosts in production (Pages on
      // forrt.org, API elsewhere), so the session cookie is cross-site and a
      // Lax cookie would never be sent. SameSite=None requires Secure, hence
      // the isProd guard — same-host dev stays on Lax.
      sameSite: config.isProd && crossSite ? 'none' : 'lax',
    },
  },
})

export type Session = typeof auth.$Infer.Session
