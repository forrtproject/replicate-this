import { MarkdownDoc } from '@/components/ui/MarkdownDoc'

/** Full-page rendering of a repo markdown doc (Code of Conduct, guidelines). */
export function DocPage({ src }: { src: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <MarkdownDoc src={src} />
    </div>
  )
}
