import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { withBase } from '@/lib/config'

// Embedded inside another page, the document's headings drop one level so the
// host page keeps its single <h1>.
const NESTED_HEADINGS = {
  h1: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
  h2: ({ children }: { children?: React.ReactNode }) => <h3>{children}</h3>,
  h3: ({ children }: { children?: React.ReactNode }) => <h4>{children}</h4>,
}

/**
 * Fetches a markdown file (served from /public) and renders it. The source
 * files live in the repo, so they can be edited through GitHub's web editor.
 * Pass `nested` when it sits inside a page that has its own heading.
 */
export function MarkdownDoc({ src, nested = false }: { src: string; nested?: boolean }) {
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
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={nested ? NESTED_HEADINGS : undefined}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
