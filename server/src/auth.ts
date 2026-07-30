import { randomUUID } from 'node:crypto'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { genericOAuth } from 'better-auth/plugins'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { config } from '@/lib/env'
import { deterministicEmail } from '@/lib/crypto'
import { generateUniquePseudonym } from '@/lib/pseudonym'
import { defaultEmailPrefs } from '@/types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Real provider emails, waiting to be written to `notification_email` on the row
 * they belong to. `mapProfileToUser` is the only place the address is visible,
 * but the user row doesn't exist yet there — so we park it here, keyed by the
 * dummy email (which is derived from it, so both sides agree), and the
 * user-create hook picks it up. Entries are consumed once and expire quickly:
 * a returning user never reaches the create hook, so their entry is dropped.
 */
const SIGNUP_EMAIL_TTL_MS = 10 * 60_000
const signupEmails = new Map<string, { email: string; at: number }>()

function rememberSignupEmail(key: string, email: string): void {
  const now = Date.now()
  for (const [k, v] of signupEmails) {
    if (now - v.at > SIGNUP_EMAIL_TTL_MS) signupEmails.delete(k)
  }
  signupEmails.set(key, { email, at: now })
}

/** Pops the address captured at sign-in, or '' if there wasn't a usable one. */
function takeSignupEmail(key: string): string {
  const hit = signupEmails.get(key)
  signupEmails.delete(key)
  if (!hit || Date.now() - hit.at > SIGNUP_EMAIL_TTL_MS) return ''
  return hit.email
}

/**
 * Replace the OAuth profile with a stripped user. `basis` is the value the dummy
 * login email is derived from — the real email for Google/GitHub (so the same
 * person links across providers), or the ORCID iD when no email is exposed.
 * Runs in mapProfileToUser, i.e. BEFORE Better Auth's existing-user lookup, so the
 * dummy email is what it matches on — which is what makes account linking work.
 *
 * When the provider gave us a real address we keep it for notifications (see
 * `rememberSignupEmail`); the login email itself stays a dummy either way.
 */
function anonymize(basis: string | null | undefined) {
  const email = deterministicEmail(basis || randomUUID(), config.emailPepper)
  const real = basis?.trim().toLowerCase() ?? ''
  if (EMAIL_RE.test(real)) rememberSignupEmail(email, real)
  return {
    // Placeholder — the user.create.before hook replaces it with a random pseudonym.
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
    scope: ['openid', 'email'],
    mapProfileToUser: (p) => anonymize(p?.email),
  }
}
if (enabledProviders.github) {
  socialProviders.github = {
    clientId: config.github.clientId,
    clientSecret: config.github.clientSecret,
    mapProfileToUser: (p) => anonymize(p?.email),
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
        mapProfileToUser: (p: any) => anonymize(p?.sub),
      },
    ]
  : []

export const auth = betterAuth({
  baseURL: config.betterAuthUrl,
  secret: config.betterAuthSecret,
  basePath: '/api/auth',
  trustedOrigins: [config.webOrigin],

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
   * The name is a randomly generated pseudonym (e.g. "BrightQuasar42") — never
   * the provider profile name. Name changes go through PATCH /api/profile/name
   * (which enforces uniqueness), so Better Auth's own update path drops them.
   *
   * `after` seeds the notification settings a new account starts with: the
   * address from the provider (blank for ORCID, which exposes none — those users
   * enter one in their profile) and every email category switched on. Written
   * directly rather than through `before`, since these are our own columns and
   * not part of Better Auth's user model.
   */
  databaseHooks: {
    user: {
      create: {
        before: async (user) => ({
          data: {
            ...user,
            name: await generateUniquePseudonym(),
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
              notificationEmail: takeSignupEmail(user.email),
              emailPrefs: defaultEmailPrefs(),
              updatedAt: new Date(),
            })
            .where(eq(schema.user.id, user.id))
        },
      },
      update: {
        before: async (user) => {
          const { name: _ignored, ...rest } = user as Record<string, unknown>
          return { data: rest }
        },
      },
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
  },

  socialProviders,

  plugins: orcidConfig.length ? [genericOAuth({ config: orcidConfig })] : [],

  advanced: {
    cookiePrefix: 'replicate-this',
    useSecureCookies: config.isProd,
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: 'lax',
    },
  },
})

export type Session = typeof auth.$Infer.Session
