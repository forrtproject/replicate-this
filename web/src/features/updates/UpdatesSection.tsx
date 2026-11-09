import { useState } from 'react'
import { ExternalLink, FileText } from 'lucide-react'
import { useSession } from '@/lib/auth-client'
import { ResearcherLink } from '@/features/profile/ResearcherLink'
import { RichText } from '@/components/ui/RichText'
import { ApiError } from '@/lib/api'
import type { NominationDetail } from '@/types'
import { formatDate } from '@/lib/dates'
import { useUpdates, usePostUpdate } from './api'

/**
 * Public timeline of progress updates plus a post form for the replication
 * team (nominator, contributors, maintainers). Posting is optional; an update
 * with an article link asks the maintainers to mark the study completed.
 */
export function UpdatesSection({
  nomination: n,
  resultShownAbove = false,
}: {
  nomination: NominationDetail
  /** The page already leads with the result; list that update as a one-line entry. */
  resultShownAbove?: boolean
}) {
  const { data: session } = useSession()
  const isMaintainer = (session?.user as { role?: string } | undefined)?.role === 'maintainer'
  const { data: updates, isLoading } = useUpdates(n.id)
  const post = usePostUpdate(n.id)

  const canPost = n.viewerIsNominator || n.userContributed || isMaintainer
  // Same choice as the result block on the page: the update that links the write-up.
  const resultId = (updates?.find((u) => u.articleUrl) ?? updates?.[0])?.id

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

  // The update that carries the result is already the page's lead; don't repeat it.
  const shown = resultShownAbove ? (updates ?? []).filter((u) => u.id !== resultId) : updates
  if (!canPost && (!shown || shown.length === 0)) return null

  return (
    <section aria-labelledby="updates">
      <h2 id="updates" className="section-title">
        Progress updates
      </h2>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">
        Notes from the nominator and study team on how the work is going.
      </p>

      {isLoading && <p className="text-sm text-muted-foreground">Loading updates…</p>}
      {shown && shown.length === 0 && (
        <p className="text-sm text-muted-foreground">No updates yet. Post one when there’s news.</p>
      )}

      <ol className="space-y-5 border-l-2 border-line pl-5">
        {shown?.map((u) => (
          <li key={u.id}>
            <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <ResearcherLink name={u.name} token={u.token} className="font-medium text-ink" />
              <span className="text-xs text-muted-foreground">{formatDate(u.createdAt)}</span>
            </p>
            <RichText className="mt-1 text-sm leading-relaxed">{u.content}</RichText>
            {u.articleUrl && (
              <a
                href={u.articleUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-forest hover:underline"
              >
                <FileText className="h-3.5 w-3.5" aria-hidden /> Read the write-up{' '}
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            )}
          </li>
        ))}
      </ol>

      {canPost && (
        <div className="mt-4">
          {showForm ? (
            <div className="space-y-2">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={3}
                placeholder="How is the work going? Milestones, obstacles, preliminary findings…"
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
                  Add this once the work is written up. A maintainer will review it and mark
                  the study completed.
                </p>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={submit}
                  disabled={post.isPending || content.trim().length < 2}
                  className="btn-primary"
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
              <button onClick={() => setShowForm(true)} className="btn-secondary">
                Post an update
              </button>
            </>
          )}
        </div>
      )}
    </section>
  )
}
