import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { TITLE_EVENT } from '@/lib/page-title'

/**
 * Single-page apps change pages without a page load, so screen readers hear
 * nothing and keyboard focus is left on a link that no longer exists. On each
 * change of path this:
 *
 * - moves focus to <main>, or, when going Back, to the link the reader used
 *   to leave that page, so keyboard users carry on where they were (the
 *   scroll position is restored separately, so focus never scrolls);
 * - announces the new page title once the page has set it.
 *
 * Query-string changes, such as typing in the registry search, are not page
 * changes and are ignored, and nothing happens on first load.
 */
export function RouteAnnouncer({ mainRef }: { mainRef: React.RefObject<HTMLElement | null> }) {
  const location = useLocation()
  const navigationType = useNavigationType()
  const [message, setMessage] = useState('')
  // Path of the page currently shown; starts as the first page, so first load is skipped.
  const shownPath = useRef(location.pathname)

  // The last in-app link followed from each history entry, keyed by entry.
  const currentKey = useRef(location.key)
  const leftVia = useRef(new Map<string, string>())
  useEffect(() => {
    currentKey.current = location.key
  }, [location.key])
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const link = (e.target as Element | null)?.closest?.('a[href]')
      if (link && (link as HTMLAnchorElement).origin === window.location.origin) {
        leftVia.current.set(currentKey.current, link.getAttribute('href')!)
      }
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  useEffect(() => {
    if (location.pathname === shownPath.current) return
    shownPath.current = location.pathname

    const href = navigationType === 'POP' ? leftVia.current.get(location.key) : undefined
    const returnTo = href
      ? mainRef.current?.querySelector<HTMLElement>(`a[href="${CSS.escape(href)}"]`)
      : null
    ;(returnTo ?? mainRef.current)?.focus({ preventScroll: true })

    // Announce once the new page has set its title; pages whose title depends
    // on loaded data set it a moment later. Cleared first, so a page that
    // shares its title with the last one is still read out.
    let done = false
    const announce = () => {
      if (done) return
      done = true
      setMessage('')
      window.requestAnimationFrame(() => setMessage(document.title))
    }
    window.addEventListener(TITLE_EVENT, announce)
    const fallback = window.setTimeout(announce, 1500)
    return () => {
      window.removeEventListener(TITLE_EVENT, announce)
      window.clearTimeout(fallback)
    }
  }, [location.pathname, location.key, navigationType, mainRef])

  return (
    <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </p>
  )
}
