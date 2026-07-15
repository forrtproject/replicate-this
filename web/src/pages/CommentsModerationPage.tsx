import { Link } from 'react-router-dom'
import { EyeOff, Eye } from 'lucide-react'
import { useAdminComments, useHideComment, type AdminComment } from '@/features/admin/api'
import { AdminTabs } from '@/features/admin/AdminTabs'
import { researcherLabel } from '@/features/nominations/format'

export function CommentsModerationPage() {
  const { data: comments, isLoading } = useAdminComments()

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="eyebrow">Maintainers only</p>
      <h1 className="mb-6 mt-1 font-display text-3xl font-semibold">Comments</h1>
      <AdminTabs />

      <p className="mb-4 text-sm text-muted-foreground">
        Recent comments across all nominations. Hide anything off-topic or against the
        Code of Conduct — hidden comments disappear from the public thread but are kept
        for the record. One click hides or restores.
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
        c.hidden ? 'border-amber/30 bg-amber/5' : 'border-line bg-card'
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
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.content}</p>
        </div>
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
      </div>
    </div>
  )
}
