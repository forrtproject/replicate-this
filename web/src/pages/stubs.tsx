import { Link } from 'react-router-dom'
import { PageBand } from '@/components/layout/PageBand'
import { usePageTitle } from '@/lib/page-title'

export const NotFoundPage = () => {
  usePageTitle('Page not found')
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <PageBand bleed>
        <h1 className="font-display text-[2rem] font-semibold">Page not found</h1>
        <p className="mt-2 max-w-xl text-[0.9375rem] leading-relaxed text-band-ink/80">
          There’s nothing at this address. The link may be mistyped, or the page may have moved.
        </p>
      </PageBand>
      <div className="flex flex-wrap items-center gap-5">
        <Link
          to="/nominations"
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-deep"
        >
          Browse nominations
        </Link>
        <Link to="/guidelines" className="text-sm font-medium text-brand-deep hover:underline">
          How nominations work
        </Link>
      </div>
    </div>
  )
}
