import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { config } from '@/lib/env'
import { verifyReviewToken, type ReviewTokenPayload } from '@/lib/email-actions'
import { approveNomination, rejectNomination } from '@/lib/moderation'
import {
  loadReviewNomination,
  detailsTableHtml,
  escapeHtml,
  type ReviewNomination,
} from '@/lib/review-email'

/**
 * One-click moderation from the maintainer review email. These routes are
 * session-less: the signed token in the URL identifies both the nomination
 * and the acting maintainer (whose role is re-checked on every request).
 * The emailed buttons land on a GET confirmation page and the action itself
 * is a POST — so inbox link scanners can never approve/reject by prefetching.
 */

export const emailActionsRouter = new Hono()

function page(title: string, body: string, status = 200) {
  return new Response(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${escapeHtml(title)} — Replicate This</title>
</head>
<body style="margin:0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#f6f7f4;padding:24px;">
  <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e3e6de;border-radius:10px;padding:28px;">
    <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7263;">Replicate This — moderation</p>
    ${body}
  </div>
</body>
</html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}

function message(title: string, detail: string, status = 200) {
  return page(
    title,
    `<h1 style="margin:0 0 12px;font-size:20px;color:#1f241c;">${escapeHtml(title)}</h1>
     <p style="margin:0;font-size:14px;color:#3d443a;line-height:1.5;">${detail}</p>`,
    status,
  )
}

const queueLink = `<a href="${escapeHtml(`${config.webAppUrl}/admin`)}" style="color:#1a7f4e;">moderation queue</a>`

/**
 * Validates the token and re-checks the acting user. Returns the payload and
 * nomination, or a ready-to-send error page.
 */
async function authorize(
  token: string,
): Promise<{ payload: ReviewTokenPayload; nomination: ReviewNomination } | Response> {
  const payload = verifyReviewToken(token)
  if (!payload) {
    return message(
      'This link is invalid or has expired',
      `Review links expire after 14 days. Use the ${queueLink} instead.`,
      400,
    )
  }

  const [admin] = await db
    .select({ role: schema.user.role, deleted: schema.user.deleted })
    .from(schema.user)
    .where(eq(schema.user.id, payload.adminUid))
    .limit(1)
  if (!admin || admin.deleted || admin.role !== 'maintainer') {
    return message(
      'Not authorised',
      'This review link belongs to an account that is no longer a maintainer.',
      403,
    )
  }

  const nomination = await loadReviewNomination(payload.nominationId)
  if (!nomination) {
    return message('Nomination not found', 'It may have been removed.', 404)
  }
  return { payload, nomination }
}

function alreadyReviewed(n: ReviewNomination) {
  return message(
    'Already reviewed',
    `This nomination is no longer pending — its current status is <strong>${escapeHtml(n.status)}</strong>. Nothing was changed. See the ${queueLink}.`,
  )
}

function reviewPage(token: string, n: ReviewNomination, opts: { rejectError?: string } = {}) {
  const action = `/api/email-actions/review/${encodeURIComponent(token)}`
  return page(
    'Review nomination',
    `<h1 style="margin:0 0 16px;font-size:20px;color:#1f241c;">Review this nomination</h1>
    ${detailsTableHtml(n)}
    <div style="margin-top:24px;display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start;">
      <form method="post" action="${escapeHtml(action)}" style="margin:0;">
        <input type="hidden" name="action" value="approve">
        <button type="submit" style="padding:10px 26px;border:none;border-radius:6px;background:#1a7f4e;color:#fff;font-size:14px;font-weight:600;cursor:pointer;">Approve</button>
      </form>
      <form method="post" action="${escapeHtml(action)}" style="margin:0;flex:1;min-width:260px;">
        <input type="hidden" name="action" value="reject">
        <textarea name="reason" required rows="2" placeholder="Rejection reason (required, sent to the nominator)"
          style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #e3e6de;border-radius:6px;font:inherit;font-size:13px;"></textarea>
        ${opts.rejectError ? `<p style="margin:6px 0 0;font-size:12px;color:#b3261e;">${escapeHtml(opts.rejectError)}</p>` : ''}
        <button type="submit" style="margin-top:8px;padding:10px 26px;border:none;border-radius:6px;background:#b3261e;color:#fff;font-size:14px;font-weight:600;cursor:pointer;">Reject</button>
      </form>
    </div>
    <p style="margin:18px 0 0;font-size:12px;color:#6b7263;">Prefer the app? Open the ${queueLink}.</p>`,
    opts.rejectError ? 400 : 200,
  )
}

// Confirmation page linked from the email buttons.
emailActionsRouter.get('/review/:token', async (c) => {
  const auth = await authorize(c.req.param('token'))
  if (auth instanceof Response) return auth
  const { nomination } = auth
  if (nomination.status !== 'pending') return alreadyReviewed(nomination)
  return reviewPage(c.req.param('token'), nomination)
})

// Performs the decision (form post from the confirmation page).
emailActionsRouter.post('/review/:token', async (c) => {
  const token = c.req.param('token')
  const auth = await authorize(token)
  if (auth instanceof Response) return auth
  const { payload, nomination } = auth

  const body = await c.req.parseBody()
  const action = String(body.action ?? '')
  const reason = String(body.reason ?? '').trim()

  if (action === 'approve') {
    const result = await approveNomination(payload.adminUid, payload.nominationId)
    if (result === 'not_pending') return alreadyReviewed(nomination)
    return message(
      'Nomination approved ✓',
      `“${escapeHtml(nomination.metadata.title || nomination.doi)}” is now open in the public registry. The nominator has been notified.`,
    )
  }

  if (action === 'reject') {
    if (!reason) return reviewPage(token, nomination, { rejectError: 'A rejection reason is required.' })
    const result = await rejectNomination(payload.adminUid, payload.nominationId, reason, {
      onlyPending: true,
    })
    if (result === 'not_pending') return alreadyReviewed(nomination)
    return message(
      'Nomination rejected',
      `“${escapeHtml(nomination.metadata.title || nomination.doi)}” was rejected. The nominator has been notified with your reason.`,
    )
  }

  return message('Unknown action', 'The request was not understood.', 400)
})
