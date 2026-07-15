import { randomUUID } from 'node:crypto'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { genericOAuth } from 'better-auth/plugins'
import { db, schema } from '@/db'
import { config } from '@/lib/env'
import { deterministicEmail } from '@/lib/crypto'
import { generateUniquePseudonym } from '@/lib/pseudonym'

/**
 * Zero-PII: replace the OAuth profile with a stripped user. `basis` is the value
 * the dummy email is derived from — the real email for Google/GitHub (so the same
 * person links across providers), or the ORCID iD when no email is exposed.
 * Runs in mapProfileToUser, i.e. BEFORE Better Auth's existing-user lookup, so the
 * dummy email is what it matches on — which is what makes account linking work.
 */
function anonymize(basis: string | null | undefined) {
  return {
    // Placeholder — the user.create.before hook replaces it with a random pseudonym.
    name: 'Anonymous Researcher',
    email: deterministicEmail(basis || randomUUID(), config.emailPepper),
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
   * Defense-in-depth: mapProfileToUser already stripped PII, but ensure nothing
   * identifying slips through on any other creation path. Idempotent — never
   * re-hashes an email that is already a @privacy.forrt.org dummy. `id` is left
   * untouched (Better Auth's own id is non-identifying and it looks users up by it).
   *
   * The name is a randomly generated pseudonym (e.g. "BrightQuasar42") — never
   * the provider profile name. Name changes go through PATCH /api/profile/name
   * (which enforces uniqueness), so Better Auth's own update path drops them.
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
