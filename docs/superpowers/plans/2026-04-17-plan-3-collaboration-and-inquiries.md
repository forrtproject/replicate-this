# Replicate This v2 — Plan 3: Collaboration & Inquiries

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the claims system with nominator vetting, the private collaboration hub (info panel, message board, live chat, shared links), in-app notifications, the inquiry system with Postmark email relay, and ghost nominator recovery.

**Architecture:** Claims and hub access use Next.js Server Actions as the primary gate, with Supabase RLS as a second enforcement layer. Live chat uses Supabase Realtime, subscribed only after server-side membership is confirmed. Email delivery is best-effort via Postmark using OAuth access tokens fetched transiently.

**Tech Stack:** Next.js 15 Server Actions, Supabase Realtime, Postmark, Better Auth accounts table, Vitest

**Prerequisite:** Plans 1 and 2 must be completed.

---

## File Map

```
src/
├── app/
│   ├── dashboard/
│   │   ├── layout.tsx                        # Protected user layout with notification bell
│   │   └── page.tsx                          # Claims inbox + user's nominations
│   └── hub/
│       └── [group_id]/
│           ├── layout.tsx                    # Membership gate (server-side notFound)
│           └── page.tsx                      # Hub: info + message board + live chat + links
├── components/
│   ├── dashboard/
│   │   ├── claim-inbox.tsx                   # Pending claims list for nominators
│   │   └── my-nominations.tsx                # User's submitted nominations
│   ├── hub/
│   │   ├── hub-info.tsx                      # Member tokens + nomination metadata + links
│   │   ├── hub-links-panel.tsx               # Shared external links
│   │   ├── hub-posts.tsx                     # Async threaded message board
│   │   ├── hub-post-form.tsx                 # Post/reply form
│   │   ├── hub-chat.tsx                      # Realtime chat panel
│   │   └── hub-chat-input.tsx                # Chat message input
│   ├── notifications/
│   │   └── notification-bell.tsx             # Bell icon with unread count
│   └── nominations/
│       └── inquiry-form.tsx                  # Third-party inquiry form
├── actions/
│   ├── claims.ts                             # submitClaim, acceptClaim, declineClaim
│   ├── hub.ts                                # addPost, addLink, promoteNominator
│   └── inquiries.ts                          # sendInquiry
└── lib/
    ├── email.ts                              # Postmark client + transient email fetch
    └── profile.ts                            # Transient ORCID/GitHub profile fetch
```

---

### Task 1: Claims Server Actions

**Files:**
- Create: `src/actions/claims.ts`

- [ ] **Step 1: Write claims Server Actions**

Create `src/actions/claims.ts`:
```typescript
'use server'

import { auth } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error('Not authenticated')
  return session
}

export type ClaimResult =
  | { success: true }
  | { success: false; error: string }

export async function submitClaim(nominationId: string, message: string): Promise<ClaimResult> {
  const session = await requireSession()
  const claimantUid = session.user.id

  if (!message.trim() || message.trim().length < 10) {
    return { success: false, error: 'Please provide a meaningful pitch (at least 10 characters).' }
  }

  // Check nomination exists and is claimable
  const { data: nomination } = await adminClient
    .from('nominations')
    .select('id, status, nominator_uid')
    .eq('id', nominationId)
    .in('status', ['approved', 'in_progress'])
    .single()

  if (!nomination) return { success: false, error: 'Nomination not found or not open for claims.' }
  if (nomination.nominator_uid === claimantUid) {
    return { success: false, error: 'You cannot claim your own nomination.' }
  }

  // Check no existing active claim from this user
  const { data: existing } = await adminClient
    .from('claims')
    .select('id')
    .eq('nomination_id', nominationId)
    .eq('claimant_uid', claimantUid)
    .in('status', ['pending', 'accepted'])
    .maybeSingle()

  if (existing) return { success: false, error: 'You already have an active claim on this study.' }

  const { data: claim, error } = await adminClient
    .from('claims')
    .insert({ nomination_id: nominationId, claimant_uid: claimantUid, message: message.trim() })
    .select('id')
    .single()

  if (error || !claim) return { success: false, error: 'Failed to submit claim.' }

  // Notify nominator
  if (nomination.nominator_uid) {
    await adminClient.from('in_app_notifications').insert({
      user_uid: nomination.nominator_uid,
      type: 'new_claim',
      data: { nomination_id: nominationId, claim_id: claim.id },
    })
  }

  // Confirm to claimant
  await adminClient.from('in_app_notifications').insert({
    user_uid: claimantUid,
    type: 'claim_accepted',
    data: { nomination_id: nominationId, claim_id: claim.id, status: 'pending' },
  })

  revalidatePath(`/nominations/${nominationId}`)
  return { success: true }
}

export async function acceptClaim(claimId: string): Promise<ClaimResult> {
  const session = await requireSession()
  const nominatorUid = session.user.id

  // Confirm caller is the nominator of the nomination this claim belongs to
  const { data: claim } = await adminClient
    .from('claims')
    .select('id, nomination_id, claimant_uid, status, nominations(nominator_uid)')
    .eq('id', claimId)
    .single()

  if (!claim) return { success: false, error: 'Claim not found.' }
  const nomination = claim.nominations as { nominator_uid: string } | null
  if (nomination?.nominator_uid !== nominatorUid) {
    return { success: false, error: 'Only the nominator can accept claims.' }
  }
  if (claim.status !== 'pending') return { success: false, error: 'This claim is no longer pending.' }

  // The accept_claim DB trigger handles group creation and nomination status update
  await adminClient.from('claims').update({ status: 'accepted' }).eq('id', claimId)

  // Notify claimant
  await adminClient.from('in_app_notifications').insert({
    user_uid: claim.claimant_uid,
    type: 'claim_accepted',
    data: { claim_id: claimId, nomination_id: claim.nomination_id },
  })

  revalidatePath('/dashboard')
  revalidatePath(`/nominations/${claim.nomination_id}`)
  return { success: true }
}

export async function declineClaim(claimId: string, note?: string): Promise<ClaimResult> {
  const session = await requireSession()
  const nominatorUid = session.user.id

  const { data: claim } = await adminClient
    .from('claims')
    .select('id, nomination_id, claimant_uid, nominations(nominator_uid)')
    .eq('id', claimId)
    .single()

  if (!claim) return { success: false, error: 'Claim not found.' }
  const nomination = claim.nominations as { nominator_uid: string } | null
  if (nomination?.nominator_uid !== nominatorUid) {
    return { success: false, error: 'Only the nominator can decline claims.' }
  }

  await adminClient.from('claims').update({ status: 'rejected' }).eq('id', claimId)

  await adminClient.from('in_app_notifications').insert({
    user_uid: claim.claimant_uid,
    type: 'claim_rejected',
    data: { claim_id: claimId, nomination_id: claim.nomination_id, note: note ?? '' },
  })

  revalidatePath('/dashboard')
  return { success: true }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/actions/claims.ts
git commit -m "feat: add claim submission, acceptance, and decline Server Actions"
```

---

### Task 2: Transient Profile Fetch

**Files:**
- Create: `src/lib/profile.ts`

- [ ] **Step 1: Implement profile utility**

Create `src/lib/profile.ts`:
```typescript
'use server'

import { adminClient } from '@/lib/supabase/admin'

export interface TransientProfile {
  provider: string
  displayName?: string
  bio?: string
  url?: string
}

export async function fetchTransientProfile(userUid: string): Promise<TransientProfile | null> {
  // Get the stored OAuth access token from Better Auth's accounts table
  const { data: account } = await adminClient
    .from('accounts')
    .select('provider_id, access_token, refresh_token')
    .eq('user_id', userUid)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!account?.access_token) return null

  try {
    if (account.provider_id === 'github') {
      const res = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          Accept: 'application/vnd.github+json',
        },
      })
      if (!res.ok) return null
      const data = await res.json()
      return {
        provider: 'github',
        displayName: data.login,
        bio: data.bio,
        url: data.html_url,
      }
    }

    if (account.provider_id === 'google') {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${account.access_token}` },
      })
      if (!res.ok) return null
      const data = await res.json()
      return {
        provider: 'google',
        bio: undefined,
        url: undefined,
      }
    }

    if (account.provider_id === 'orcid') {
      const orcidId = account.access_token
        ? await getOrcidId(account.access_token)
        : null
      if (!orcidId) return null
      const res = await fetch(`https://pub.orcid.org/v3.0/${orcidId}/person`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${account.access_token}` },
      })
      if (!res.ok) return null
      const data = await res.json()
      return {
        provider: 'orcid',
        bio: data.biography?.content,
        url: `https://orcid.org/${orcidId}`,
      }
    }
  } catch {
    return null
  }

  return null
}

async function getOrcidId(accessToken: string): Promise<string | null> {
  const res = await fetch('https://orcid.org/oauth/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.sub ?? null
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/profile.ts
git commit -m "feat: add transient OAuth profile fetch (no data persisted)"
```

---

### Task 3: User Dashboard

**Files:**
- Create: `src/app/dashboard/layout.tsx`
- Create: `src/app/dashboard/page.tsx`
- Create: `src/components/dashboard/claim-inbox.tsx`
- Create: `src/components/dashboard/my-nominations.tsx`

- [ ] **Step 1: Create dashboard layout**

Create `src/app/dashboard/layout.tsx`:
```typescript
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/sign-in?callbackUrl=/dashboard')

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Create claim inbox component**

Create `src/components/dashboard/claim-inbox.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { acceptClaim, declineClaim } from '@/actions/claims'
import { fetchTransientProfile, type TransientProfile } from '@/lib/profile'
import type { Claim } from '@/types'

interface ClaimWithNomination extends Claim {
  nominations: { metadata: { title: string } }
}

interface Props {
  claims: ClaimWithNomination[]
}

export function ClaimInbox({ claims }: Props) {
  const [profile, setProfile] = useState<TransientProfile | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(false)

  async function viewProfile(userUid: string) {
    setLoadingProfile(true)
    setProfileOpen(true)
    const data = await fetchTransientProfile(userUid)
    setProfile(data)
    setLoadingProfile(false)
  }

  if (claims.length === 0) {
    return <p className="text-sm text-muted-foreground">No pending claims on your nominations.</p>
  }

  return (
    <>
      <div className="space-y-3">
        {claims.map((claim) => (
          <div key={claim.id} className="border rounded-lg p-4 bg-white">
            <p className="text-xs text-muted-foreground mb-1">
              Claim on: <span className="font-medium">{claim.nominations.metadata.title}</span>
            </p>
            <button
              onClick={() => viewProfile(claim.claimant_uid)}
              className="text-xs text-emerald-600 underline mb-2 block"
            >
              Researcher #{claim.claimant_uid.slice(0, 6)}
            </button>
            <p className="text-sm mb-3 bg-gray-50 rounded p-2">{claim.message}</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => acceptClaim(claim.id)}>Accept</Button>
              <Button size="sm" variant="outline" onClick={() => declineClaim(claim.id)}>Decline</Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Researcher Profile</DialogTitle>
          </DialogHeader>
          {loadingProfile && <p className="text-sm text-muted-foreground">Loading profile…</p>}
          {!loadingProfile && !profile && (
            <p className="text-sm text-muted-foreground">No public profile available for this researcher.</p>
          )}
          {profile && (
            <div className="space-y-2 text-sm">
              <p className="capitalize font-medium">{profile.provider}</p>
              {profile.bio && <p>{profile.bio}</p>}
              {profile.url && (
                <a href={profile.url} target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline">
                  View profile
                </a>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 3: Create my-nominations component**

Create `src/components/dashboard/my-nominations.tsx`:
```typescript
import Link from 'next/link'
import { StatusBadge } from '@/components/nominations/status-badge'
import type { Nomination } from '@/types'

export function MyNominations({ nominations }: { nominations: Nomination[] }) {
  if (nominations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        You haven't nominated any studies yet.{' '}
        <Link href="/nominate" className="text-emerald-600 underline">Nominate one.</Link>
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {nominations.map((n) => (
        <div key={n.id} className="border rounded-lg p-3 bg-white flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {(n.metadata as { title?: string })?.title ?? n.doi}
            </p>
            <p className="text-xs text-muted-foreground">{n.doi}</p>
          </div>
          <StatusBadge status={n.status} />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Create dashboard page**

Create `src/app/dashboard/page.tsx`:
```typescript
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { adminClient } from '@/lib/supabase/admin'
import { ClaimInbox } from '@/components/dashboard/claim-inbox'
import { MyNominations } from '@/components/dashboard/my-nominations'
import type { Nomination } from '@/types'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  const userUid = session!.user.id

  const [{ data: myNominations }, { data: pendingClaims }] = await Promise.all([
    adminClient
      .from('nominations')
      .select('*')
      .eq('nominator_uid', userUid)
      .order('created_at', { ascending: false }),
    adminClient
      .from('claims')
      .select('*, nominations(metadata)')
      .eq('status', 'pending')
      .in('nomination_id',
        adminClient.from('nominations').select('id').eq('nominator_uid', userUid)
      ),
  ])

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-lg font-semibold mb-4">Pending Claims on Your Nominations</h2>
        <ClaimInbox claims={(pendingClaims ?? []) as any} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">My Nominations</h2>
        <MyNominations nominations={(myNominations ?? []) as Nomination[]} />
      </section>
    </div>
  )
}
```

- [ ] **Step 5: Test dashboard in browser**

```bash
npm run dev
```
Sign in and navigate to http://localhost:3000/dashboard. Expected: sections render (empty state messages shown if no data). Submit a nomination and claim it with another account to verify the claim inbox populates.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/ src/components/dashboard/
git commit -m "feat: add user dashboard with claim inbox and transient profile view"
```

---

### Task 4: Collaboration Hub Layout and Access Gate

**Files:**
- Create: `src/app/hub/[group_id]/layout.tsx`
- Create: `src/app/hub/[group_id]/page.tsx`

- [ ] **Step 1: Create hub layout with membership gate**

Create `src/app/hub/[group_id]/layout.tsx`:
```typescript
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { adminClient } from '@/lib/supabase/admin'

interface Props {
  children: React.ReactNode
  params: Promise<{ group_id: string }>
}

export default async function HubLayout({ children, params }: Props) {
  const { group_id } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) notFound()

  const { data: membership } = await adminClient
    .from('working_group_members')
    .select('role')
    .eq('group_id', group_id)
    .eq('user_uid', session.user.id)
    .maybeSingle()

  if (!membership) notFound()

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="text-xs text-muted-foreground mb-6">
        Working Group Hub · Your role: <span className="capitalize font-medium">{membership.role}</span>
      </div>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Create hub page shell**

Create `src/app/hub/[group_id]/page.tsx`:
```typescript
import { adminClient } from '@/lib/supabase/admin'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { HubInfo } from '@/components/hub/hub-info'
import { HubPosts } from '@/components/hub/hub-posts'
import { HubChat } from '@/components/hub/hub-chat'

interface Props {
  params: Promise<{ group_id: string }>
}

export const dynamic = 'force-dynamic'

export default async function HubPage({ params }: Props) {
  const { group_id } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  const userUid = session!.user.id

  const [
    { data: group },
    { data: members },
    { data: posts },
    { data: links },
    { data: messages },
  ] = await Promise.all([
    adminClient.from('working_groups').select('*, nominations(*)').eq('id', group_id).single(),
    adminClient.from('working_group_members').select('*').eq('group_id', group_id),
    adminClient.from('hub_posts').select('*').eq('group_id', group_id).is('parent_id', null).order('created_at'),
    adminClient.from('hub_links').select('*').eq('group_id', group_id).order('created_at'),
    adminClient.from('hub_messages').select('*').eq('group_id', group_id).order('created_at').limit(50),
  ])

  if (!group) return null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1">
        <HubInfo
          group={group as any}
          members={(members ?? []) as any}
          links={(links ?? []) as any}
          groupId={group_id}
          userUid={userUid}
        />
      </div>
      <div className="lg:col-span-2 space-y-8">
        <HubPosts
          posts={(posts ?? []) as any}
          groupId={group_id}
          userUid={userUid}
        />
        <HubChat
          initialMessages={(messages ?? []) as any}
          groupId={group_id}
          userUid={userUid}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/hub/
git commit -m "feat: add hub layout with server-side membership gate"
```

---

### Task 5: Hub Info Panel and Shared Links

**Files:**
- Create: `src/components/hub/hub-info.tsx`
- Create: `src/components/hub/hub-links-panel.tsx`
- Create: `src/actions/hub.ts`

- [ ] **Step 1: Write hub Server Actions**

Create `src/actions/hub.ts`:
```typescript
'use server'

import { auth } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

async function requireMember(groupId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error('Not authenticated')

  const { data } = await adminClient
    .from('working_group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_uid', session.user.id)
    .maybeSingle()

  if (!data) throw new Error('Not a member of this group')
  return { userUid: session.user.id, role: data.role }
}

export async function addLink(groupId: string, url: string, label: string): Promise<void> {
  const { userUid } = await requireMember(groupId)

  try { new URL(url) } catch { throw new Error('Invalid URL') }
  if (!label.trim()) throw new Error('Label is required')

  await adminClient.from('hub_links').insert({
    group_id: groupId,
    url,
    label: label.trim(),
    added_by_uid: userUid,
  })

  revalidatePath(`/hub/${groupId}`)
}

export async function addPost(groupId: string, content: string, parentId?: string): Promise<void> {
  const { userUid } = await requireMember(groupId)
  if (!content.trim()) throw new Error('Post content is required')

  await adminClient.from('hub_posts').insert({
    group_id: groupId,
    author_uid: userUid,
    content: content.trim(),
    parent_id: parentId ?? null,
  })

  revalidatePath(`/hub/${groupId}`)
}

export async function sendChatMessage(groupId: string, content: string): Promise<void> {
  const { userUid } = await requireMember(groupId)
  if (!content.trim()) return

  await adminClient.from('hub_messages').insert({
    group_id: groupId,
    author_uid: userUid,
    content: content.trim(),
  })
}

export async function promoteNominator(
  groupId: string,
  targetUserUid: string,
  reason: string
): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() })
  const role = session?.user?.role as string | undefined
  if (role !== 'maintainer') throw new Error('Only admins can promote nominators')
  if (!reason.trim()) throw new Error('Reason is required')

  // Demote existing nominator to replicator
  await adminClient
    .from('working_group_members')
    .update({ role: 'replicator' })
    .eq('group_id', groupId)
    .eq('role', 'nominator')

  // Promote target to nominator
  await adminClient
    .from('working_group_members')
    .update({ role: 'nominator' })
    .eq('group_id', groupId)
    .eq('user_uid', targetUserUid)

  // Get nomination_id for log
  const { data: group } = await adminClient
    .from('working_groups')
    .select('nomination_id')
    .eq('id', groupId)
    .single()

  await adminClient.from('moderation_logs').insert({
    admin_uid: session!.user.id,
    nomination_id: group?.nomination_id,
    action: 'promote_nominator',
    reason,
  })

  revalidatePath(`/hub/${groupId}`)
}
```

- [ ] **Step 2: Create hub info and links panel**

Create `src/components/hub/hub-info.tsx`:
```typescript
import type { WorkingGroup, WorkingGroupMember, HubLink, Nomination } from '@/types'
import { HubLinksPanel } from './hub-links-panel'

interface Props {
  group: WorkingGroup & { nominations: Nomination }
  members: WorkingGroupMember[]
  links: HubLink[]
  groupId: string
  userUid: string
}

export function HubInfo({ group, members, links, groupId, userUid }: Props) {
  const nomination = group.nominations
  const metadata = nomination?.metadata as { title?: string; journal?: string; publication_date?: string } ?? {}

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Study</h2>
        <p className="font-semibold text-sm leading-snug mb-1">{metadata.title}</p>
        <p className="text-xs text-muted-foreground">{metadata.journal} · {metadata.publication_date?.slice(0, 4)}</p>
        <p className="text-xs text-muted-foreground mt-1">DOI: {nomination?.doi}</p>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Members</h2>
        <ul className="space-y-1">
          {members.map((m) => (
            <li key={m.user_uid} className="text-xs flex items-center gap-2">
              <span className="font-mono">#{m.user_uid.slice(0, 6)}</span>
              <span className="capitalize text-muted-foreground">{m.role}</span>
              {m.user_uid === userUid && <span className="text-emerald-600">(you)</span>}
            </li>
          ))}
        </ul>
      </div>

      <HubLinksPanel links={links} groupId={groupId} />
    </div>
  )
}
```

Create `src/components/hub/hub-links-panel.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { addLink } from '@/actions/hub'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { HubLink } from '@/types'

export function HubLinksPanel({ links, groupId }: { links: HubLink[]; groupId: string }) {
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  async function handleAdd() {
    setError('')
    try {
      await addLink(groupId, url, label)
      setUrl('')
      setLabel('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add link')
    }
  }

  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Shared Links</h2>
      <ul className="space-y-1 mb-3">
        {links.map((l) => (
          <li key={l.id}>
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 underline">
              {l.label}
            </a>
          </li>
        ))}
        {links.length === 0 && <li className="text-xs text-muted-foreground">No links yet.</li>}
      </ul>

      {adding ? (
        <div className="space-y-2">
          <Input placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} className="text-xs h-7" />
          <Input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} className="text-xs h-7" />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-1">
            <Button size="sm" className="h-7 text-xs" onClick={handleAdd}>Add</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAdding(true)}>+ Add link</Button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/actions/hub.ts src/components/hub/hub-info.tsx src/components/hub/hub-links-panel.tsx
git commit -m "feat: add hub Server Actions, info panel, and shared links"
```

---

### Task 6: Hub Message Board

**Files:**
- Create: `src/components/hub/hub-posts.tsx`
- Create: `src/components/hub/hub-post-form.tsx`

- [ ] **Step 1: Create post form**

Create `src/components/hub/hub-post-form.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { addPost } from '@/actions/hub'

interface Props {
  groupId: string
  parentId?: string
  onDone?: () => void
  placeholder?: string
}

export function HubPostForm({ groupId, parentId, onDone, placeholder }: Props) {
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!content.trim()) return
    setSubmitting(true)
    await addPost(groupId, content, parentId)
    setContent('')
    setSubmitting(false)
    onDone?.()
  }

  return (
    <div className="space-y-2">
      <Textarea
        rows={3}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder ?? 'Write a post…'}
      />
      <Button size="sm" onClick={handleSubmit} disabled={submitting || !content.trim()}>
        {submitting ? 'Posting…' : 'Post'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Create posts board**

Create `src/components/hub/hub-posts.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { HubPostForm } from './hub-post-form'
import type { HubPost } from '@/types'

interface Props {
  posts: HubPost[]
  groupId: string
  userUid: string
}

export function HubPosts({ posts, groupId, userUid }: Props) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null)

  return (
    <section>
      <h2 className="text-base font-semibold mb-4">Message Board</h2>

      <div className="space-y-4 mb-6">
        {posts.length === 0 && (
          <p className="text-sm text-muted-foreground">No posts yet. Start the conversation.</p>
        )}
        {posts.map((post) => (
          <div key={post.id} className="border rounded-lg p-3 bg-white">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono text-muted-foreground">
                #{post.author_uid.slice(0, 6)}
                {post.author_uid === userUid ? ' (you)' : ''}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(post.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{post.content}</p>
            <button
              onClick={() => setReplyingTo(replyingTo === post.id ? null : post.id)}
              className="text-xs text-emerald-600 mt-2 hover:underline"
            >
              Reply
            </button>
            {replyingTo === post.id && (
              <div className="mt-3 pl-3 border-l-2 border-emerald-200">
                <HubPostForm
                  groupId={groupId}
                  parentId={post.id}
                  placeholder="Write a reply…"
                  onDone={() => setReplyingTo(null)}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <HubPostForm groupId={groupId} />
    </section>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/hub/hub-posts.tsx src/components/hub/hub-post-form.tsx
git commit -m "feat: add hub message board with threaded replies"
```

---

### Task 7: Hub Live Chat

**Files:**
- Create: `src/components/hub/hub-chat.tsx`
- Create: `src/components/hub/hub-chat-input.tsx`

- [ ] **Step 1: Create chat input**

Create `src/components/hub/hub-chat-input.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { sendChatMessage } from '@/actions/hub'

export function HubChatInput({ groupId }: { groupId: string }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend() {
    if (!text.trim()) return
    setSending(true)
    await sendChatMessage(groupId, text)
    setText('')
    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex gap-2">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Send a message… (Enter to send)"
        disabled={sending}
      />
      <Button size="sm" onClick={handleSend} disabled={sending || !text.trim()}>
        Send
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Create live chat panel with Supabase Realtime**

Create `src/components/hub/hub-chat.tsx`:
```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { HubChatInput } from './hub-chat-input'
import type { HubMessage } from '@/types'

interface Props {
  initialMessages: HubMessage[]
  groupId: string
  userUid: string
}

export function HubChat({ initialMessages, groupId, userUid }: Props) {
  const [messages, setMessages] = useState<HubMessage[]>(initialMessages)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel(`hub-chat-${groupId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'hub_messages',
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as HubMessage])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [groupId, supabase])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <section>
      <h2 className="text-base font-semibold mb-4">Live Chat</h2>

      <div className="border rounded-lg bg-white">
        <div className="h-64 overflow-y-auto p-3 space-y-2">
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center mt-8">No messages yet.</p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex gap-2 ${m.author_uid === userUid ? 'flex-row-reverse' : ''}`}>
              <span className="text-xs font-mono text-muted-foreground shrink-0 mt-1">
                #{m.author_uid.slice(0, 6)}
              </span>
              <div className={`rounded-lg px-3 py-1.5 text-sm max-w-xs ${
                m.author_uid === userUid
                  ? 'bg-emerald-100 text-emerald-900'
                  : 'bg-gray-100 text-gray-900'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="border-t p-3">
          <HubChatInput groupId={groupId} />
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Test live chat in browser**

Open two browser windows signed in as different group members. Navigate to the same `/hub/[group_id]`. Send a message in one window — verify it appears in the other in real-time without a page refresh.

Attempt to access `/hub/[group_id]` as a non-member (sign out, or use a different account) — expected: 404.

- [ ] **Step 4: Commit**

```bash
git add src/components/hub/hub-chat.tsx src/components/hub/hub-chat-input.tsx
git commit -m "feat: add Supabase Realtime live chat in collaboration hub"
```

---

### Task 8: In-App Notifications Bell

**Files:**
- Create: `src/components/notifications/notification-bell.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create notification bell**

Create `src/components/notifications/notification-bell.tsx`:
```typescript
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell } from 'lucide-react'
import Link from 'next/link'
import type { InAppNotification } from '@/types'

interface Props {
  userUid: string
  initialUnread: number
}

export function NotificationBell({ userUid, initialUnread }: Props) {
  const [unread, setUnread] = useState(initialUnread)
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel(`notifications-${userUid}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'in_app_notifications',
          filter: `user_uid=eq.${userUid}`,
        },
        () => { setUnread((n) => n + 1) }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userUid, supabase])

  return (
    <Link href="/dashboard" className="relative inline-flex items-center p-2">
      <Bell className="w-5 h-5" />
      {unread > 0 && (
        <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  )
}
```

- [ ] **Step 2: Wire bell into root layout**

Modify `src/app/layout.tsx` to fetch unread count and render the bell for authenticated users:
```typescript
import type { Metadata } from 'next'
import './globals.css'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { adminClient } from '@/lib/supabase/admin'
import { NotificationBell } from '@/components/notifications/notification-bell'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Replicate This',
  description: 'A community registry for research replication nominations.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })

  let unreadCount = 0
  if (session) {
    const { count } = await adminClient
      .from('in_app_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_uid', session.user.id)
      .is('read_at', null)
    unreadCount = count ?? 0
  }

  return (
    <html lang="en">
      <body className="min-h-screen bg-white">
        <nav className="border-b px-4 py-3 flex items-center justify-between">
          <Link href="/registry" className="font-bold text-emerald-700 text-sm">Replicate This</Link>
          <div className="flex items-center gap-4">
            <Link href="/registry" className="text-sm text-muted-foreground hover:text-foreground">Registry</Link>
            {session ? (
              <>
                <Link href="/nominate" className="text-sm text-muted-foreground hover:text-foreground">Nominate</Link>
                <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">Dashboard</Link>
                <NotificationBell userUid={session.user.id} initialUnread={unreadCount} />
              </>
            ) : (
              <Link href="/sign-in" className="text-sm font-medium text-emerald-700">Sign In</Link>
            )}
          </div>
        </nav>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/notifications/ src/app/layout.tsx
git commit -m "feat: add real-time notification bell with unread count"
```

---

### Task 9: Postmark Email Client

**Files:**
- Create: `src/lib/email.ts`

- [ ] **Step 1: Install Postmark SDK**

```bash
npm install postmark
```

- [ ] **Step 2: Implement email client**

Create `src/lib/email.ts`:
```typescript
import * as postmark from 'postmark'
import { adminClient } from '@/lib/supabase/admin'

const client = new postmark.ServerClient(process.env.POSTMARK_API_TOKEN!)

export interface EmailPayload {
  to: string
  subject: string
  body: string
}

export async function sendEmail(payload: EmailPayload): Promise<'sent' | 'failed'> {
  try {
    await client.sendEmail({
      From: process.env.POSTMARK_FROM_EMAIL!,
      To: payload.to,
      Subject: payload.subject,
      TextBody: payload.body,
    })
    return 'sent'
  } catch {
    return 'failed'
  }
}

export async function fetchEmailForUser(userUid: string): Promise<string | null> {
  // Fetch OAuth access token from Better Auth accounts table
  const { data: account } = await adminClient
    .from('accounts')
    .select('provider_id, access_token')
    .eq('user_id', userUid)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!account?.access_token) return null

  try {
    if (account.provider_id === 'github') {
      const res = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          Accept: 'application/vnd.github+json',
        },
      })
      if (!res.ok) return null
      const emails: { email: string; primary: boolean; verified: boolean }[] = await res.json()
      return emails.find((e) => e.primary && e.verified)?.email ?? null
    }

    if (account.provider_id === 'google') {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${account.access_token}` },
      })
      if (!res.ok) return null
      const data = await res.json()
      return data.email ?? null
    }

    if (account.provider_id === 'orcid') {
      // ORCID emails are private by default; return null
      return null
    }
  } catch {
    return null
  }

  return null
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/email.ts
git commit -m "feat: add Postmark email client with transient OAuth email fetch"
```

---

### Task 10: Inquiry System

**Files:**
- Create: `src/actions/inquiries.ts`
- Create: `src/components/nominations/inquiry-form.tsx`
- Modify: `src/app/nominations/[id]/page.tsx`

- [ ] **Step 1: Write inquiry Server Action**

Create `src/actions/inquiries.ts`:
```typescript
'use server'

import { auth } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { fetchEmailForUser, sendEmail } from '@/lib/email'
import { headers } from 'next/headers'

export type InquiryResult =
  | { success: true }
  | { success: false; error: string }

export async function sendInquiry(nominationId: string, content: string): Promise<InquiryResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return { success: false, error: 'You must be signed in to send an inquiry.' }
  if (!content.trim() || content.trim().length < 10) {
    return { success: false, error: 'Please write a meaningful message (at least 10 characters).' }
  }

  const senderUid = session.user.id

  // Verify sender is not already a group member
  const { data: group } = await adminClient
    .from('working_groups')
    .select('id, working_group_members(user_uid)')
    .eq('nomination_id', nominationId)
    .maybeSingle()

  const memberUids = (group?.working_group_members as { user_uid: string }[] | null)?.map((m) => m.user_uid) ?? []
  if (memberUids.includes(senderUid)) {
    return { success: false, error: 'You are already a member of this working group.' }
  }

  // Write inquiry
  const { data: inquiry, error } = await adminClient
    .from('inquiries')
    .insert({
      nomination_id: nominationId,
      sender_uid: senderUid,
      content: content.trim(),
      delivery_status: 'pending',
    })
    .select('id')
    .single()

  if (error || !inquiry) return { success: false, error: 'Failed to send inquiry.' }

  // Notify group members in-app
  if (memberUids.length > 0) {
    await adminClient.from('in_app_notifications').insert(
      memberUids.map((uid) => ({
        user_uid: uid,
        type: 'new_inquiry',
        data: { nomination_id: nominationId, inquiry_id: inquiry.id },
      }))
    )
  }

  // Best-effort email relay: fetch and send, discard address immediately
  let deliveryStatus: 'sent' | 'failed' = 'failed'
  for (const uid of memberUids) {
    const email = await fetchEmailForUser(uid)
    if (email) {
      const status = await sendEmail({
        to: email,
        subject: 'New inquiry on your Replicate This working group',
        body: `Someone sent a message to your working group on Replicate This.\n\nMessage:\n${content.trim()}\n\nLog in to view and respond: ${process.env.BETTER_AUTH_URL}/dashboard`,
      })
      if (status === 'sent') deliveryStatus = 'sent'
    }
  }

  await adminClient
    .from('inquiries')
    .update({ delivery_status: deliveryStatus })
    .eq('id', inquiry.id)

  return { success: true }
}
```

- [ ] **Step 2: Create inquiry form component**

Create `src/components/nominations/inquiry-form.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { sendInquiry } from '@/actions/inquiries'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export function InquiryForm({ nominationId }: { nominationId: string }) {
  const [content, setContent] = useState('')
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null)
  const [sending, setSending] = useState(false)

  async function handleSubmit() {
    setSending(true)
    const res = await sendInquiry(nominationId, content)
    setResult(res)
    if (res.success) setContent('')
    setSending(false)
  }

  if (result?.success) {
    return <p className="text-sm text-emerald-600">Your inquiry was sent. The working group will be notified.</p>
  }

  return (
    <div className="space-y-2">
      <Textarea
        rows={4}
        placeholder="Introduce yourself and explain why you're interested in this replication effort…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      {result?.error && <p className="text-sm text-destructive">{result.error}</p>}
      <Button onClick={handleSubmit} disabled={sending || !content.trim()}>
        {sending ? 'Sending…' : 'Send Inquiry'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Create nomination detail page with inquiry form**

Create `src/app/nominations/[id]/page.tsx`:
```typescript
import { adminClient } from '@/lib/supabase/admin'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { StatusBadge } from '@/components/nominations/status-badge'
import { InquiryForm } from '@/components/nominations/inquiry-form'
import type { Nomination } from '@/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function NominationDetailPage({ params }: Props) {
  const { id } = await params
  const session = await auth.api.getSession({ headers: await headers() })

  const { data: nomination } = await adminClient
    .from('nominations')
    .select('*')
    .eq('id', id)
    .in('status', ['approved', 'in_progress'])
    .single()

  if (!nomination) notFound()

  const n = nomination as Nomination
  const metadata = n.metadata as { title?: string; authors?: string[]; journal?: string; publication_date?: string }

  // Check if user is a group member (to hide inquiry form for members)
  let isGroupMember = false
  if (session && n.status === 'in_progress') {
    const { data: group } = await adminClient
      .from('working_groups')
      .select('id, working_group_members(user_uid)')
      .eq('nomination_id', id)
      .maybeSingle()
    const memberUids = (group?.working_group_members as { user_uid: string }[] | null)?.map((m) => m.user_uid) ?? []
    isGroupMember = memberUids.includes(session.user.id)
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-2">
        <StatusBadge status={n.status} />
      </div>
      <h1 className="text-xl font-bold mb-1">{metadata.title ?? n.doi}</h1>
      <p className="text-sm text-muted-foreground mb-1">
        {metadata.authors?.join(', ')} · {metadata.journal} ({metadata.publication_date?.slice(0, 4)})
      </p>
      <p className="text-xs text-muted-foreground mb-6">DOI: {n.doi}</p>

      <section className="mb-8">
        <h2 className="text-sm font-semibold mb-1">Why this study needs replication</h2>
        <p className="text-sm">{n.justification}</p>
      </section>

      {session && !isGroupMember && n.status === 'in_progress' && (
        <section>
          <h2 className="text-base font-semibold mb-3">Send an Inquiry to the Working Group</h2>
          <InquiryForm nominationId={id} />
        </section>
      )}

      {!session && n.status === 'in_progress' && (
        <p className="text-sm text-muted-foreground">
          <a href="/sign-in" className="text-emerald-600 underline">Sign in</a> to send an inquiry to the working group.
        </p>
      )}
    </main>
  )
}
```

- [ ] **Step 4: Test inquiry flow in browser**

Sign in as a non-member. Open a nomination with `status: in_progress`. Send an inquiry. Expected: success message shown. Check the `/dashboard` of a group member — verify the notification appears. Check Postmark dashboard — verify email was sent or logged as failed gracefully.

- [ ] **Step 5: Commit**

```bash
git add src/actions/inquiries.ts src/components/nominations/inquiry-form.tsx src/app/nominations/
git commit -m "feat: add inquiry system with in-app notifications and Postmark email relay"
```

---

### Task 11: Ghost Nominator Recovery (Admin Action)

**Files:**
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Add promote nominator UI to admin page**

Add a working groups section to `src/app/admin/page.tsx`. Replace the existing `export default async function AdminPage` with:

```typescript
import { adminClient } from '@/lib/supabase/admin'
import { ModerationQueue } from '@/components/admin/moderation-queue'
import { promoteNominator } from '@/actions/hub'
import type { Nomination } from '@/types'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const [
    { data: pending },
    { data: archived },
    { data: groups },
  ] = await Promise.all([
    adminClient.from('nominations').select('*').eq('status', 'pending').order('created_at', { ascending: true }),
    adminClient.from('nominations').select('*').eq('status', 'rejected').order('created_at', { ascending: false }).limit(50),
    adminClient
      .from('working_groups')
      .select('id, nomination_id, nominations(metadata), working_group_members(user_uid, role)')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-12">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Pending ({pending?.length ?? 0})
        </h2>
        <ModerationQueue nominations={(pending ?? []) as Nomination[]} mode="pending" />
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Archived / Rejected
        </h2>
        <ModerationQueue nominations={(archived ?? []) as Nomination[]} mode="archived" />
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Working Groups — Nominator Management
        </h2>
        <div className="space-y-4">
          {(groups ?? []).map((group) => {
            const members = group.working_group_members as { user_uid: string; role: string }[]
            const nomination = group.nominations as { metadata: { title?: string } } | null
            const replicators = members.filter((m) => m.role === 'replicator')

            return (
              <div key={group.id} className="border rounded-lg p-4 bg-white">
                <p className="text-sm font-medium mb-2 truncate">
                  {nomination?.metadata?.title ?? group.nomination_id}
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Nominator: #{members.find((m) => m.role === 'nominator')?.user_uid.slice(0, 6) ?? 'none'}
                </p>
                {replicators.length > 0 && (
                  <form
                    action={async (fd: FormData) => {
                      'use server'
                      const targetUid = fd.get('target_uid')?.toString() ?? ''
                      const reason = fd.get('reason')?.toString() ?? ''
                      await promoteNominator(group.id, targetUid, reason)
                    }}
                    className="space-y-2"
                  >
                    <select name="target_uid" className="text-xs border rounded p-1 w-full">
                      {replicators.map((r) => (
                        <option key={r.user_uid} value={r.user_uid}>
                          Replicator #{r.user_uid.slice(0, 6)}
                        </option>
                      ))}
                    </select>
                    <input
                      name="reason"
                      placeholder="Reason for promotion (required)"
                      className="text-xs border rounded p-1 w-full"
                      required
                    />
                    <button type="submit" className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded border border-amber-300 hover:bg-amber-200">
                      Promote to Nominator
                    </button>
                  </form>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </main>
  )
}
```

- [ ] **Step 2: Test in browser**

Navigate to http://localhost:3000/admin as a maintainer. Verify the working groups section shows replicators with a promotion form. Promote one — verify `working_group_members.role` updates and `moderation_logs` records the action.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: add ghost nominator recovery UI to admin dashboard"
```

---

---

### Task 12: Claim Button on Nomination Detail Page

**Files:**
- Create: `src/components/nominations/claim-form.tsx`
- Modify: `src/app/nominations/[id]/page.tsx`

- [ ] **Step 1: Create claim form component**

Create `src/components/nominations/claim-form.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { submitClaim, type ClaimResult } from '@/actions/claims'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export function ClaimForm({ nominationId }: { nominationId: string }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<ClaimResult | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (result?.success) {
    return (
      <p className="text-sm text-emerald-600">
        Your claim was submitted. The nominator will review it and you'll be notified of their decision.
      </p>
    )
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="w-full sm:w-auto">
        Claim this study
      </Button>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Tell the nominator why you're the right person to replicate this study — your expertise, lab resources, or timeline.
      </p>
      <Textarea
        rows={4}
        placeholder="I am a researcher at X with experience in Y methodology…"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      {result && !result.success && (
        <p className="text-sm text-destructive">{result.error}</p>
      )}
      <div className="flex gap-2">
        <Button
          onClick={async () => {
            setSubmitting(true)
            const res = await submitClaim(nominationId, message)
            setResult(res)
            setSubmitting(false)
          }}
          disabled={submitting || !message.trim()}
        >
          {submitting ? 'Submitting…' : 'Submit Claim'}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add claim form to nomination detail page**

In `src/app/nominations/[id]/page.tsx`, add the import at the top:
```typescript
import { ClaimForm } from '@/components/nominations/claim-form'
```

Then add this section to the JSX, after the justification section and before the inquiry section:
```typescript
{session && !isGroupMember && (
  <section className="mb-8">
    <h2 className="text-base font-semibold mb-3">Claim this study</h2>
    <ClaimForm nominationId={id} />
  </section>
)}

{!session && (
  <p className="text-sm text-muted-foreground mb-8">
    <a href="/sign-in" className="text-emerald-600 underline">Sign in</a> to claim this study or send an inquiry.
  </p>
)}
```

- [ ] **Step 3: Test claim flow in browser**

Sign in and navigate to an approved nomination. Expected: "Claim this study" button is visible. Click it, write a pitch, submit. Expected: success message. Switch to the nominator's account, go to `/dashboard` — expected: claim appears in the inbox with the pitch message and a researcher token link.

- [ ] **Step 4: Commit**

```bash
git add src/components/nominations/claim-form.tsx src/app/nominations/[id]/page.tsx
git commit -m "feat: add claim form to nomination detail page"
```

---

### Task 13: Delete Account (Right to Erasure)

**Files:**
- Create: `src/actions/account.ts`
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Write delete account Server Action**

Create `src/actions/account.ts`:
```typescript
'use server'

import { auth } from '@/lib/auth'
import { adminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export async function deleteAccount(): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) throw new Error('Not authenticated')

  const userUid = session.user.id

  // Purge user row — cascades to all activity via ON DELETE CASCADE
  // nominations.nominator_uid is SET NULL so public records are preserved
  await adminClient.auth.admin.deleteUser(userUid)

  // Sign out
  await auth.api.signOut({ headers: await headers() })

  redirect('/?deleted=1')
}
```

- [ ] **Step 2: Add delete account section to dashboard**

In `src/app/dashboard/page.tsx`, add the import:
```typescript
import { deleteAccount } from '@/actions/account'
```

Append this section inside the returned JSX, after the `MyNominations` section:
```typescript
<section className="border-t pt-8 mt-4">
  <h2 className="text-lg font-semibold mb-1 text-destructive">Danger Zone</h2>
  <p className="text-sm text-muted-foreground mb-4">
    Permanently deletes your account and all associated activity. Public nominations you submitted are retained with the nominator anonymised.
  </p>
  <form action={deleteAccount}>
    <button
      type="submit"
      className="text-sm text-destructive underline hover:no-underline"
      onClick={(e) => {
        if (!confirm('Are you sure? This cannot be undone.')) e.preventDefault()
      }}
    >
      Delete my account
    </button>
  </form>
</section>
```

- [ ] **Step 3: Test deletion in browser**

Sign in, navigate to `/dashboard`. Click "Delete my account" and confirm. Expected: redirected to `/?deleted=1`, all `in_app_notifications`, `votes`, `claims`, `hub_messages`, `hub_posts`, `hub_links`, and `working_group_members` rows for the user are gone. Any nominations they submitted retain their data with `nominator_uid = NULL`.

Verify in Supabase dashboard that the user row no longer exists.

- [ ] **Step 4: Commit**

```bash
git add src/actions/account.ts src/app/dashboard/page.tsx
git commit -m "feat: add GDPR right-to-erasure delete account with cascade purge"
```

---

**Plan 3 complete.** After all three plans are executed you will have the full Replicate This v2.0 platform: public registry, voting, nomination pipeline, admin moderation, claims and working groups, a collaboration hub with live chat, in-app notifications, the inquiry system with GDPR-compliant email relay, and single-click account deletion.
