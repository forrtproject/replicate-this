import { sql } from 'drizzle-orm'
import {
  pgTable,
  text,
  boolean,
  timestamp,
  jsonb,
  uuid,
  integer,
  primaryKey,
  uniqueIndex,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'

/* ------------------------------------------------------------------ *
 * Better Auth core tables
 *
 * These match Better Auth's expected schema. The zero-PII hook (see
 * src/auth.ts) overwrites name/email/image before any row is written,
 * so `name` is a random pseudonym (never the provider profile name) and
 * `email` is a deterministic dummy. `role` is an additional field we use
 * for admins.
 * ------------------------------------------------------------------ */

export const user = pgTable(
  'user',
  {
    id: text('id').primaryKey(),
    // Auto-generated pseudonym (e.g. "BrightQuasar42"), editable by the user.
    // Unique (case-insensitive) among non-deleted users; deleted rows all
    // share the name "Deleted account".
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    role: text('role').notNull().default('user'), // 'user' | 'maintainer'
    // Soft-delete tombstone: login severed, PII cleared, but the row stays so the
    // user's nominations/votes/contributions/messages remain as "Deleted account".
    deleted: boolean('deleted').notNull().default(false),
    // Optional, user-chosen public contact links (orcid, github, twitter, …).
    // Opt-in only — never populated from the provider.
    links: jsonb('links').notNull().default({}),
    // Opt-in address for email notifications. User-volunteered PII — never the
    // login email (which is a zero-PII dummy). Empty = no emails.
    notificationEmail: text('notification_email').notNull().default(''),
    // Which notification categories to email (EMAIL_PREF_KEYS → boolean).
    emailPrefs: jsonb('email_prefs').notNull().default({}),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('user_name_lower_idx')
      .on(sql`lower(${t.name})`)
      .where(sql`${t.deleted} = false`),
  ],
)

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

/* ------------------------------------------------------------------ *
 * Application tables (revised architecture, 2026-06-21)
 *
 * - "claims" -> "contributions", auto-accepted (no handshake)
 * - voting split: `votes` (upvote = "want replicated") +
 *   `predictions` (yes/no = "will it replicate", shown as distribution)
 * - collaboration hub deferred (no working_groups / hub_* tables)
 * - status adds terminal 'completed' / 'published'
 * ------------------------------------------------------------------ */

// pending -> approved -> in_progress -> completed -> published
// rejected: admin override any time before in_progress
export const NOMINATION_STATUSES = [
  'pending',
  'approved',
  'in_progress',
  'completed',
  'published',
  'rejected',
] as const

export const nominations = pgTable('nominations', {
  id: uuid('id').primaryKey().defaultRandom(),
  doi: text('doi').notNull().unique(),
  // Cached Crossref (or manually entered) reference: title, authors, journal, publication_date.
  metadata: jsonb('metadata').notNull().default({}),
  // true when the submitter entered the reference by hand (Crossref/doi.org failed).
  metadataManual: boolean('metadata_manual').notNull().default(false),
  discipline: text('discipline').notNull(),
  // Whether the study needs a replication (new data, same method), a
  // reproduction (re-analyse original data), or the nominator is unsure/both.
  verificationType: text('verification_type').notNull().default('replication'),
  // What the nominator says is openly available: data, code, materials, etc.
  // Array of keys from AVAILABILITY_KEYS.
  availability: jsonb('availability').notNull().default([]),
  // Optional URL per availability item, e.g. { open_data: "https://osf.io/…" }.
  availabilityLinks: jsonb('availability_links').notNull().default({}),
  justification: text('justification').notNull(),
  // Where the original data/code live (for reproductions) — e.g. Zenodo/OSF.
  dataLocation: text('data_location').notNull().default(''),
  // Suggested alternative specifications / robustness checks.
  robustnessChecks: text('robustness_checks').notNull().default(''),
  // For replications: how the new design should differ from the original.
  designDeviations: text('design_deviations').notNull().default(''),
  // Nominator-set tag: the paper suits a Replication Games event (one-day
  // team reproduction hackathons run by the Institute for Replication).
  replicationGames: boolean('replication_games').notNull().default(false),
  // Locked Slack channel for the replication team, created on approval when
  // the Slack integration is configured. Empty = no channel.
  slackChannelId: text('slack_channel_id').notNull().default(''),
  slackChannelName: text('slack_channel_name').notNull().default(''),
  nominatorUid: text('nominator_uid').references(() => user.id, {
    onDelete: 'set null',
  }),
  status: text('status').notNull().default('pending'),
  // Highest upvote milestone already alerted to admins (avoids re-notifying).
  lastMilestone: integer('last_milestone').notNull().default(0),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// Upvote-only "I want to see this replicated". Presence of a row = an upvote.
export const votes = pgTable(
  'votes',
  {
    nominationId: uuid('nomination_id')
      .notNull()
      .references(() => nominations.id, { onDelete: 'cascade' }),
    userUid: text('user_uid')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.nominationId, t.userUid] })],
)

// "Will it replicate?" yes/no prediction, displayed as a distribution.
export const predictions = pgTable(
  'predictions',
  {
    nominationId: uuid('nomination_id')
      .notNull()
      .references(() => nominations.id, { onDelete: 'cascade' }),
    userUid: text('user_uid')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    willReplicate: boolean('will_replicate').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.nominationId, t.userUid] })],
)

// Auto-accepted intent to replicate. One per user per nomination.
export const contributions = pgTable(
  'contributions',
  {
    id: uuid('id').notNull().defaultRandom().unique(),
    nominationId: uuid('nomination_id')
      .notNull()
      .references(() => nominations.id, { onDelete: 'cascade' }),
    contributorUid: text('contributor_uid')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // Optional pitch: expertise, lab, timeline.
    message: text('message').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.nominationId, t.contributorUid] })],
)

// Public discussion on a nomination. Author references user(id); we soft-delete
// users, so a deleted author's comments remain, shown as "Deleted account".
export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  nominationId: uuid('nomination_id')
    .notNull()
    .references(() => nominations.id, { onDelete: 'cascade' }),
  // Reddit-style threading: null = top-level, otherwise a reply to that comment.
  parentId: uuid('parent_id').references((): AnyPgColumn => comments.id, {
    onDelete: 'cascade',
  }),
  authorUid: text('author_uid')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  // Hidden by a maintainer (off-topic/CoC). Kept for audit, not shown publicly.
  hidden: boolean('hidden').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// GitHub-style "watch": subscribers get in-app notifications for activity on
// the nomination (comments, progress updates, status changes, new contributors).
export const subscriptions = pgTable(
  'subscriptions',
  {
    nominationId: uuid('nomination_id')
      .notNull()
      .references(() => nominations.id, { onDelete: 'cascade' }),
    userUid: text('user_uid')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.nominationId, t.userUid] })],
)

// Progress updates posted by the replication team (nominator, contributors,
// maintainers). Posting is optional. An update carrying an article link is a
// completion request: a maintainer must approve before the status flips to
// 'completed'.
export const nominationUpdates = pgTable('nomination_updates', {
  id: uuid('id').primaryKey().defaultRandom(),
  nominationId: uuid('nomination_id')
    .notNull()
    .references(() => nominations.id, { onDelete: 'cascade' }),
  authorUid: text('author_uid')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  // Link to the resulting research article/preprint; required to mark completed.
  articleUrl: text('article_url').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const inquiries = pgTable('inquiries', {
  id: uuid('id').primaryKey().defaultRandom(),
  nominationId: uuid('nomination_id')
    .notNull()
    .references(() => nominations.id, { onDelete: 'cascade' }),
  senderUid: text('sender_uid')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  deliveryStatus: text('delivery_status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  readAt: timestamp('read_at', { withTimezone: true }),
})

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userUid: text('user_uid')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  data: jsonb('data').notNull().default({}),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const moderationLogs = pgTable('moderation_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  adminUid: text('admin_uid')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  nominationId: uuid('nomination_id').references(() => nominations.id, {
    onDelete: 'set null',
  }),
  action: text('action').notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})
