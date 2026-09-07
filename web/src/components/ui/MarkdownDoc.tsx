import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { withBase } from '@/lib/config'

/**
 * Fetches a markdown file (served from /public) and renders it. The source
 * files live in the repo, so they can be edited through GitHub's web editor.
 */
export function MarkdownDoc({ src }: { src: string }) {
  const [content, setContent] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    fetch(withBase(src))
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((t) => active && setContent(t))
      .catch(() => active && setFailed(true))
    return () => {
      active = false
    }
  }, [src])

  if (failed) {
    return <p className="text-sm text-muted-foreground">Guidelines are unavailable right now.</p>
  }
  if (content === null) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}
