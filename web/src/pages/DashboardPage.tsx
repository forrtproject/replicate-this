import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Compass, FilePlus2, UserRound } from 'lucide-react'
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
import { VERIFICATION_CONFIG } from '@/features/nominations/verification'
import { formatDate, formatWhen } from '@/lib/dates'
import type { NominationSummary, NominationStatus } from '@/types'
import { usePageTitle } from '@/lib/page-title'

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
  usePageTitle('Dashboard')
  const { data: session } = useSession()
  const nominations = useMyNominations()
  const contributions = useMyContributions()
  const notifications = useNotifications()
  const markRead = useMarkNotificationsRead()
  const markOneRead = useMarkNotificationRead()
  const { data: all } = useNominations()
  const titles = new Map((all ?? []).map((n) => [n.id, n.metadata.title || n.doi || 'Untitled']))
  for (const n of nominations.data ?? []) titles.set(n.id, n.metadata?.title || n.doi || 'Untitled')

  const isNew =
    nominations.data?.length === 0 && contributions.data?.length === 0
  const unread = notifications.data?.unread ?? 0

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-10">
      <div className="mb-8">
        <h1 className="font-display text-[2rem] font-semibold leading-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as <span className="text-ink">{session?.user?.name}</span>.{' '}
          <Link to="/profile" className="text-forest underline-offset-2 hover:underline">
            Edit profile
          </Link>
        </p>
      </div>

      {isNew && <GetStarted />}

      <div className="grid gap-x-12 gap-y-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-12">
          <section aria-labelledby="notifications">
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 id="notifications" className="section-title">
                Notifications
                {unread > 0 && (
                  <span className="ml-2 font-sans text-sm font-medium text-forest">{unread} new</span>
                )}
              </h2>
              {unread > 0 && (
                <button
                  onClick={() => markRead.mutate()}
                  className="text-sm text-muted-foreground hover:text-ink hover:underline"
                >
                  Mark all as read
                </button>
              )}
            </div>
            {notifications.data?.notifications.length === 0 ? (
              <Empty>Nothing new. You’ll hear here when someone joins, comments or reviews your nominations.</Empty>
            ) : (
              <ul className="divide-y divide-line rounded-lg border border-line bg-card">
                {notifications.data?.notifications.slice(0, 10).map((n) => {
                  const href = notificationHref(n)
                  const id = typeof n.data.nominationId === 'string' ? n.data.nominationId : null
                  const study = id ? titles.get(id) : null
                  const className =
                    'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#f6f5ef]'
                  const markIfUnread = () => {
                    if (!n.readAt) markOneRead.mutate(n.id)
                  }
                  const body = (
                    <>
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? 'bg-transparent' : 'bg-green'}`}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm ${n.readAt ? 'text-muted-foreground' : 'font-medium text-ink'}`}>
                          {notificationLabel(n)}
                          {!n.readAt && <span className="sr-only"> (unread)</span>}
                        </span>
                        {study && (
                          <span className="mt-0.5 block text-[0.8125rem] text-muted-foreground">{study}</span>
                        )}
                      </span>
                      <span className="shrink-0 pt-0.5 text-xs text-muted-foreground">{formatWhen(n.createdAt)}</span>
                      {href && <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
                    </>
                  )
                  return (
                    <li key={n.id}>
                      {href ? (
                        <Link to={href} onClick={markIfUnread} className={className}>
                          {body}
                        </Link>
                      ) : (
                        <button onClick={markIfUnread} className={className}>
                          {body}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="mine">
            <h2 id="mine" className="section-title mb-3">
              Your nominations
            </h2>
            {nominations.data?.length === 0 ? (
              <Empty>
                You haven’t nominated anything yet.{' '}
                <Link to="/nominate" className="font-medium text-forest underline">
                  Nominate a study
                </Link>
              </Empty>
            ) : (
              <StudyList
                items={(nominations.data ?? []).map((n) => ({
                  id: n.id,
                  title: n.metadata?.title || n.doi || 'Untitled',
                  status: n.status,
                  note: `Nominated ${formatDate(n.createdAt)}`,
                }))}
              />
            )}
          </section>

          <section aria-labelledby="teams">
            <h2 id="teams" className="section-title mb-3">
              Your study teams
            </h2>
            {contributions.data?.length === 0 ? (
              <Empty>You haven’t joined a study team yet. Studies looking for contributors are listed alongside.</Empty>
            ) : (
              <StudyList
                items={(contributions.data ?? []).map((c) => {
                  const n = c.nomination as NominationSummary
                  return {
                    id: n.id,
                    title: n.metadata?.title || n.doi || 'Untitled',
                    status: n.status,
                    note: `${n.contributions} on the team`,
                  }
                })}
              />
            )}
          </section>
        </div>

        <aside>{contributions.data && <LookingForContributors />}</aside>
      </div>
    </div>
  )
}

function StudyList({
  items,
}: {
  items: { id: string; title: string; status: NominationStatus; note: string }[]
}) {
  return (
    <ul className="divide-y divide-line rounded-lg border border-line bg-card">
      {items.map((n) => (
        <li key={n.id}>
          <Link
            to={`/nominations/${n.id}`}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[#f6f5ef]"
          >
            <span className="min-w-0 flex-1">
            <span className="block font-display text-[1.0625rem] font-semibold leading-snug text-ink">
              {n.title}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-4 text-[0.8125rem] text-muted-foreground">
              <StatusBadge status={n.status} className="text-[0.8125rem]" />
              <span>{n.note}</span>
            </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** First-visit orientation: the three things worth doing first. */
function GetStarted() {
  const steps = [
    {
      to: '/nominations?status=approved',
      icon: Compass,
      title: 'Find a study to work on',
      body: 'Studies marked “Looking for contributors” are waiting for a team. Join one and contact the other members from its page.',
    },
    {
      to: '/nominate',
      icon: FilePlus2,
      title: 'Nominate a study',
      body: 'Add a finding that deserves a second look. It takes a couple of minutes.',
    },
    {
      to: '/profile',
      icon: UserRound,
      title: 'Complete your profile',
      body: 'Add your ORCID and links so collaborators can find and credit you.',
    },
  ]
  return (
    <section className="mb-12 rounded-lg border border-line bg-card p-5" aria-labelledby="start">
      <h2 id="start" className="section-title">
        Where to start
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {steps.map(({ to, icon: Icon, title, body }) => (
          <Link
            key={to}
            to={to}
            className="group rounded-md border border-line p-4 transition-colors hover:border-green"
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
    .slice(0, 4)

  if (!all) return null
  return (
    <section aria-labelledby="open-studies">
      <h2 id="open-studies" className="section-title">
        Looking for contributors
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Open studies with the smallest teams, where another person helps most.
      </p>
      {suggestions.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No open studies need a team right now. Check back soon, or{' '}
          <Link to="/nominate" className="text-forest underline">
            nominate one
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-card">
          {suggestions.map((n) => (
            <li key={n.id}>
              <Link to={`/nominations/${n.id}`} className="group block px-4 py-3 hover:bg-[#f6f5ef]">
                <span className="block font-display text-[1rem] font-semibold leading-snug text-ink">
                  {n.metadata.title || n.doi}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {VERIFICATION_CONFIG[n.verificationType].short},{' '}
                  {n.contributions === 0 ? 'no team yet' : `${n.contributions} on the team`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link
        to="/nominations?status=approved"
        className="mt-4 inline-block text-sm font-medium text-forest hover:underline"
      >
        See all open studies
      </Link>
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm leading-relaxed text-muted-foreground">
      {children}
    </p>
  )
}
