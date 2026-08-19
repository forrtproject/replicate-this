import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Renders researcher-written free text (justifications, robustness checks,
 * design deviations) as a small, safe subset of Markdown.
 *
 * Nominations imported from the GitHub issue tracker carry the issue body
 * verbatim, so they arrive with Markdown links and bullet lists — rendered as
 * plain text those showed their raw `[label](url)` syntax. Only inline
 * formatting, lists, quotes and links survive: no headings, images or raw HTML,
 * so a nomination can never restyle the page around it. react-markdown escapes
 * raw HTML and strips `javascript:` URLs by default; anything disallowed is
 * unwrapped to its text rather than dropped, so no wording is ever lost.
 *
 * Sizing and colour come from the container — pass the same text classes the
 * surrounding copy uses.
 */
const ALLOWED_ELEMENTS = [
  'p',
  'a',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'del',
  'code',
  'blockquote',
  'br',
]

export function RichText({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        allowedElements={ALLOWED_ELEMENTS}
        unwrapDisallowed
        components={{
          p: ({ children }) => <p className="my-3 first:mt-0 last:mb-0">{children}</p>,
          // Links point off-site (news coverage, OSF, preprints), and the URLs
          // can be long enough to overflow — break them instead.
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer nofollow"
              className="break-words text-green underline"
            >
              {children}
            </a>
          ),
          ul: ({ children }) => (
            <ul className="my-3 list-disc space-y-1 pl-5 first:mt-0 last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 list-decimal space-y-1 pl-5 first:mt-0 last:mb-0">{children}</ol>
          ),
          strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
          code: ({ children }) => (
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-green pl-3 text-muted-foreground first:mt-0 last:mb-0">
              {children}
            </blockquote>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
