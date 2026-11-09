import { useState } from 'react'
import { useAdminUsers, useSetUserRole, type AdminUser } from '@/features/admin/api'
import { AdminPageHeader } from '@/features/admin/AdminTabs'
import { formatDate } from '@/lib/dates'
import { researcherLabel } from '@/features/nominations/format'
import { ContactLinks } from '@/features/profile/ContactLinks'
import { useSession } from '@/lib/auth-client'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/lib/page-title'

export function UsersPage() {
  usePageTitle('Users')
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
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-10">
      <AdminPageHeader
        title="Users"
        intro="People appear under the display name they chose; login emails are never stored. The maintainer role gives access to these tools."
      />

      {error && (
        <p className="mb-4 rounded-md border border-amber/30 bg-amber/10 px-3 py-2 text-sm text-amber">
          {error}
        </p>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Loading users…</p>}

      <div className="overflow-x-auto rounded-lg border border-line bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Researcher</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="hidden px-4 py-2 font-medium sm:table-cell">Joined</th>
              <th className="hidden px-4 py-2 font-medium md:table-cell">Activity</th>
              <th className="px-4 py-2 text-right font-medium"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => {
              const isMe = u.id === myId
              const isAdmin = u.role === 'maintainer'
              return (
                <tr key={u.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <span className="font-medium">{researcherLabel(u.name, u.token)}</span>
                      <ContactLinks links={u.links} />
                      {u.providers.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {u.providers.join(', ')}
                        </span>
                      )}
                      {isMe && <span className="text-xs text-muted-foreground">(you)</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(isAdmin ? 'font-medium text-forest' : 'text-muted-foreground')}>
                      {isAdmin ? 'Maintainer' : 'Researcher'}
                    </span>
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-muted-foreground sm:table-cell">
                    {formatDate(u.createdAt)}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    <span className="data">{u.nominations}</span>{' '}
                    {u.nominations === 1 ? 'nomination' : 'nominations'},{' '}
                    <span className="data">{u.contributions}</span>{' '}
                    {u.contributions === 1 ? 'team' : 'teams'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isMe ? (
                      null
                    ) : isAdmin ? (
                      <button
                        onClick={() => change(u, 'user')}
                        disabled={maintainers <= 1}
                        title={maintainers <= 1 ? 'Cannot remove the last maintainer' : undefined}
                        className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-destructive hover:underline disabled:opacity-40"
                      >
                        Remove maintainer role
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (window.confirm(`Make ${researcherLabel(u.name, u.token)} a maintainer? They will be able to approve nominations and moderate comments.`)) {
                            change(u, 'maintainer')
                          }
                        }}
                        className="text-xs font-medium text-forest underline-offset-2 hover:underline"
                      >
                        Make maintainer
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
