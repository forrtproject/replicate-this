import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useMyContributions } from '@/features/contributions/api'
import {
  useNotifications,
  useMarkNotificationsRead,
  notificationLabel,
} from '@/features/notifications/api'
import { StatusBadge } from '@/features/nominations/StatusBadge'
import type { NominationSummary, NominationStatus } from '@/types'

interface MyNomination {
  id: string
  doi: string
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
  const nominations = useMyNominations()
  const contributions = useMyContributions()
  const notifications = useNotifications()
  const markRead = useMarkNotificationsRead()

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="eyebrow">Your workspace</p>
          <h1 className="mt-1 font-display text-3xl font-semibold">Dashboard</h1>
        </div>
        <Link to="/profile" className="text-sm text-green hover:underline">
          Edit your profile →
        </Link>
      </div>

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
          {notifications.data?.notifications.slice(0, 10).map((n) => (
            <div
              key={n.id}
              className={`rounded-md border px-3 py-2 text-sm ${
                n.readAt ? 'border-border text-muted-foreground' : 'border-primary/40 bg-accent'
              }`}
            >
              {notificationLabel(n)}{' '}
              {typeof n.data.nominationId === 'string' && (
                <Link
                  to={`/nominations/${n.data.nominationId}`}
                  className="text-primary underline"
                >
                  view
                </Link>
              )}
            </div>
          ))}
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
          {contributions.data?.length === 0 && <Empty>No contributions yet.</Empty>}
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
      </section>
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
