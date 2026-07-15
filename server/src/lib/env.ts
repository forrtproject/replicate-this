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

export const config = {
  isProd,
  port: Number(process.env.PORT ?? 8787),
  databaseUrl: env(
    'DATABASE_URL',
    'postgresql://postgres:postgres@localhost:5432/replicate_this',
  ),
  // Public origin of the web app (for OAuth redirects + CORS).
  webOrigin: env('WEB_ORIGIN', 'http://localhost:5173'),
  betterAuthUrl: env('BETTER_AUTH_URL', 'http://localhost:8787'),
  betterAuthSecret: env('BETTER_AUTH_SECRET', 'dev-secret-change-me-32-chars-min'),

  uidPepper: env('UID_PEPPER', 'dev-uid-pepper-change-me'),
  emailPepper: env('EMAIL_PEPPER', 'dev-email-pepper-change-me'),

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
