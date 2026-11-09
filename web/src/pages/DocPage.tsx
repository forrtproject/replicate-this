import { MarkdownDoc } from '@/components/ui/MarkdownDoc'
import { usePageTitle } from '@/lib/page-title'

/** Full-page rendering of a repo markdown doc (Code of Conduct, guidelines). */
export function DocPage({
  src,
  title,
  footer,
}: {
  src: string
  title: string
  /** Next steps shown after the document. */
  footer?: React.ReactNode
}) {
  usePageTitle(title)
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-10">
      <div className="max-w-[42rem]">
        <MarkdownDoc src={src} />
        {footer && <div className="mt-10 border-t border-line pt-6">{footer}</div>}
      </div>
    </div>
  )
}
