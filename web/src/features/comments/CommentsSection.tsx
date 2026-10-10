import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EyeOff, Eye, Minus, Plus, ThumbsUp, Flag } from 'lucide-react'
import { useSession } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import { researcherLabel } from '@/features/nominations/format'
import { ContactLinks } from '@/features/profile/ContactLinks'
import { ResearcherLink } from '@/features/profile/ResearcherLink'
import { useHideComment } from '@/features/admin/api'
import { RichText } from '@/components/ui/RichText'
import {
  useComments,
  usePostComment,
  useToggleCommentLike,
  useFlagComment,
  type Comment,
} from './api'

const MARKDOWN_HINT = (
  <>
    Markdown works: **bold**, *italic*, `code`, lists, &gt; quotes and [links](https://…) —
    bare URLs are linked too.
  </>
)

function timeAgo(iso: string): string {
  const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  const units: [number, string][] = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [30, 'day'],
    [12, 'month'],
  ]
  let value = secs
  let unit = 'second'
  for (const [factor, name] of units) {
    if (Math.abs(value) < factor) break
    value = Math.round(value / factor)
    unit = name
  }
  if (unit === 'second') return 'just now'
  return `${value} ${unit}${Math.abs(value) === 1 ? '' : 's'} ago`
}

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

export function CommentsSection({ nominationId }: { nominationId: string }) {
  const { data: session } = useSession()
  const isMaintainer = (session?.user as { role?: string } | undefined)?.role === 'maintainer'
  const navigate = useNavigate()
  const { data: comments, isLoading } = useComments(nominationId)
  const post = usePostComment(nominationId)
  const [content, setContent] = useState('')

  const tree = useMemo(() => buildTree(comments ?? []), [comments])

  function submit() {
    if (content.trim().length < 2) return
    post.mutate({ content: content.trim() }, { onSuccess: () => setContent('') })
  }

  return (
    <section className="mt-6">
      <h2 className="mb-3 font-display text-lg font-semibold">
        Discussion {comments && comments.length > 0 && `(${comments.length})`}
      </h2>

      {session ? (
        <div className="mb-5">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            placeholder="Add to the discussion — keep it constructive and about the work."
            className="input"
          />
          <p className="mt-1 text-xs text-muted-foreground">{MARKDOWN_HINT}</p>
          <div className="mt-2">
            <button
              onClick={submit}
              disabled={post.isPending || content.trim().length < 2}
              className="rounded-md bg-green px-3 py-2 text-sm font-medium text-white hover:bg-forest disabled:opacity-60"
            >
              {post.isPending ? 'Posting…' : 'Post comment'}
            </button>
          </div>
        </div>
      ) : (
        <p className="mb-5 text-sm text-muted-foreground">
          <button
            onClick={() => navigate(`/sign-in?redirect=/nominations/${nominationId}`)}
            className="text-green underline"
          >
            Sign in
          </button>{' '}
          to join the discussion.
        </p>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Loading comments…</p>}
      {comments && comments.length === 0 && (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
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
          ? 'border-t border-line pt-3 first:border-t-0 first:pt-0'
          : 'border-l-2 border-line pl-3 sm:pl-4'
      }
    >
      <div
        className={c.hidden ? 'rounded-md border border-amber/30 bg-amber/5 p-3' : ''}
      >
        <div className="flex flex-wrap items-center gap-x-2 text-sm">
          {(node.children.length > 0 || collapsed) && (
            <button
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? 'Expand thread' : 'Collapse thread'}
              className="inline-flex h-4 w-4 items-center justify-center rounded border border-line text-muted-foreground hover:border-green hover:text-green"
            >
              {collapsed ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            </button>
          )}
          <ResearcherLink name={c.name} token={c.token} className="font-medium" />
          {!deleted && <ContactLinks links={c.links} />}
          <span className="text-xs text-muted-foreground">· {timeAgo(c.createdAt)}</span>
          {c.hidden && <span className="text-xs font-medium text-amber">· hidden</span>}
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

        {!collapsed && (
          <>
            <RichText className="mt-1 text-sm leading-relaxed">{c.content}</RichText>
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
                  className="rounded-md bg-green px-3 py-1.5 text-sm font-medium text-white hover:bg-forest disabled:opacity-60"
                >
                  {post.isPending ? 'Posting…' : 'Post reply'}
                </button>
              </div>
            )}
          </>
        )}

        {collapsed && replyCount > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            {replyCount} {replyCount === 1 ? 'reply' : 'replies'} hidden
          </p>
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
