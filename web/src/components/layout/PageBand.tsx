import { cn } from '@/lib/utils'

/**
 * Full-width pale blue band behind a page's header (title, intro, page actions).
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
    <div
      className={cn(
        'border-b border-band-line bg-band',
        bleed && 'mx-[calc(50%-50vw)] mb-10',
        className,
      )}
    >
      <div className={cn('mx-auto max-w-5xl px-4 pb-8 pt-10', inner)}>{children}</div>
    </div>
  )
}
