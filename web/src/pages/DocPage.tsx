import { PageBand } from '@/components/layout/PageBand'
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
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <PageBand bleed>
        <h1 className="font-display text-[2rem] font-semibold leading-tight">{title}</h1>
      </PageBand>
      {/* The page title sits in the band, so the document's own h1 is hidden. */}
      <div className="max-w-[42rem] [&_.markdown>h1:first-child]:hidden">
        <MarkdownDoc src={src} />
        {footer && <div className="mt-10 border-t border-line pt-6">{footer}</div>}
      </div>
    </div>
  )
}
