import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RichText } from './RichText'

describe('RichText', () => {
  // The justification imported from GitHub issue #11, which embeds its sources
  // as Markdown links inside parentheses.
  const justification =
    'The finding was picked up by news media ([example](https://edition.cnn.com/2026/08/17/health/album-streaming-traffic-deaths?Date=20260817)). ' +
    'Researchers on BlueSky also expressed concerns about the robustness ([thread](https://bsky.app/profile/klauspforr.eurosky.social/post/3mtdogf3te22m)).'

  it('renders embedded Markdown links as links, not raw syntax', () => {
    render(<RichText>{justification}</RichText>)

    const example = screen.getByRole('link', { name: 'example' })
    expect(example).toHaveAttribute('href', expect.stringContaining('edition.cnn.com'))
    const thread = screen.getByRole('link', { name: 'thread' })
    expect(thread).toHaveAttribute('href', expect.stringContaining('bsky.app'))

    expect(screen.queryByText(/\]\(https/)).toBeNull()
  })

  it('opens off-site links in a new tab without leaking the referrer', () => {
    render(<RichText>{justification}</RichText>)

    const link = screen.getByRole('link', { name: 'example' })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer nofollow')
  })

  it('autolinks bare URLs, whether alone or inside prose', () => {
    // Data location arrives both ways: a lone repository URL, or prose citing
    // several — the field used to only linkify the lone-URL form.
    const { unmount } = render(<RichText>{'https://www.nhtsa.gov/research-data/fars'}</RichText>)
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://www.nhtsa.gov/research-data/fars')
    unmount()

    render(<RichText>{'The preprint (https://doi.org/10.31219/osf.io/pdhaz_v1), and https://osf.io/a24py/.'}</RichText>)
    // Trailing punctuation stays out of the href.
    expect(screen.getByRole('link', { name: 'https://doi.org/10.31219/osf.io/pdhaz_v1' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'https://osf.io/a24py/' })).toBeInTheDocument()
  })

  it('renders the bullet lists used by the robustness-check fields', () => {
    render(<RichText>{'- Preregister the primary outcomes\n- Report effect sizes'}</RichText>)

    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('keeps a link whose label is itself a URL clickable', () => {
    // Issue #5 writes its citation this way: [<doi url>](<publisher url>).
    render(
      <RichText>
        {'See [https://doi.org/10.1037/pspi0000315](https://psycnet.apa.org/doi/10.1037/pspi0000315)'}
      </RichText>,
    )

    expect(screen.getByRole('link', { name: 'https://doi.org/10.1037/pspi0000315' })).toHaveAttribute(
      'href',
      'https://psycnet.apa.org/doi/10.1037/pspi0000315',
    )
  })

  it('does not let a nomination inject raw HTML or headings into the page', () => {
    render(<RichText>{'# Huge heading\n\n<script>alert(1)</script><b>bold</b>'}</RichText>)

    expect(document.querySelector('h1')).toBeNull()
    expect(document.querySelector('script')).toBeNull()
    expect(document.querySelector('b')).toBeNull()
    // Disallowed elements are unwrapped, so the wording survives as text.
    expect(screen.getByText(/Huge heading/)).toBeInTheDocument()
  })

  it('strips javascript: URLs', () => {
    render(<RichText>{'[click me](javascript:alert(1))'}</RichText>)

    // The href is blanked, which also drops the element's link role.
    const link = screen.getByText('click me')
    expect(link.getAttribute('href')).toBe('')
    expect(screen.queryByRole('link')).toBeNull()
  })
})
