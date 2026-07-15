import { useState } from 'react'
import { useAdminUsers, useSetUserRole, type AdminUser } from '@/features/admin/api'
import { AdminTabs } from '@/features/admin/AdminTabs'
import { researcherLabel } from '@/features/nominations/format'
import { ContactLinks } from '@/features/profile/ContactLinks'
import { useSession } from '@/lib/auth-client'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'

export function UsersPage() {
  const { data: users, isLoading } = useAdminUsers()
  const { data: session } = useSession()
  const setRole = useSetUserRole()
  const [error, setError] = useState('')

  const myId = session?.user?.id
  const maintainers = users?.filter((u) => u.role === 'maintainer').length ?? 0

  function change(user: AdminUser, role: 'user' | 'maintainer') {
    setError('')
    setRole.mutate(
      { id: user.id, role },
      { onError: (e) => setError(e instanceof ApiError ? e.message : 'Could not update role.') },
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="eyebrow">Maintainers only</p>
      <h1 className="mb-6 mt-1 font-display text-3xl font-semibold">Users</h1>
      <AdminTabs />

      <p className="mb-4 text-sm text-muted-foreground">
        Everyone is pseudonymous — no names or emails are stored. You can grant or revoke
        the <span className="font-medium text-ink">maintainer</span> role, which unlocks
        this admin area and the moderation queue.
      </p>

      {error && (
        <p className="mb-4 rounded-md border border-amber/30 bg-amber/10 px-3 py-2 text-sm text-amber">
          {error}
        </p>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Loading users…</p>}

      <div className="overflow-hidden rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Researcher</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Joined</th>
              <th className="px-4 py-2 font-medium">Activity</th>
              <th className="px-4 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => {
              const isMe = u.id === myId
              const isAdmin = u.role === 'maintainer'
              return (
                <tr key={u.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{researcherLabel(u.name, u.token)}</span>
                      {u.providers.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {u.providers.join(', ')}
                        </span>
                      )}
                      {isMe && <span className="text-xs text-green">you</span>}
                    </div>
                    <div className="mt-0.5 text-xs">
                      <ContactLinks links={u.links} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        isAdmin ? 'bg-green-tint text-forest' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {isAdmin ? 'Maintainer' : 'User'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="data">{u.nominations}</span> nom ·{' '}
                    <span className="data">{u.contributions}</span> contrib
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isMe ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : isAdmin ? (
                      <button
                        onClick={() => change(u, 'user')}
                        disabled={maintainers <= 1}
                        title={maintainers <= 1 ? 'Cannot remove the last maintainer' : undefined}
                        className="rounded-md border border-line px-2.5 py-1 text-xs font-medium hover:border-amber hover:text-amber disabled:opacity-40"
                      >
                        Revoke admin
                      </button>
                    ) : (
                      <button
                        onClick={() => change(u, 'maintainer')}
                        className="rounded-md bg-green px-2.5 py-1 text-xs font-medium text-white hover:bg-forest"
                      >
                        Make admin
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
