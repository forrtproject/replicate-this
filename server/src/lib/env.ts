import 'dotenv/config'

/** Read an env var, falling back to a default in non-production. */
function env(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

const isProd = process.env.NODE_ENV === 'production'

/** Every one of these is a working local setup — see the production check below. */
const DEV_DEFAULTS = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/replicate_this',
  WEB_ORIGIN: 'http://localhost:5173',
  BETTER_AUTH_URL: 'http://localhost:8787',
  BETTER_AUTH_SECRET: 'dev-secret-change-me-32-chars-min',
  UID_PEPPER: 'dev-uid-pepper-change-me',
  EMAIL_PEPPER: 'dev-email-pepper-change-me',
} as const

// WEB_ORIGIN may carry a base path, since the SPA is served from
// forrt.org/replicate-this. Links need it whole; CORS and trusted origins
// compare against the Origin header a browser sends, which never has a path.
const webAppUrl = env('WEB_ORIGIN', DEV_DEFAULTS.WEB_ORIGIN).replace(/\/$/, '')
const webOrigin = new URL(webAppUrl).origin

/**
 * Extra web origins this API also serves, beyond WEB_ORIGIN: e.g.
 * EXTRA_WEB_ORIGINS=http://localhost:5173 lets a local dev server test against
 * a deployed API. Comma-separated. Each one is trusted for CORS with
 * credentials and for sign-in, so set it only temporarily and only to origins
 * you control. Empty by default.
 */
function parseOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      try {
        return new URL(s).origin
      } catch {
        throw new Error(`EXTRA_WEB_ORIGINS: "${s}" is not a valid origin (e.g. http://localhost:5173).`)
      }
    })
}
const extraWebOrigins = parseOrigins(process.env.EXTRA_WEB_ORIGINS ?? '')

export const config = {
  isProd,
  port: Number(process.env.PORT ?? 8787),
  databaseUrl: env('DATABASE_URL', DEV_DEFAULTS.DATABASE_URL),
  // Public URL of the web app, base path included — for links in emails.
  webAppUrl,
  // Just the origin of it, for working out whether auth is cross-site.
  webOrigin,
  // Every origin allowed to call the API with credentials and sign in:
  // WEB_ORIGIN plus any EXTRA_WEB_ORIGINS.
  webOrigins: [...new Set([webOrigin, ...extraWebOrigins])],
  betterAuthUrl: env('BETTER_AUTH_URL', DEV_DEFAULTS.BETTER_AUTH_URL),
  betterAuthSecret: env('BETTER_AUTH_SECRET', DEV_DEFAULTS.BETTER_AUTH_SECRET),

  uidPepper: env('UID_PEPPER', DEV_DEFAULTS.UID_PEPPER),
  emailPepper: env('EMAIL_PEPPER', DEV_DEFAULTS.EMAIL_PEPPER),

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID ?? '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
  },
  orcid: {
    clientId: process.env.ORCID_CLIENT_ID ?? '',
    clientSecret: process.env.ORCID_CLIENT_SECRET ?? '',
  },

  adminEmail: process.env.ADMIN_EMAIL ?? 'admin@forrt.org',

  slack: {
    // Bot token of the community workspace's app (xoxb-…). Blank = Slack
    // integration disabled; approvals still work, no channels are created.
    botToken: process.env.SLACK_BOT_TOKEN ?? '',
    // Standing invite link to the community workspace, shown to users who
    // don't have a Slack account there yet.
    inviteUrl: process.env.SLACK_INVITE_URL ?? '',
  },

  postmark: {
    token: process.env.POSTMARK_API_TOKEN ?? '',
    from: process.env.POSTMARK_FROM_EMAIL ?? 'noreply@forrt.org',
  },
}

// A missing .env in production is otherwise silent: the dev secret and peppers
// would sign real sessions and hash real emails, and a stale WEB_ORIGIN shows up
// only as a CORS error in someone's browser. Refuse to start instead.
if (isProd) {
  const defaulted = Object.entries(DEV_DEFAULTS)
    .filter(([key, value]) => (process.env[key] ?? value) === value)
    .map(([key]) => key)

  if (defaulted.length > 0) {
    throw new Error(
      `Refusing to start: production is using development defaults for ` +
        `${defaulted.join(', ')}. Is .env in the working directory? ` +
        `PM2 needs cwd set to it — see docs/DEPLOYMENT.md.`,
    )
  }
}
