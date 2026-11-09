import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EyeOff, Eye, ThumbsUp, Flag } from 'lucide-react'
import { useSession } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import { researcherLabel } from '@/features/nominations/format'
import { ResearcherLink } from '@/features/profile/ResearcherLink'
import { useHideComment } from '@/features/admin/api'
import { RichText } from '@/components/ui/RichText'
import { formatWhen } from '@/lib/dates'
import {
  useComments,
  usePostComment,
  useToggleCommentLike,
  useFlagComment,
  type Comment,
} from './api'

const MARKDOWN_HINT = (
  <>
    Supports Markdown: **bold**, *italic*, lists, &gt; quotes and [links](https://…).
  </>
)

interface CommentNode {
  comment: Comment
  children: CommentNode[]
}

/** Nest replies under their parent. Input is oldest-first; order is preserved. */
function buildTree(comments: Comment[]): CommentNode[] {
  const nodes = new Map<string, CommentNode>()
  const roots: CommentNode[] = []
  for (const c of comments) nodes.set(c.id, { comment: c, children: [] })
  for (const c of comments) {
    const node = nodes.get(c.id)!
    const parent = c.parentId ? nodes.get(c.parentId) : undefined
    // A visible reply to a hidden/missing parent surfaces at the top level.
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}

export function CommentsSection({
  nominationId,
  closed = false,
}: {
  nominationId: string
  /** The check is finished: invite questions about the result instead. */
  closed?: boolean
}) {
  const { data: session } = useSession()
  const isMaintainer = (session?.user as { role?: string } | undefined)?.role === 'maintainer'
  const navigate = useNavigate()
  const { data: comments, isLoading } = useComments(nominationId)
  const post = usePostComment(nominationId)
  const [content, setContent] = useState('')
  const [composing, setComposing] = useState(false)

  const tree = useMemo(() => buildTree(comments ?? []), [comments])

  function submit() {
    if (content.trim().length < 2) return
    post.mutate(
      { content: content.trim() },
      {
        onSuccess: () => {
          setContent('')
          setComposing(false)
        },
      },
    )
  }

  return (
    <section aria-labelledby="discussion">
      <h2 id="discussion" className="section-title mb-4">
        Discussion
        {comments && comments.length > 0 && (
          <span className="data ml-2 font-sans text-base font-normal text-muted-foreground">
            {comments.length}
          </span>
        )}
      </h2>

      {isLoading && <p className="text-sm text-muted-foreground">Loading comments…</p>}
      {comments && comments.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {closed
            ? 'No comments yet. Questions about the result or the write-up are welcome.'
            : 'No comments yet. Questions about the design, data or feasibility are welcome.'}
        </p>
      )}

      <ul className="space-y-4">
        {tree.map((node) => (
          <CommentThread
            key={node.comment.id}
            node={node}
            depth={0}
            nominationId={nominationId}
            canModerate={isMaintainer}
            signedIn={!!session}
          />
        ))}
      </ul>
      {session && !composing ? (
        <button onClick={() => setComposing(true)} className="btn-secondary mt-6">
          Add a comment
        </button>
      ) : session ? (
        <div className="mt-6">
          <label htmlFor="new-comment" className="mb-1 block text-sm font-medium">
            Add a comment
          </label>
          <textarea
            id="new-comment"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            autoFocus
            placeholder="Questions, related work, practical concerns"
            className="input"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={submit}
              disabled={post.isPending || content.trim().length < 2}
              className="btn-primary"
            >
              {post.isPending ? 'Posting…' : 'Post comment'}
            </button>
            <p className="text-xs text-muted-foreground" title="**bold**, *italic*, lists, > quotes, [links](https://…)">
              Markdown formatting works. Keep it about the work, not the authors.
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          <button
            onClick={() => navigate(`/sign-in?redirect=/nominations/${nominationId}`)}
            className="font-medium text-forest underline underline-offset-2"
          >
            Sign in
          </button>{' '}
          to join the discussion.
        </p>
      )}

    </section>
  )
}

function CommentThread({
  node,
  depth,
  nominationId,
  canModerate,
  signedIn,
}: {
  node: CommentNode
  depth: number
  nominationId: string
  canModerate: boolean
  signedIn: boolean
}) {
  const c = node.comment
  const hide = useHideComment()
  const post = usePostComment(nominationId)
  const like = useToggleCommentLike(nominationId)
  const flag = useFlagComment(nominationId)
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [replying, setReplying] = useState(false)
  const [reply, setReply] = useState('')
  const [flagging, setFlagging] = useState(false)
  const [flagReason, setFlagReason] = useState('')

  function toggleLike() {
    if (!signedIn) {
      navigate(`/sign-in?redirect=/nominations/${nominationId}`)
      return
    }
    like.mutate(c.id)
  }

  function sendFlag() {
    flag.mutate(
      { id: c.id, reason: flagReason.trim() },
      { onSuccess: () => setFlagging(false) },
    )
  }

  const deleted = c.name === 'Deleted account'
  const replyCount = countDescendants(node)

  function sendReply() {
    if (reply.trim().length < 2) return
    post.mutate(
      { content: reply.trim(), parentId: c.id },
      {
        onSuccess: () => {
          setReply('')
          setReplying(false)
          setCollapsed(false)
        },
      },
    )
  }

  return (
    <li
      className={
        depth === 0
          ? 'border-t border-line pt-4 first:border-t-0 first:pt-0'
          : 'border-l-2 border-line pl-3 sm:pl-4'
      }
    >
      <div
        className={c.hidden ? 'rounded-md border border-amber/30 bg-amber/5 p-3' : ''}
      >
        <div className="flex flex-wrap items-center gap-x-2 text-sm">
          <ResearcherLink name={c.name} token={c.token} className="font-medium text-ink" />
          <span className="text-xs text-muted-foreground">{formatWhen(c.createdAt)}</span>
          {c.hidden && <span className="text-xs font-medium text-amber">Hidden</span>}
          {canModerate && (
            <button
              onClick={() => hide.mutate({ id: c.id, hidden: !c.hidden })}
              disabled={hide.isPending}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-amber disabled:opacity-60"
            >
              {c.hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {c.hidden ? 'Restore' : 'Hide'}
            </button>
          )}
        </div>

        {(
          <>
            <RichText className="mt-1 text-[0.9375rem] leading-relaxed">{c.content}</RichText>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {!c.hidden && (
                <button
                  onClick={toggleLike}
                  disabled={c.isOwn}
                  aria-pressed={c.viewerLiked}
                  title={c.isOwn ? 'Likes on your comment' : c.viewerLiked ? 'Unlike' : 'Like'}
                  className={cn(
                    'inline-flex items-center gap-1 disabled:cursor-default',
                    c.viewerLiked ? 'font-medium text-green' : 'enabled:hover:text-green',
                  )}
                >
                  <ThumbsUp className={cn('h-3.5 w-3.5', c.viewerLiked && 'fill-current')} />
                  {c.likes > 0 ? c.likes : c.isOwn ? '' : 'Like'}
                </button>
              )}
              {signedIn && (
                <button
                  onClick={() => setReplying((v) => !v)}
                  className="hover:text-green"
                >
                  {replying ? 'Cancel' : 'Reply'}
                </button>
              )}
              {node.children.length > 0 && (
                <button onClick={() => setCollapsed(true)} className="hover:text-ink">
                  Hide {replyCount === 1 ? 'reply' : `${replyCount} replies`}
                </button>
              )}
              {signedIn && !c.isOwn && !c.hidden && !deleted && (
                c.viewerFlagged ? (
                  <span className="inline-flex items-center gap-1 text-amber">
                    <Flag className="h-3.5 w-3.5" /> Flagged for review
                  </span>
                ) : (
                  <button
                    onClick={() => setFlagging((v) => !v)}
                    className="inline-flex items-center gap-1 hover:text-amber"
                  >
                    <Flag className="h-3.5 w-3.5" /> {flagging ? 'Cancel' : 'Flag'}
                  </button>
                )
              )}
            </div>
            {flagging && !c.viewerFlagged && (
              <div className="mt-2 space-y-2 rounded-md border border-amber/30 bg-amber/5 p-3">
                <p className="text-xs text-ink">
                  Flag this comment for the maintainers if it breaks the Code of Conduct. It
                  stays visible until a maintainer reviews it; the author isn’t told who
                  flagged it.
                </p>
                <input
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  maxLength={1000}
                  placeholder="What’s wrong with it? (optional)"
                  className="input"
                />
                <button
                  onClick={sendFlag}
                  disabled={flag.isPending}
                  className="rounded-md border border-amber/40 px-3 py-1.5 text-sm font-medium text-amber hover:bg-amber/10 disabled:opacity-60"
                >
                  {flag.isPending ? 'Sending…' : 'Send to maintainers'}
                </button>
                {flag.isError && (
                  <p className="text-xs text-destructive">Could not flag this comment. Try again.</p>
                )}
              </div>
            )}
            {replying && (
              <div className="mt-2 space-y-2">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={2}
                  placeholder={`Reply to ${researcherLabel(c.name, c.token)}…`}
                  className="input"
                />
                <p className="text-xs text-muted-foreground">{MARKDOWN_HINT}</p>
                <button
                  onClick={sendReply}
                  disabled={post.isPending || reply.trim().length < 2}
                  className="btn-primary"
                >
                  {post.isPending ? 'Posting…' : 'Post reply'}
                </button>
              </div>
            )}
          </>
        )}

        {collapsed && (
          <button onClick={() => setCollapsed(false)} className="mt-1 text-xs text-muted-foreground hover:text-ink">
            Show {replyCount === 1 ? '1 reply' : `${replyCount} replies`}
          </button>
        )}
      </div>

      {!collapsed && node.children.length > 0 && (
        <ul className="mt-3 space-y-3">
          {node.children.map((child) => (
            <CommentThread
              key={child.comment.id}
              node={child}
              depth={depth + 1}
              nominationId={nominationId}
              canModerate={canModerate}
              signedIn={signedIn}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function countDescendants(node: CommentNode): number {
  return node.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0)
}
