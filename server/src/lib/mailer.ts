import { config } from '@/lib/env'

/**
 * Best-effort transactional email via Postmark (EU-compliant, per the spec).
 * Until POSTMARK_API_TOKEN is set it no-ops and logs, so callers never break.
 * Returns true only when an email was actually accepted.
 */
export async function sendEmail(opts: {
  to: string
  subject: string
  text: string
  // Optional rich body; the plain-text version is always sent as fallback.
  html?: string
}): Promise<boolean> {
  if (!config.postmark.token) {
    console.log(`[email:stub] to=${opts.to} subject="${opts.subject}"`)
    return false
  }
  try {
    const res = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Postmark-Server-Token': config.postmark.token,
      },
      body: JSON.stringify({
        From: config.postmark.from,
        To: opts.to,
        Subject: opts.subject,
        TextBody: opts.text,
        ...(opts.html ? { HtmlBody: opts.html } : {}),
        MessageStream: 'outbound',
      }),
    })
    if (!res.ok) {
      console.error(`[email] Postmark returned ${res.status}`)
      return false
    }
    return true
  } catch (err) {
    console.error('[email] send failed', err)
    return false
  }
}
