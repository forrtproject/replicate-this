import { Link } from 'react-router-dom'
import { EyeOff, Eye, Flag, Check } from 'lucide-react'
import { useAdminComments, useHideComment, type AdminComment } from '@/features/admin/api'
import { AdminPageHeader } from '@/features/admin/AdminTabs'
import { ResearcherLink } from '@/features/profile/ResearcherLink'
import { formatWhen } from '@/lib/dates'
import { RichText } from '@/components/ui/RichText'
import { usePageTitle } from '@/lib/page-title'

export function CommentsModerationPage() {
  usePageTitle('Comment moderation')
  const { data: comments, isLoading } = useAdminComments()

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-10">
      <AdminPageHeader
        intro="Comments people flagged come first, then recent comments on all nominations. Hide anything off-topic or against the Code of Conduct: it leaves the public thread but is kept for the record. Hiding or keeping a flagged comment closes its flags."
      />

      {isLoading && <p className="text-sm text-muted-foreground">Loading comments…</p>}
      {comments?.length === 0 && (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      )}

      {comments && comments.length > 0 && (
        <>
          <Group
            title="Flagged"
            empty="No open flags."
            items={comments.filter((c) => c.openFlags > 0 && !c.hidden)}
          />
          <Group
            title="Recent comments"
            empty="No other comments."
            items={comments.filter((c) => !(c.openFlags > 0 && !c.hidden))}
          />
        </>
      )}
    </div>
  )
}

function Group({ title, empty, items }: { title: string; empty: string; items: AdminComment[] }) {
  return (
    <section className="mb-12" aria-label={title}>
      <h2 className="section-title mb-3">
        {title}
        {items.length > 0 && (
          <span className="data ml-2 font-sans text-base font-normal text-muted-foreground">{items.length}</span>
        )}
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-card">
          {items.map((c) => (
            <li key={c.id}>
              <Row comment={c} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Row({ comment: c }: { comment: AdminComment }) {
  const hide = useHideComment()
  return (
    <div
      className={`p-5 ${c.hidden ? 'opacity-75' : ''}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-sm text-muted-foreground">
            <ResearcherLink name={c.authorName} token={c.authorToken} className="font-medium text-ink" /> on{' '}
            <Link to={`/nominations/${c.nominationId}`} className="text-ink underline decoration-line underline-offset-2 hover:text-forest">
              {c.nominationTitle || 'a nomination'}
            </Link>
            <span className="ml-2 text-xs">{formatWhen(c.createdAt)}</span>
            {c.hidden && <span className="ml-2 text-xs font-medium text-amber">Hidden</span>}
          </p>
          <RichText className="text-[0.9375rem] leading-relaxed">{c.content}</RichText>
          {c.openFlags > 0 && (
            <div className="mt-3 rounded-md bg-amber/10 px-3 py-2 text-sm text-ink">
              <p className="inline-flex items-center gap-1.5 font-medium text-amber">
                <Flag className="h-3.5 w-3.5" aria-hidden />
                Flagged by {c.openFlags} {c.openFlags === 1 ? 'person' : 'people'}
              </p>
              {c.flagReasons.length > 0 && (
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {c.flagReasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-shrink-0 gap-2">
          {c.openFlags > 0 && !c.hidden ? (
            <>
              <button
                onClick={() => hide.mutate({ id: c.id, hidden: true })}
                disabled={hide.isPending}
                className="btn-secondary btn-sm"
              >
                <EyeOff className="h-4 w-4" aria-hidden /> Hide
              </button>
              <button
                onClick={() => hide.mutate({ id: c.id, hidden: false })}
                disabled={hide.isPending}
                title="Dismiss the flags and leave the comment up"
                className="btn-secondary btn-sm"
              >
                <Check className="h-4 w-4" aria-hidden /> Keep
              </button>
            </>
          ) : (
            <button
              onClick={() => hide.mutate({ id: c.id, hidden: !c.hidden })}
              disabled={hide.isPending}
              className="btn-secondary btn-sm"
            >
              {c.hidden ? <Eye className="h-4 w-4" aria-hidden /> : <EyeOff className="h-4 w-4" aria-hidden />}
              {c.hidden ? 'Restore' : 'Hide'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
