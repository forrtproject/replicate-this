import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Compass, FilePlus2, Sparkles, UserRound, Users } from 'lucide-react'
import { api } from '@/lib/api'
import { useSession } from '@/lib/auth-client'
import { useMyContributions } from '@/features/contributions/api'
import { useNominations } from '@/features/nominations/api'
import {
  useNotifications,
  useMarkNotificationsRead,
  useMarkNotificationRead,
  notificationLabel,
  notificationHref,
} from '@/features/notifications/api'
import { StatusBadge } from '@/features/nominations/StatusBadge'
import { VerificationBadge } from '@/features/nominations/VerificationBadge'
import type { NominationSummary, NominationStatus } from '@/types'

interface MyNomination {
  id: string
  doi: string | null
  metadata: { title: string }
  discipline: string
  status: NominationStatus
  createdAt: string
}

function useMyNominations() {
  return useQuery({
    queryKey: ['nominations', 'mine'],
    queryFn: () => api.get<{ nominations: MyNomination[] }>('/nominations/mine'),
    select: (d) => d.nominations,
  })
}

export function DashboardPage() {
  const { data: session } = useSession()
  const nominations = useMyNominations()
  const contributions = useMyContributions()
  const notifications = useNotifications()
  const markRead = useMarkNotificationsRead()
  const markOneRead = useMarkNotificationRead()

  const isNew =
    nominations.data?.length === 0 && contributions.data?.length === 0

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="eyebrow">Your workspace</p>
          <h1 className="mt-1 font-display text-3xl font-semibold">
            {session?.user?.name ? `Hello, ${session.user.name}` : 'Dashboard'}
          </h1>
        </div>
        <Link to="/profile" className="text-sm text-green hover:underline">
          Edit your profile →
        </Link>
      </div>

      {isNew && <GetStarted />}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Notifications {notifications.data?.unread ? `(${notifications.data.unread} new)` : ''}
          </h2>
          {!!notifications.data?.unread && (
            <button
              onClick={() => markRead.mutate()}
              className="text-xs text-primary underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="space-y-1.5">
          {notifications.data?.notifications.length === 0 && (
            <Empty>No notifications.</Empty>
          )}
          {notifications.data?.notifications.slice(0, 10).map((n) => {
            const href = notificationHref(n)
            const welcome = n.type === 'welcome'
            const className = `flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
              n.readAt
                ? 'border-border text-muted-foreground'
                : 'border-primary/40 bg-accent hover:border-primary'
            }`
            const markIfUnread = () => {
              if (!n.readAt) markOneRead.mutate(n.id)
            }
            const body = (
              <>
                {welcome && <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-green" />}
                <span>{notificationLabel(n)}</span>
              </>
            )
            return href ? (
              <Link key={n.id} to={href} onClick={markIfUnread} className={className}>
                {body}
              </Link>
            ) : (
              <button key={n.id} onClick={markIfUnread} className={className}>
                {body}
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          My nominations
        </h2>
        <div className="space-y-2">
          {nominations.data?.length === 0 && (
            <Empty>
              You haven’t nominated anything yet.{' '}
              <Link to="/nominate" className="text-primary underline">
                Nominate a study.
              </Link>
            </Empty>
          )}
          {nominations.data?.map((n) => (
            <div
              key={n.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2"
            >
              <Link to={`/nominations/${n.id}`} className="truncate text-sm hover:text-primary">
                {n.metadata?.title || n.doi}
              </Link>
              <StatusBadge status={n.status} />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Studies I’m contributing to
        </h2>
        <div className="space-y-2">
          {contributions.data?.map((c) => {
            const n = c.nomination as NominationSummary
            return (
              <div
                key={c.nominationId}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2"
              >
                <Link
                  to={`/nominations/${n.id}`}
                  className="truncate text-sm hover:text-primary"
                >
                  {n.metadata?.title || n.doi}
                </Link>
                <StatusBadge status={n.status} />
              </div>
            )
          })}
        </div>
        {contributions.data && <LookingForContributors />}
      </section>
    </div>
  )
}

/** First-visit orientation: the three things worth doing first. */
function GetStarted() {
  const steps = [
    {
      to: '/nominations?status=approved',
      icon: Compass,
      title: 'Find a study to work on',
      body: 'Open nominations are waiting for a team. Join one and coordinate in its Slack channel.',
    },
    {
      to: '/nominate',
      icon: FilePlus2,
      title: 'Nominate a study',
      body: 'Know a finding that deserves a second look? Add it in a couple of minutes.',
    },
    {
      to: '/profile',
      icon: UserRound,
      title: 'Complete your profile',
      body: 'Add your ORCID and links so collaborators can find and credit you.',
    },
  ]
  return (
    <section className="rounded-xl border border-green/30 bg-green-tint p-5">
      <p className="eyebrow">Get started</p>
      <h2 className="mt-1 font-display text-xl font-semibold">
        Welcome! Here’s where you can make a difference.
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {steps.map(({ to, icon: Icon, title, body }) => (
          <Link
            key={to}
            to={to}
            className="group rounded-lg border border-line bg-card p-4 transition-colors hover:border-green"
          >
            <Icon className="h-5 w-5 text-green" />
            <p className="mt-2 font-medium group-hover:text-green">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}

/**
 * Suggestions under "Studies I'm contributing to": open studies the user isn't
 * part of, fewest contributors first — the ones a new teammate helps most.
 */
function LookingForContributors() {
  const { data: all } = useNominations()
  const suggestions = (all ?? [])
    .filter((n) => n.status === 'approved' && !n.userContributed && !n.viewerIsNominator)
    .sort((a, b) => a.contributions - b.contributions || b.upvotes - a.upvotes)
    .slice(0, 3)

  if (!all) return null
  return (
    <div className="mt-4 rounded-lg border border-dashed border-line p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">Looking for contributors</p>
        <Link to="/nominations?status=approved" className="text-xs text-green hover:underline">
          All open studies →
        </Link>
      </div>
      {suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No open studies need a team right now — check back soon, or{' '}
          <Link to="/nominate" className="text-green underline">
            nominate one
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-2">
          {suggestions.map((n) => (
            <li key={n.id}>
              <Link
                to={`/nominations/${n.id}`}
                className="flex items-center justify-between gap-3 rounded-md border border-line bg-card px-3 py-2 hover:border-green"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm">{n.metadata.title || n.doi}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <VerificationBadge type={n.verificationType} />
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {n.contributions === 0 ? 'No team yet' : `${n.contributions} contributing`}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-xs font-medium text-green">Join →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}
