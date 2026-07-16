import { sql } from 'drizzle-orm'
import { db } from '@/db'
import type { NominationMetadata, ProfileLinks } from '@/types'

/**
 * Statuses visible to the public registry. Pending nominations ARE public —
 * they appear immediately with an "Under Review" tag; only rejected ones are
 * hidden (owner/admin only).
 */
export const PUBLIC_STATUSES = [
  'pending',
  'approved',
  'in_progress',
  'completed',
  'published',
] as const

export interface NominationSummary {
  id: string
  doi: string
  metadata: NominationMetadata
  discipline: string
  verificationType: string
  availability: string[]
  availabilityLinks: Record<string, string>
  // Nominator-set tag: suits a Replication Workshop event.
  replicationWorkshop: boolean
  // Nominator-set flag: the study is experimental research.
  experimentalResearch: boolean
  status: string
  // Pseudonymous short token for public attribution (never the full UID).
  nominatorToken: string | null
  // The nominator's chosen display name, or "Anonymous Researcher" by default.
  nominatorName: string | null
  // The nominator's opt-in public contact links.
  nominatorLinks: ProfileLinks
  viewerIsNominator: boolean
  lastActivityAt: string
  createdAt: string
  upvotes: number
  predictYes: number
  predictNo: number
  contributions: number
  comments: number
  subscribers: number
  // Per-viewer state (defaults when signed out)
  userUpvoted: boolean
  userPrediction: boolean | null
  userContributed: boolean
  userSubscribed: boolean
}

export interface NominationDetail extends NominationSummary {
  justification: string
  metadataManual: boolean
  dataLocation: string
  robustnessChecks: string
  designDeviations: string
  // Name of the team's locked Slack channel ('' if none) — the id stays server-side.
  slackChannelName: string
}

const AGG = (viewer: string | null) => sql`
  substr(n.nominator_uid, 1, 8)         as nominator_token,
  (select u2.name from "user" u2 where u2.id = n.nominator_uid) as nominator_name,
  (select u2.links from "user" u2 where u2.id = n.nominator_uid) as nominator_links,
  ${viewer ? sql`(n.nominator_uid = ${viewer})` : sql`false`} as viewer_is_nominator,
  coalesce(v.upvotes, 0)::int           as upvotes,
  coalesce(p.predict_yes, 0)::int       as predict_yes,
  coalesce(p.predict_no, 0)::int        as predict_no,
  coalesce(c.contributions, 0)::int     as contributions,
  coalesce(cm.comments, 0)::int         as comments,
  coalesce(sb.subscribers, 0)::int      as subscribers,
  ${viewer ? sql`(uv.user_uid is not null)` : sql`false`} as user_upvoted,
  ${viewer ? sql`up.will_replicate` : sql`null::boolean`} as user_prediction,
  ${viewer ? sql`(uc.contributor_uid is not null)` : sql`false`} as user_contributed,
  ${viewer ? sql`(us.user_uid is not null)` : sql`false`} as user_subscribed
`

const JOINS = (viewer: string | null) => sql`
  left join (
    select nomination_id, count(*) as upvotes from votes group by nomination_id
  ) v on v.nomination_id = n.id
  left join (
    select nomination_id,
      count(*) filter (where will_replicate) as predict_yes,
      count(*) filter (where not will_replicate) as predict_no
    from predictions group by nomination_id
  ) p on p.nomination_id = n.id
  left join (
    select nomination_id, count(*) as contributions from contributions group by nomination_id
  ) c on c.nomination_id = n.id
  left join (
    select nomination_id, count(*) as comments from comments where hidden = false group by nomination_id
  ) cm on cm.nomination_id = n.id
  left join (
    select nomination_id, count(*) as subscribers from subscriptions group by nomination_id
  ) sb on sb.nomination_id = n.id
  ${
    viewer
      ? sql`
    left join votes uv on uv.nomination_id = n.id and uv.user_uid = ${viewer}
    left join predictions up on up.nomination_id = n.id and up.user_uid = ${viewer}
    left join contributions uc on uc.nomination_id = n.id and uc.contributor_uid = ${viewer}
    left join subscriptions us on us.nomination_id = n.id and us.user_uid = ${viewer}
  `
      : sql``
  }
`

interface Row extends Record<string, unknown> {
  id: string
  doi: string
  metadata: NominationMetadata
  metadata_manual: boolean
  discipline: string
  verification_type: string
  availability: string[]
  availability_links: Record<string, string> | null
  replication_games: boolean
  experimental_research: boolean
  slack_channel_name: string
  justification: string
  data_location: string
  robustness_checks: string
  design_deviations: string
  status: string
  nominator_token: string | null
  nominator_name: string | null
  nominator_links: ProfileLinks | null
  viewer_is_nominator: boolean
  last_activity_at: string
  created_at: string
  upvotes: number
  predict_yes: number
  predict_no: number
  contributions: number
  comments: number
  subscribers: number
  user_upvoted: boolean
  user_prediction: boolean | null
  user_contributed: boolean
  user_subscribed: boolean
}

function toSummary(r: Row): NominationSummary {
  return {
    id: r.id,
    doi: r.doi,
    metadata: r.metadata,
    discipline: r.discipline,
    verificationType: r.verification_type,
    availability: Array.isArray(r.availability) ? r.availability : [],
    availabilityLinks: r.availability_links ?? {},
    replicationWorkshop: r.replication_games,
    experimentalResearch: r.experimental_research,
    status: r.status,
    nominatorToken: r.nominator_token,
    nominatorName: r.nominator_name,
    nominatorLinks: r.nominator_links ?? {},
    viewerIsNominator: r.viewer_is_nominator,
    lastActivityAt: r.last_activity_at,
    createdAt: r.created_at,
    upvotes: r.upvotes,
    predictYes: r.predict_yes,
    predictNo: r.predict_no,
    contributions: r.contributions,
    comments: r.comments,
    subscribers: r.subscribers,
    userUpvoted: r.user_upvoted,
    userPrediction: r.user_prediction,
    userContributed: r.user_contributed,
    userSubscribed: r.user_subscribed,
  }
}

/** Public registry list, with per-viewer vote/prediction state when signed in. */
export async function listPublicNominations(viewer: string | null): Promise<NominationSummary[]> {
  const res = await db.execute<Row>(sql`
    select n.id, n.doi, n.metadata, n.discipline, n.verification_type, n.availability,
           n.availability_links, n.replication_games, n.experimental_research, n.status,
           n.last_activity_at, n.created_at, ${AGG(viewer)}
    from nominations n
    ${JOINS(viewer)}
    where n.status in ${sql`(${sql.join(PUBLIC_STATUSES.map((s) => sql`${s}`), sql`, `)})`}
    order by upvotes desc, n.last_activity_at desc
  `)
  return res.rows.map(toSummary)
}

/** Single nomination (any status) with aggregates + justification. */
export async function getNominationDetail(
  id: string,
  viewer: string | null,
): Promise<NominationDetail | null> {
  const res = await db.execute<Row>(sql`
    select n.id, n.doi, n.metadata, n.metadata_manual, n.discipline, n.verification_type,
           n.availability, n.availability_links, n.replication_games, n.experimental_research,
           n.justification, n.data_location, n.robustness_checks, n.design_deviations,
           n.slack_channel_name, n.status, n.last_activity_at, n.created_at, ${AGG(viewer)}
    from nominations n
    ${JOINS(viewer)}
    where n.id = ${id}
    limit 1
  `)
  const r = res.rows[0]
  if (!r) return null
  return {
    ...toSummary(r),
    justification: r.justification,
    metadataManual: r.metadata_manual,
    dataLocation: r.data_location,
    robustnessChecks: r.robustness_checks,
    designDeviations: r.design_deviations,
    slackChannelName: r.slack_channel_name,
  }
}
