import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { config } from '@/lib/env'
import { reviewUrl } from '@/lib/email-actions'
import type { NominationMetadata } from '@/types'

/**
 * The full-detail "nomination awaiting review" email sent to maintainers,
 * with one-click Approve / Reject buttons. The same detail rendering backs
 * the token-authenticated review page (routes/email-actions.ts).
 */

const AVAILABILITY_LABELS: Record<string, string> = {
  open_data: 'Open data',
  open_code: 'Open code',
  open_materials: 'Open materials',
  preregistration: 'Preregistration',
  open_access: 'Open access',
}

const VERIFICATION_LABELS: Record<string, string> = {
  replication: 'Replication — collect new data',
  reproduction: 'Reproduction — re-analyse the original data/code',
  both: 'Either replication or reproduction',
}

export interface ReviewNomination {
  id: string
  doi: string
  metadata: NominationMetadata
  discipline: string
  verificationType: string
  availability: string[]
  availabilityLinks: Record<string, string>
  justification: string
  dataLocation: string
  robustnessChecks: string
  designDeviations: string
  status: string
  createdAt: Date
  nominatorUid: string | null
  nominatorName: string | null
}

export async function loadReviewNomination(id: string): Promise<ReviewNomination | null> {
  const [row] = await db
    .select({
      nomination: schema.nominations,
      nominatorName: schema.user.name,
    })
    .from(schema.nominations)
    .leftJoin(schema.user, eq(schema.user.id, schema.nominations.nominatorUid))
    .where(eq(schema.nominations.id, id))
    .limit(1)
  if (!row) return null
  const n = row.nomination
  return {
    id: n.id,
    doi: n.doi,
    metadata: n.metadata as NominationMetadata,
    discipline: n.discipline,
    verificationType: n.verificationType,
    availability: (n.availability as string[]) ?? [],
    availabilityLinks: (n.availabilityLinks as Record<string, string>) ?? {},
    justification: n.justification,
    dataLocation: n.dataLocation,
    robustnessChecks: n.robustnessChecks,
    designDeviations: n.designDeviations,
    status: n.status,
    createdAt: n.createdAt,
    nominatorUid: n.nominatorUid,
    nominatorName: row.nominatorName,
  }
}

export function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

interface DetailRow {
  label: string
  value: string
  href?: string
}

/** Every nomination field a reviewer needs, as label/value rows. */
export function nominationDetailRows(n: ReviewNomination): DetailRow[] {
  const m = n.metadata
  const rows: DetailRow[] = [
    { label: 'Title', value: m.title || '(untitled)' },
    { label: 'Authors', value: (m.authors ?? []).join(', ') || '—' },
    {
      label: 'Journal',
      value: [m.journal, m.publication_date].filter(Boolean).join(', ') || '—',
    },
    { label: 'DOI', value: n.doi, href: `https://doi.org/${n.doi}` },
    { label: 'Discipline', value: n.discipline },
    { label: 'Requested check', value: VERIFICATION_LABELS[n.verificationType] ?? n.verificationType },
    {
      label: 'Openly available',
      value:
        n.availability
          .map((k) => {
            const label = AVAILABILITY_LABELS[k] ?? k
            const url = n.availabilityLinks[k]
            return url ? `${label} (${url})` : label
          })
          .join('; ') || 'Not specified',
    },
    { label: 'Justification', value: n.justification },
  ]
  if (n.dataLocation) rows.push({ label: 'Data location', value: n.dataLocation })
  if (n.robustnessChecks) rows.push({ label: 'Suggested robustness checks', value: n.robustnessChecks })
  if (n.designDeviations) rows.push({ label: 'Suggested design deviations', value: n.designDeviations })
  rows.push({
    label: 'Nominated by',
    value: n.nominatorUid
      ? `${n.nominatorName ?? 'Unknown'} (#${n.nominatorUid.slice(0, 8)})`
      : 'Deleted account',
  })
  rows.push({ label: 'Submitted', value: n.createdAt.toISOString().slice(0, 16).replace('T', ' ') + ' UTC' })
  return rows
}

/** Detail rows as an email/browser-safe HTML table (inline styles only). */
export function detailsTableHtml(n: ReviewNomination): string {
  const tr = (r: DetailRow) => {
    const value = r.href
      ? `<a href="${escapeHtml(r.href)}" style="color:#1a7f4e;">${escapeHtml(r.value)}</a>`
      : escapeHtml(r.value).replaceAll('\n', '<br>')
    return `<tr>
      <td style="padding:6px 12px 6px 0;vertical-align:top;white-space:nowrap;color:#6b7263;font-size:13px;">${escapeHtml(r.label)}</td>
      <td style="padding:6px 0;vertical-align:top;color:#1f241c;font-size:14px;line-height:1.45;">${value}</td>
    </tr>`
  }
  return `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:640px;">${nominationDetailRows(n).map(tr).join('')}</table>`
}

export function buildReviewEmail(
  n: ReviewNomination,
  adminUid: string,
  opts: { edited: boolean },
): { subject: string; text: string; html: string } {
  const heading = opts.edited
    ? 'An edited nomination is back in the review queue'
    : 'A new nomination is awaiting review'
  const subject = `${heading}: ${n.metadata.title || n.doi}`
  const approve = reviewUrl(n.id, adminUid, 'approve')
  const reject = reviewUrl(n.id, adminUid, 'reject')
  const adminQueue = `${config.webAppUrl}/admin`

  const text = [
    `${heading}.`,
    '',
    ...nominationDetailRows(n).map((r) => `${r.label}: ${r.value}`),
    '',
    `Approve: ${approve}`,
    `Reject: ${reject}`,
    `Open the moderation queue: ${adminQueue}`,
    '',
    `Manage which emails you get, or turn them off: ${config.webAppUrl}/profile`,
  ].join('\n')

  const btn = (href: string, label: string, bg: string) =>
    `<a href="${escapeHtml(href)}" style="display:inline-block;padding:10px 22px;margin-right:10px;border-radius:6px;background:${bg};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">${label}</a>`

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f6f7f4;padding:24px;">
  <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e3e6de;border-radius:10px;padding:28px;">
    <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7263;">Replicate This — moderation</p>
    <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#1f241c;">${escapeHtml(heading)}</h1>
    ${detailsTableHtml(n)}
    <div style="margin-top:24px;">
      ${btn(approve, 'Approve', '#1a7f4e')}
      ${btn(reject, 'Reject…', '#b3261e')}
    </div>
    <p style="margin:14px 0 0;font-size:12px;color:#6b7263;">
      Both buttons open a confirmation page — rejecting asks for a reason. Prefer the app?
      <a href="${escapeHtml(adminQueue)}" style="color:#1a7f4e;">Open the moderation queue</a>.
    </p>
    <hr style="margin:22px 0;border:none;border-top:1px solid #e3e6de;">
    <p style="margin:0;font-size:12px;color:#6b7263;">
      <a href="${escapeHtml(`${config.webAppUrl}/profile`)}" style="color:#1a7f4e;">Manage which emails you get</a>, or turn them off.
    </p>
  </div>
</div>`

  return { subject, text, html }
}
