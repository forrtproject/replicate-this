import { useEffect } from 'react'

const SITE = 'Replicate This'

/** Fired after a page sets its title, so the route announcer can read it out. */
export const TITLE_EVENT = 'rt:title'

/**
 * Sets the browser tab title for the current page ("Nominate a study |
 * Replicate This"). Pass undefined while the page's data is still loading;
 * the title is set, and announced, once it is known.
 */
export function usePageTitle(title: string | undefined) {
  useEffect(() => {
    if (title === undefined) return
    document.title = title ? `${title} | ${SITE}` : SITE
    window.dispatchEvent(new Event(TITLE_EVENT))
  }, [title])
}
