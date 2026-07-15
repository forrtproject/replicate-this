import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { config } from '@/lib/env'
import {
  channelNameFor,
  createPrivateChannel,
  inviteByEmail,
  slackEnabled,
  SlackApiError,
} from './slack'

const NOM_ID = '5b280724-e897-42a0-b39d-1aecc2583a12'

describe('channelNameFor', () => {
  it('builds a slack-safe name from the title, ending in -discussion', () => {
    expect(channelNameFor('Growth in a Time of Debt')).toBe(
      'growth-in-a-time-of-debt-discussion',
    )
  })

  it('strips characters slack rejects', () => {
    expect(channelNameFor('Feeling the Future: Anomalous… (2011)!')).toBe(
      'feeling-the-future-anomalous-2011-discussion',
    )
  })

  it('inserts the disambiguator before the suffix', () => {
    expect(channelNameFor('Growth in a Time of Debt', NOM_ID.slice(0, 6))).toBe(
      'growth-in-a-time-of-debt-5b2807-discussion',
    )
  })

  it('caps at 80 chars, keeping the suffix and no double hyphen', () => {
    const name = channelNameFor('word '.repeat(40))
    expect(name.length).toBeLessThanOrEqual(80)
    expect(name.endsWith('-discussion')).toBe(true)
    expect(name).not.toContain('--')
  })

  it('falls back to a generic slug for an all-symbol title', () => {
    expect(channelNameFor('—')).toBe('replication-discussion')
  })
})

describe('slack api client', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    config.slack.botToken = 'xoxb-test'
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    config.slack.botToken = ''
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  const respond = (body: unknown) =>
    fetchMock.mockResolvedValueOnce({ json: async () => body } as Response)

  it('slackEnabled reflects the configured token', () => {
    expect(slackEnabled()).toBe(true)
    config.slack.botToken = ''
    expect(slackEnabled()).toBe(false)
  })

  it('creates a private channel and returns its id', async () => {
    respond({ ok: true, channel: { id: 'C123' } })
    await expect(createPrivateChannel('rt-abc')).resolves.toBe('C123')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://slack.com/api/conversations.create')
    const params = new URLSearchParams(init.body as string)
    expect(params.get('name')).toBe('rt-abc')
    expect(params.get('is_private')).toBe('true')
  })

  it('surfaces slack errors as SlackApiError', async () => {
    respond({ ok: false, error: 'name_taken' })
    await expect(createPrivateChannel('rt-abc')).rejects.toThrow(SlackApiError)
  })

  it('invites a member found by email', async () => {
    respond({ ok: true, user: { id: 'U42' } })
    respond({ ok: true })
    await expect(inviteByEmail('C123', 'a@b.co')).resolves.toBe('invited')

    const inviteParams = new URLSearchParams(fetchMock.mock.calls[1][1].body as string)
    expect(inviteParams.get('channel')).toBe('C123')
    expect(inviteParams.get('users')).toBe('U42')
  })

  it('reports non-members so the caller can hand out the workspace invite', async () => {
    respond({ ok: false, error: 'users_not_found' })
    await expect(inviteByEmail('C123', 'a@b.co')).resolves.toBe('not_in_workspace')
  })

  it('treats already_in_channel as success', async () => {
    respond({ ok: true, user: { id: 'U42' } })
    respond({ ok: false, error: 'already_in_channel' })
    await expect(inviteByEmail('C123', 'a@b.co')).resolves.toBe('already_in_channel')
  })
})
