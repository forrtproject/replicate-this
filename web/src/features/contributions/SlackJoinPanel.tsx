import { useState } from 'react'
import { Check, ExternalLink, MessageCircle } from 'lucide-react'
import { ApiError } from '@/lib/api'
import { useJoinSlackChannel } from './api'

/**
 * Offers replication-team members a seat in the nomination's locked Slack
 * channel. Rendered only for the team (contributors / nominator) and only
 * when the channel exists.
 *
 * The email asked for here is the one on the user's Slack account; it's used
 * once server-side to find them on Slack and is never stored.
 */
export function SlackJoinPanel({
  nominationId,
  channelName,
}: {
  nominationId: string
  channelName: string
}) {
  const join = useJoinSlackChannel(nominationId)
  const [email, setEmail] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [joined, setJoined] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function submit() {
    setError(null)
    setInviteUrl(null)
    join.mutate(email.trim(), {
      onSuccess: (res) => {
        if (res.result === 'not_in_workspace') {
          setInviteUrl(res.inviteUrl ?? null)
        } else {
          setJoined(true)
        }
      },
      onError: (err) =>
        setError(
          err instanceof ApiError ? err.message : 'Something went wrong. Please try again.',
        ),
    })
  }

  return (
    <section className="border-t border-border pt-4">
      <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
        <MessageCircle className="h-4 w-4" /> Slack discussion
      </h2>

      {joined ? (
        <p className="inline-flex items-center gap-1 text-sm text-primary">
          <Check className="h-4 w-4" /> You’re in — open Slack and look for{' '}
          <span className="font-mono">#{channelName}</span>.
        </p>
      ) : !showForm ? (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            This team has a private channel, <span className="font-mono">#{channelName}</span>,
            in the community Slack. Do you want to join the discussion?
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            Join the Slack channel
          </button>
        </>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Enter the email address on your Slack account so we can invite you. It’s used once
            to find you on Slack and never stored.
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@university.edu"
            className="input"
          />

          {inviteUrl && (
            <p className="rounded-md border border-amber/30 bg-amber/10 px-3 py-2 text-xs">
              No Slack account with that email is in the community workspace yet.{' '}
              <a
                href={inviteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 font-medium text-green underline"
              >
                Create your account / join the workspace <ExternalLink className="h-3 w-3" />
              </a>{' '}
              — then come back and press the button again; you’ll be added to the channel
              automatically.
            </p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={join.isPending || !email.includes('@')}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {join.isPending
                ? 'Inviting…'
                : inviteUrl
                  ? 'I’ve joined — add me to the channel'
                  : 'Invite me'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
