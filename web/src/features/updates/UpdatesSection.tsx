import { useState } from 'react'
import { ExternalLink, FileText } from 'lucide-react'
import { useSession } from '@/lib/auth-client'
import { researcherLabel } from '@/features/nominations/format'
import { ApiError } from '@/lib/api'
import type { NominationDetail } from '@/types'
import { useUpdates, usePostUpdate } from './api'

/**
 * Public timeline of progress updates plus a post form for the replication
 * team (nominator, contributors, maintainers). Posting is optional; an update
 * with an article link asks the maintainers to mark the study completed.
 */
export function UpdatesSection({ nomination: n }: { nomination: NominationDetail }) {
  const { data: session } = useSession()
  const isMaintainer = (session?.user as { role?: string } | undefined)?.role === 'maintainer'
  const { data: updates, isLoading } = useUpdates(n.id)
  const post = usePostUpdate(n.id)

  const canPost = n.viewerIsNominator || n.userContributed || isMaintainer

  const [showForm, setShowForm] = useState(false)
  const [content, setContent] = useState('')
  const [articleUrl, setArticleUrl] = useState('')
  const [error, setError] = useState('')

  function submit() {
    setError('')
    post.mutate(
      { content: content.trim(), articleUrl: articleUrl.trim() || undefined },
      {
        onSuccess: () => {
          setContent('')
          setArticleUrl('')
          setShowForm(false)
        },
        onError: (e) =>
          setError(e instanceof ApiError ? e.message : 'Could not post the update.'),
      },
    )
  }

  if (!canPost && (!updates || updates.length === 0)) return null

  return (
    <section className="mt-6 rounded-lg border border-border bg-card p-4">
      <h2 className="mb-1 text-sm font-semibold">
        Progress updates {updates && updates.length > 0 && `(${updates.length})`}
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Occasional notes from the replication team on how the work is going.
      </p>

      {isLoading && <p className="text-sm text-muted-foreground">Loading updates…</p>}
      {updates && updates.length === 0 && (
        <p className="text-sm text-muted-foreground">No updates yet.</p>
      )}

      <ol className="space-y-3">
        {updates?.map((u) => (
          <li key={u.id} className="border-t border-line pt-3 first:border-t-0 first:pt-0">
            <p className="flex flex-wrap items-center gap-x-2 text-sm">
              <span className="font-medium">{researcherLabel(u.name, u.token)}</span>
              <span className="text-xs text-muted-foreground">
                ·{' '}
                {new Date(u.createdAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{u.content}</p>
            {u.articleUrl && (
              <a
                href={u.articleUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-sm text-green hover:underline"
              >
                <FileText className="h-3.5 w-3.5" /> Research article{' '}
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </li>
        ))}
      </ol>

      {canPost && (
        <div className={updates && updates.length > 0 ? 'mt-4 border-t border-line pt-4' : 'mt-2'}>
          {showForm ? (
            <div className="space-y-2">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={3}
                placeholder="How is the replication going? Milestones, obstacles, preliminary findings…"
                className="input"
              />
              <div>
                <input
                  value={articleUrl}
                  onChange={(e) => setArticleUrl(e.target.value)}
                  placeholder="Link to the research article / preprint (optional)"
                  className="input"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Add this once the work is written up — a maintainer will review it and mark
                  the study completed.
                </p>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={submit}
                  disabled={post.isPending || content.trim().length < 2}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                >
                  {post.isPending ? 'Posting…' : 'Post update'}
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
            <>
              <button
                onClick={() => setShowForm(true)}
                className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
              >
                Share an update
              </button>
              <p className="mt-1 text-xs text-muted-foreground">
                Entirely optional — post only when there’s something worth sharing.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  )
}
