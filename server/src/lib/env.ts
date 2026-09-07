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

export const config = {
  isProd,
  port: Number(process.env.PORT ?? 8787),
  databaseUrl: env('DATABASE_URL', DEV_DEFAULTS.DATABASE_URL),
  // Public URL of the web app, base path included — for links in emails.
  webAppUrl,
  // Just the origin of it — for CORS and Better Auth's trusted origins.
  webOrigin: new URL(webAppUrl).origin,
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
