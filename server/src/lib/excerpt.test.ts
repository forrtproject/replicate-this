import { describe, it, expect } from 'vitest'
import { excerpt } from './excerpt'

describe('excerpt', () => {
  it('keeps short text as it is', () => {
    expect(excerpt('Is the plan to keep that manipulation?', 100)).toBe(
      'Is the plan to keep that manipulation?',
    )
  })

  it('strips Markdown so the excerpt reads as plain text', () => {
    expect(excerpt('> See **the** [RRR protocol](https://osf.io/x) and `code`', 100)).toBe(
      'See the RRR protocol and code',
    )
  })

  it('cuts long text at a word boundary with an ellipsis', () => {
    const out = excerpt('one two three four five six seven eight nine ten', 20)
    expect(out).toBe('one two three four…')
  })
})
