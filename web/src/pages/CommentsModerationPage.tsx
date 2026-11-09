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
        title="Moderate comments"
        intro="Recent comments on all nominations, flagged ones first. Hide anything off-topic or against the Code of Conduct: it leaves the public thread but is kept for the record. Hiding or keeping a flagged comment closes its flags."
      />

      {isLoading && <p className="text-sm text-muted-foreground">Loading comments…</p>}
      {comments?.length === 0 && (
        <p className="rounded-lg border border-line bg-card px-4 py-5 text-sm text-muted-foreground">
          No comments yet.
        </p>
      )}

      <div className="space-y-3">
        {comments?.map((c) => <Row key={c.id} comment={c} />)}
      </div>
    </div>
  )
}

function Row({ comment: c }: { comment: AdminComment }) {
  const hide = useHideComment()
  return (
    <div
      className={`rounded-lg border bg-card p-5 ${
        c.openFlags > 0 && !c.hidden ? 'border-amber/50 border-l-4 border-l-amber' : 'border-line'
      } ${c.hidden ? 'opacity-75' : ''}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-sm text-muted-foreground">
            <ResearcherLink name={c.authorName} token={c.authorToken} className="font-medium text-ink" /> on{' '}
            <Link to={`/nominations/${c.nominationId}`} className="font-display text-ink hover:text-forest hover:underline">
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
        <div className="flex flex-shrink-0 flex-col gap-2">
          <button
            onClick={() => hide.mutate({ id: c.id, hidden: !c.hidden })}
            disabled={hide.isPending}
            className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium disabled:opacity-60 ${
              c.hidden
                ? 'border-line hover:border-green hover:text-green'
                : 'border-amber/40 text-amber hover:bg-amber/10'
            }`}
          >
            {c.hidden ? (
              <>
                <Eye className="h-4 w-4" /> Restore
              </>
            ) : (
              <>
                <EyeOff className="h-4 w-4" /> Hide
              </>
            )}
          </button>
          {c.openFlags > 0 && !c.hidden && (
            <button
              onClick={() => hide.mutate({ id: c.id, hidden: false })}
              disabled={hide.isPending}
              title="Dismiss the flags and leave the comment up"
              className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-sm font-medium hover:border-green hover:text-green disabled:opacity-60"
            >
              <Check className="h-4 w-4" /> Keep
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
