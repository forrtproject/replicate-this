import { Link } from 'react-router-dom'
import { EyeOff, Eye, Flag, Check } from 'lucide-react'
import { useAdminComments, useHideComment, type AdminComment } from '@/features/admin/api'
import { AdminTabs } from '@/features/admin/AdminTabs'
import { researcherLabel } from '@/features/nominations/format'
import { RichText } from '@/components/ui/RichText'

export function CommentsModerationPage() {
  const { data: comments, isLoading } = useAdminComments()

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="eyebrow">Maintainers only</p>
      <h1 className="mb-6 mt-1 font-display text-3xl font-semibold">Comments</h1>
      <AdminTabs />

      <p className="mb-4 text-sm text-muted-foreground">
        Recent comments across all nominations, with any flagged by users first. Hide
        anything off-topic or against the Code of Conduct — hidden comments disappear from
        the public thread but are kept for the record. Hiding a flagged comment, or
        keeping it, closes its flags.
      </p>

      {isLoading && <p className="text-sm text-muted-foreground">Loading comments…</p>}
      {comments?.length === 0 && (
        <p className="rounded-lg border border-dashed border-line py-8 text-center text-sm text-muted-foreground">
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
      className={`rounded-lg border p-4 ${
        c.hidden
          ? 'border-amber/30 bg-amber/5'
          : c.openFlags > 0
            ? 'border-amber bg-card'
            : 'border-line bg-card'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs text-muted-foreground">
            {researcherLabel(c.authorName, c.authorToken)} · on{' '}
            <Link
              to={`/nominations/${c.nominationId}`}
              className="text-green hover:underline"
            >
              {c.nominationTitle || 'a nomination'}
            </Link>{' '}
            · {new Date(c.createdAt).toLocaleDateString()}
            {c.hidden && <span className="ml-1 font-medium text-amber">· hidden</span>}
          </p>
          <RichText className="text-sm leading-relaxed">{c.content}</RichText>
          {c.openFlags > 0 && (
            <div className="mt-2 rounded-md bg-amber/10 px-3 py-2 text-xs text-ink">
              <p className="inline-flex items-center gap-1 font-medium text-amber">
                <Flag className="h-3.5 w-3.5" />
                Flagged by {c.openFlags} {c.openFlags === 1 ? 'user' : 'users'}
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
