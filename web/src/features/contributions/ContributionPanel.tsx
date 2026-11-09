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
  type Contributor,
} from './api'
import { ResearcherLink } from '@/features/profile/ResearcherLink'
import { ContactLinks } from '@/features/profile/ContactLinks'
import { AvatarBubble } from '@/features/profile/AvatarEditor'
// Slack integration is on hold. The SlackJoinPanel and its backend are kept
// intact but not rendered. Re-import and restore the block below to re-enable.
import { APPROACH_COPY } from '@/features/nominations/verification'
import type { NominationDetail } from '@/types'
import { formatDate } from '@/lib/dates'

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
  const copy = APPROACH_COPY[n.verificationType] ?? APPROACH_COPY.both
  const requireLogin = () => navigate(`/sign-in?redirect=/nominations/${n.id}`)

  // Roster of the study team, shown once the study is in progress.
  const showRoster = n.status === 'in_progress' || n.contributions > 0
  const { data: team } = useContributors(n.id, showRoster)
  const contributors = team?.contributors
  const viewerOnTeam = team?.viewerOnTeam ?? false
  const shareEmail = useShareEmail(n.id)

  // Teammates the viewer could still share their email with (on the team, not self,
  // not already shared with).
  const unsharedTeammates =
    contributors?.filter((ct) => ct.uid && !ct.isSelf && !ct.youSharedWithThem) ?? []
  // Only draw the divider under the roster when there's something to put in it:
  // the share-with-everyone button, or the prompt to add an address first.
  const showShareRow =
    viewerOnTeam && (!team?.viewerHasEmail || unsharedTeammates.length > 0)

  const done = n.status === 'completed' || n.status === 'published'
  const [showInquiry, setShowInquiry] = useState(false)

  return (
    <section className="rounded-lg border border-line bg-card p-4" aria-labelledby="team">
      <h2 id="team" className="label">
        {copy.team}
        {contributors && contributors.length > 0 && (
          <span className="data ml-1.5 font-normal text-muted-foreground">{contributors.length}</span>
        )}
      </h2>

      {/* Study team roster */}
      {showRoster && contributors && contributors.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {contributors.map((ct) => (
            <li key={ct.token} className="flex gap-2.5 text-sm">
              <AvatarBubble image={ct.image} name={ct.name} className="h-8 w-8 shrink-0 text-base" />
              <div className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2">
                  <ResearcherLink name={ct.name} token={ct.token} className="font-medium text-ink" />
                  <ContactLinks links={ct.links} />
                </span>
                <span className="block text-xs text-muted-foreground">Joined {formatDate(ct.createdAt)}</span>
                {ct.message && (
                  <p className="mt-1 text-xs leading-relaxed text-ink/80">{ct.message}</p>
                )}
                {viewerOnTeam && !ct.isSelf && (
                  <TeammateEmail
                    ct={ct}
                    onShare={() => shareEmail.mutate({ recipientUid: ct.uid })}
                    busy={shareEmail.isPending}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          {done ? 'No team members listed.' : 'No one has joined yet.'}
        </p>
      )}

      {showShareRow && (
        <div className="mt-3 border-t border-line pt-3">
          {team?.viewerHasEmail ? (
            <button
              onClick={() => shareEmail.mutate({ all: true })}
              disabled={shareEmail.isPending}
              className="btn-secondary btn-sm"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden />
              Share my email with the whole team
            </button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Add a notification email in your{' '}
              <Link to="/profile" className="text-forest underline">
                profile
              </Link>{' '}
              to share it with teammates.
            </p>
          )}
        </div>
      )}

      {/* Joining */}
      {!done && (
        <div className="mt-4 border-t border-line pt-4">
          {!session ? (
            <p className="text-sm text-muted-foreground">{copy.joinHint}</p>
          ) : isOwner ? (
            <p className="text-sm text-muted-foreground">
              You nominated this study. You’ll be notified when someone joins.
            </p>
          ) : n.userContributed ? (
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-forest">
                <Check className="h-4 w-4" aria-hidden /> You’re on the team
              </span>
              <button
                onClick={() => withdraw.mutate()}
                className="text-xs text-muted-foreground underline hover:text-destructive"
              >
                Leave
              </button>
            </div>
          ) : showForm ? (
            <div className="space-y-2">
              <label htmlFor="join-message" className="block text-sm font-medium">
                Introduce yourself <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id="join-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Expertise, lab capacity, timeline"
                className="input"
              />
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    contribute.mutate(message, { onSuccess: () => setShowForm(false) })
                  }
                  disabled={contribute.isPending}
                  className="btn-primary"
                >
                  {contribute.isPending ? 'Joining…' : 'Join the team'}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => (session ? setShowForm(true) : requireLogin())}
                // Before review, approving is the page's main action, not joining.
                className={`w-full ${n.status === 'pending' ? 'btn-secondary' : 'btn-primary'}`}
              >
                {copy.join}
              </button>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{copy.joinHint}</p>
            </>
          )}
        </div>
      )}

      {/* Message the nominator and team (Slack integration on hold; backend retained). */}
      {session && !isOwner && (
        <div className="mt-4 border-t border-line pt-4">
          {inquirySent ? (
            <p className="text-sm text-forest">Message sent. The team will see it in their notifications.</p>
          ) : showInquiry ? (
            <div className="space-y-2">
              <label htmlFor="inquiry" className="block text-sm font-medium">
                {n.contributions > 0 ? 'Message the nominator and team' : 'Message the nominator'}
              </label>
              <textarea
                id="inquiry"
                value={inquiryText}
                onChange={(e) => setInquiryText(e.target.value)}
                rows={3}
                className="input"
              />
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    inquiry.mutate(inquiryText, {
                      onSuccess: () => {
                        setInquirySent(true)
                        setInquiryText('')
                      },
                    })
                  }
                  disabled={inquiry.isPending || inquiryText.trim().length < 5}
                  className="btn-secondary"
                >
                  {inquiry.isPending ? 'Sending…' : 'Send message'}
                </button>
                <button
                  onClick={() => setShowInquiry(false)}
                  className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowInquiry(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-forest hover:underline"
            >
              <Mail className="h-4 w-4" aria-hidden /> {n.contributions > 0 ? 'Message the team' : 'Message the nominator'}
            </button>
          )}
        </div>
      )}

    </section>
  )
}

/**
 * Per-teammate email row: shows the email they've shared with you (if any) and
 * a control to share yours with them.
 */
function TeammateEmail({
  ct,
  onShare,
  busy,
}: {
  ct: Contributor
  onShare: () => void
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
        <span className="text-muted-foreground">Email not shared with you</span>
      )}
      {ct.youSharedWithThem ? (
        <span className="inline-flex items-center gap-1 text-green">
          <Check className="h-3 w-3" /> You shared your email
        </span>
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
