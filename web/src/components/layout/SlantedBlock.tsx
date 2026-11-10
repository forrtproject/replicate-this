import { cn } from '@/lib/utils'

/**
 * A full-width colour block whose lower edge runs on a diagonal, with a thin
 * cyan line just below and parallel to it (after the Münster templates; see
 * `.slant-bottom` in index.css). The block gets bottom padding equal to the
 * drop, so content keeps its own padding clear of the edge. `className` styles
 * the block itself.
 */
export function SlantedBlock({
  as: Tag = 'section',
  className,
  children,
  ...rest
}: {
  as?: 'section' | 'div' | 'footer'
  className?: string
  children: React.ReactNode
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <div className="relative">
      <Tag className={cn('slant-bottom pb-11', className)} {...rest}>
        {children}
      </Tag>
      <svg
        aria-hidden="true"
        viewBox="0 0 100 10"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 -bottom-3 h-11 w-full text-cyan"
      >
        <line x1="0" y1="10" x2="100" y2="0" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}
