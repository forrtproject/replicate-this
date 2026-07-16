import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, Mail } from 'lucide-react'
import { useSession } from '@/lib/auth-client'
import {
  useContribute,
  useWithdrawContribution,
  useSendInquiry,
  useContributors,
  useShareEmail,
  useUnshareEmail,
  type Contributor,
} from './api'
import { researcherLabel } from '@/features/nominations/format'
import { ContactLinks } from '@/features/profile/ContactLinks'
import { AvatarBubble } from '@/features/profile/AvatarEditor'
// Slack integration is on hold — the SlackJoinPanel and its backend are kept
// intact but not rendered. Re-import and restore the block below to re-enable.
import type { NominationDetail } from '@/types'

export function ContributionPanel({ nomination: n }: { nomination: NominationDetail }) {
  const { data: session } = useSession()
  const navigate = useNavigate()
  const contribute = useContribute(n.id)
  const withdraw = useWithdrawContribution(n.id)
  const inquiry = useSendInquiry(n.id)

  const [message, setMessage] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [inquiryText, setInquiryText] = useState('')
  const [inquirySent, setInquirySent] = useState(false)

  const isOwner = n.viewerIsNominator
  const requireLogin = () => navigate(`/sign-in?redirect=/nominations/${n.id}`)

  // Roster of the replication team, shown once the study is in progress.
  const showRoster = n.status === 'in_progress' || n.contributions > 0
  const { data: team } = useContributors(n.id, showRoster)
  const contributors = team?.contributors
  const viewerOnTeam = team?.viewerOnTeam ?? false
  const shareEmail = useShareEmail(n.id)
  const unshareEmail = useUnshareEmail(n.id)

  // Teammates the viewer could still share their email with (on the team, not self,
  // not already shared with).
  const unsharedTeammates =
    contributors?.filter((ct) => ct.uid && !ct.isSelf && !ct.youSharedWithThem) ?? []

  return (
    <div className="space-y-6 rounded-lg border border-border bg-card p-4">
      {/* Replication team roster */}
      {showRoster && contributors && contributors.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">
            Replication team ({contributors.length})
          </h2>
          <ul className="space-y-2">
            {contributors.map((ct) => (
              <li key={ct.token} className="flex gap-2.5 text-sm">
                <AvatarBubble
                  image={ct.image}
                  name={ct.name}
                  className="mt-0.5 h-8 w-8 shrink-0 text-base"
                />
                <div className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2">
                    <span className="font-medium">{researcherLabel(ct.name, ct.token)}</span>
                    <ContactLinks links={ct.links} />
                    <span className="text-xs text-muted-foreground">
                      · joined{' '}
                      {new Date(ct.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </span>
                  {ct.message && (
                    <p className="mt-0.5 text-xs text-muted-foreground">“{ct.message}”</p>
                  )}
                  {viewerOnTeam && !ct.isSelf && (
                    <TeammateEmail
                      ct={ct}
                      onShare={() => shareEmail.mutate({ recipientUid: ct.uid })}
                      onUnshare={() => unshareEmail.mutate({ recipientUid: ct.uid })}
                      busy={shareEmail.isPending || unshareEmail.isPending}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>

          {viewerOnTeam && (
            <div className="mt-3 border-t border-border pt-3">
              {team?.viewerHasEmail ? (
                unsharedTeammates.length > 0 && (
                  <button
                    onClick={() => shareEmail.mutate({ all: true })}
                    disabled={shareEmail.isPending}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Share my email with the whole team
                  </button>
                )
              ) : (
                <p className="text-xs text-muted-foreground">
                  Add a notification email in your{' '}
                  <Link to="/profile" className="text-green underline">
                    profile
                  </Link>{' '}
                  to share it with teammates.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* Contribute */}
      <section className={showRoster && contributors?.length ? 'border-t border-border pt-4' : ''}>
        <h2 className="mb-1 text-sm font-semibold">Replicate this study</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Signal your intent to run a replication. Contributions are accepted
          automatically — no approval needed.
        </p>

        {isOwner ? (
          <p className="text-sm text-muted-foreground">You nominated this study.</p>
        ) : n.userContributed ? (
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 text-sm text-primary">
              <Check className="h-4 w-4" /> You’re contributing
            </span>
            <button
              onClick={() => withdraw.mutate()}
              className="text-xs text-muted-foreground underline hover:text-destructive"
            >
              Withdraw
            </button>
          </div>
        ) : showForm ? (
          <div className="space-y-2">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Optional: your expertise, lab readiness, timeline…"
              className="input"
            />
            <div className="flex gap-2">
              <button
                onClick={() =>
                  contribute.mutate(message, { onSuccess: () => setShowForm(false) })
                }
                disabled={contribute.isPending}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {contribute.isPending ? 'Joining…' : 'Confirm'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => (session ? setShowForm(true) : requireLogin())}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Contribute to this study
          </button>
        )}
      </section>

      {/* Team Slack channel — integration on hold, UI hidden (backend retained). */}

      {/* Inquiry */}
      {!isOwner && (
        <section className="border-t border-border pt-4">
          <h2 className="mb-1 text-sm font-semibold">Contact the team</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Send a message to the nominator and contributors. They’ll be notified in-app.
          </p>
          {inquirySent ? (
            <p className="text-sm text-primary">Message sent.</p>
          ) : (
            <div className="space-y-2">
              <textarea
                value={inquiryText}
                onChange={(e) => setInquiryText(e.target.value)}
                rows={3}
                placeholder="Your question or offer…"
                className="input"
              />
              <button
                onClick={() =>
                  session
                    ? inquiry.mutate(inquiryText, {
                        onSuccess: () => {
                          setInquirySent(true)
                          setInquiryText('')
                        },
                      })
                    : requireLogin()
                }
                disabled={inquiry.isPending || inquiryText.trim().length < 5}
                className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-60"
              >
                {inquiry.isPending ? 'Sending…' : 'Send message'}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

/**
 * Per-teammate email row: shows the email they've shared with you (if any) and
 * a control to share yours with them (or revoke it).
 */
function TeammateEmail({
  ct,
  onShare,
  onUnshare,
  busy,
}: {
  ct: Contributor
  onShare: () => void
  onUnshare: () => void
  busy: boolean
}) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pl-0.5 text-xs">
      {ct.email ? (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Mail className="h-3 w-3" />
          <a href={`mailto:${ct.email}`} className="text-green hover:underline">
            {ct.email}
          </a>
        </span>
      ) : (
        <span className="text-muted-foreground/70">Email not shared with you</span>
      )}
      {ct.youSharedWithThem ? (
        <button
          onClick={onUnshare}
          disabled={busy}
          className="inline-flex items-center gap-1 text-green underline-offset-2 hover:underline disabled:opacity-60"
        >
          <Check className="h-3 w-3" /> You shared your email — undo
        </button>
      ) : (
        <button
          onClick={onShare}
          disabled={busy}
          className="text-muted-foreground underline hover:text-green disabled:opacity-60"
        >
          Share your email
        </button>
      )}
    </div>
  )
}
