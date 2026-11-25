import { cn } from '@/lib/utils'
import { SlantedBlock } from './SlantedBlock'

/**
 * Full-width pale blue band behind a page's header (title, intro, page actions),
 * with the same diagonal lower edge and cyan line as the visitor hero.
 * Content below the band sits on the paper background.
 *
 * `bleed`: the band is rendered inside a page's centred container and
 * stretches out to the viewport edges (the root layout clips the overflow).
 */
export function PageBand({
  children,
  className,
  inner,
  bleed = false,
}: {
  children: React.ReactNode
  className?: string
  /** Classes for the inner container, e.g. to change its padding. */
  inner?: string
  bleed?: boolean
}) {
  return (
    <div className={cn(bleed && 'mx-[calc(50%-50vw)] mb-12', !bleed && 'mb-2', className)}>
      <SlantedBlock as="div" className="bg-band">
        <div className={cn('mx-auto max-w-5xl px-4 pb-8 pt-10', inner)}>{children}</div>
      </SlantedBlock>
    </div>
  )
}
