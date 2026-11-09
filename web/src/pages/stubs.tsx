import { Link } from 'react-router-dom'
import { usePageTitle } from '@/lib/page-title'

export const NotFoundPage = () => {
  usePageTitle('Page not found')
  return (
    <div className="mx-auto max-w-5xl px-4 py-20">
      <h1 className="font-display text-[2rem] font-semibold">Page not found</h1>
      <p className="mt-2 max-w-xl text-[0.9375rem] leading-relaxed text-muted-foreground">
        There’s nothing at this address. The link may be mistyped, or the page may have moved.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-5">
        <Link
          to="/nominations"
          className="rounded-md bg-green px-4 py-2 text-sm font-semibold text-white hover:bg-forest"
        >
          Browse nominations
        </Link>
        <Link to="/guidelines" className="text-sm font-medium text-forest hover:underline">
          How nominations work
        </Link>
      </div>
    </div>
  )
}
