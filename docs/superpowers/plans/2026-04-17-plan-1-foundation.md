# Replicate This v2 — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Next.js 15 project, define the complete database schema with RLS/triggers/views, configure zero-PII Better Auth with Google/GitHub/ORCID, and wire up route protection middleware.

**Architecture:** Next.js 15 App Router with Supabase (Frankfurt) as the database. Better Auth intercepts user creation to strip PII before any DB write. Middleware enforces authentication and role-based access at the edge.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Supabase (Postgres + Realtime), Better Auth, Vitest, @testing-library/react

---

## File Map

```
replicate-this/
├── src/
│   ├── app/
│   │   ├── layout.tsx                        # Root layout
│   │   ├── page.tsx                          # Home (redirects to /registry)
│   │   └── api/
│   │       └── auth/
│   │           └── [...betterauth]/
│   │               └── route.ts             # Better Auth catch-all handler
│   ├── lib/
│   │   ├── auth.ts                          # Better Auth config (zero-PII hooks)
│   │   ├── supabase/
│   │   │   ├── client.ts                    # Browser Supabase client
│   │   │   ├── server.ts                    # Server Supabase client (SSR)
│   │   │   └── admin.ts                     # Service-role client (server-only)
│   │   └── crypto.ts                        # SHA-256 hashing utilities
│   ├── types/
│   │   └── index.ts                         # Shared TypeScript types
│   ├── middleware.ts                         # Route protection
│   └── tests/
│       ├── setup.ts                         # Vitest global setup
│       └── lib/
│           └── crypto.test.ts               # Crypto utility tests
├── supabase/
│   └── migrations/
│       ├── 001_schema.sql                   # All table definitions
│       ├── 002_rls.sql                      # Row Level Security policies
│       ├── 003_views.sql                    # nomination_vote_totals view
│       └── 004_triggers.sql                 # last_activity + accept_claim triggers
├── vitest.config.ts
├── .env.local.example
└── package.json
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`, `.env.local.example`, `vitest.config.ts`, `src/tests/setup.ts`

- [ ] **Step 1: Bootstrap Next.js 15 with TypeScript and Tailwind**

```bash
npx create-next-app@latest replicate-this \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-eslint
cd replicate-this
```

- [ ] **Step 2: Install dependencies**

```bash
npm install better-auth @supabase/supabase-js @supabase/ssr
npm install -D vitest @vitejs/plugin-react jsdom \
  @testing-library/react @testing-library/user-event \
  @testing-library/jest-dom
```

- [ ] **Step 3: Create Vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 4: Create test setup file**

Create `src/tests/setup.ts`:
```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Add test script to package.json**

In `package.json`, add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Create environment variable template**

Create `.env.local.example`:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Better Auth
BETTER_AUTH_SECRET=your-32-char-secret
BETTER_AUTH_URL=http://localhost:3000

# OAuth Providers
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
ORCID_CLIENT_ID=
ORCID_CLIENT_SECRET=

# Privacy
UID_PEPPER=your-random-32-char-uid-pepper
EMAIL_PEPPER=your-random-32-char-email-pepper

# Email
POSTMARK_API_TOKEN=
POSTMARK_FROM_EMAIL=noreply@forrt.org
ADMIN_EMAIL=admin@forrt.org
```

- [ ] **Step 7: Verify setup builds**

```bash
npm run build
```
Expected: Build completes with no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 15 project with Vitest and Tailwind"
```

---

### Task 2: TypeScript Types

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Write types**

Create `src/types/index.ts`:
```typescript
export type NominationStatus = 'pending' | 'approved' | 'in_progress' | 'rejected'
export type ClaimStatus = 'pending' | 'accepted' | 'rejected'
export type DeliveryStatus = 'pending' | 'sent' | 'failed'
export type MemberRole = 'nominator' | 'replicator'
export type NotificationType =
  | 'new_claim'
  | 'claim_accepted'
  | 'claim_rejected'
  | 'new_inquiry'
  | 'nomination_rejected'
  | 'nomination_approved'

export interface NominationMetadata {
  title: string
  authors: string[]
  journal: string
  publication_date: string
}

export interface Nomination {
  id: string
  doi: string
  metadata: NominationMetadata
  discipline: string
  justification: string
  nominator_uid: string | null
  status: NominationStatus
  last_activity_at: string
  created_at: string
}

export interface NominationWithScore extends Nomination {
  score: number
}

export interface Vote {
  nomination_id: string
  user_uid: string
  value: 1 | -1
  created_at: string
}

export interface Claim {
  id: string
  nomination_id: string
  claimant_uid: string
  message: string
  status: ClaimStatus
  created_at: string
}

export interface WorkingGroup {
  id: string
  nomination_id: string
  created_at: string
}

export interface WorkingGroupMember {
  group_id: string
  user_uid: string
  role: MemberRole
  joined_at: string
}

export interface HubPost {
  id: string
  group_id: string
  author_uid: string
  content: string
  parent_id: string | null
  created_at: string
}

export interface HubMessage {
  id: string
  group_id: string
  author_uid: string
  content: string
  created_at: string
}

export interface HubLink {
  id: string
  group_id: string
  url: string
  label: string
  added_by_uid: string
  created_at: string
}

export interface Inquiry {
  id: string
  nomination_id: string
  sender_uid: string
  content: string
  delivery_status: DeliveryStatus
  created_at: string
  read_at: string | null
}

export interface InAppNotification {
  id: string
  user_uid: string
  type: NotificationType
  data: Record<string, unknown>
  read_at: string | null
  created_at: string
}

export interface ModerationLog {
  id: string
  admin_uid: string
  nomination_id: string
  action: string
  reason: string | null
  timestamp: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add shared TypeScript types"
```

---

### Task 3: Crypto Utilities

**Files:**
- Create: `src/lib/crypto.ts`
- Create: `src/tests/lib/crypto.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/tests/lib/crypto.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { hashWithPepper, deterministicEmail } from '@/lib/crypto'

describe('hashWithPepper', () => {
  it('produces a hex string of 64 characters', () => {
    const result = hashWithPepper('input', 'pepper')
    expect(result).toHaveLength(64)
    expect(result).toMatch(/^[a-f0-9]+$/)
  })

  it('is deterministic for same input and pepper', () => {
    const a = hashWithPepper('same', 'pepper')
    const b = hashWithPepper('same', 'pepper')
    expect(a).toBe(b)
  })

  it('differs when pepper changes', () => {
    const a = hashWithPepper('same', 'pepper1')
    const b = hashWithPepper('same', 'pepper2')
    expect(a).not.toBe(b)
  })
})

describe('deterministicEmail', () => {
  it('returns a string ending in @privacy.forrt.org', () => {
    const email = deterministicEmail('user@example.com', 'pepper')
    expect(email).toMatch(/@privacy\.forrt\.org$/)
  })

  it('is stable across calls', () => {
    const a = deterministicEmail('user@example.com', 'pepper')
    const b = deterministicEmail('user@example.com', 'pepper')
    expect(a).toBe(b)
  })

  it('differs for different real emails', () => {
    const a = deterministicEmail('alice@example.com', 'pepper')
    const b = deterministicEmail('bob@example.com', 'pepper')
    expect(a).not.toBe(b)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test src/tests/lib/crypto.test.ts
```
Expected: FAIL — `Cannot find module '@/lib/crypto'`

- [ ] **Step 3: Implement crypto utilities**

Create `src/lib/crypto.ts`:
```typescript
import { createHash } from 'crypto'

export function hashWithPepper(input: string, pepper: string): string {
  return createHash('sha256')
    .update(input + pepper)
    .digest('hex')
}

export function deterministicEmail(rawEmail: string, pepper: string): string {
  const hash = hashWithPepper(rawEmail.toLowerCase().trim(), pepper)
  return `${hash}@privacy.forrt.org`
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test src/tests/lib/crypto.test.ts
```
Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/crypto.ts src/tests/lib/crypto.test.ts
git commit -m "feat: add deterministic hashing utilities"
```

---

### Task 4: Database Schema Migration

**Files:**
- Create: `supabase/migrations/001_schema.sql`

- [ ] **Step 1: Install Supabase CLI and initialise project**

```bash
npm install -D supabase
npx supabase init
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
```

- [ ] **Step 2: Write schema migration**

Create `supabase/migrations/001_schema.sql`:
```sql
-- Enable UUID generation
create extension if not exists "pgcrypto";

-- Enum types
create type nomination_status as enum ('pending', 'approved', 'in_progress', 'rejected');
create type claim_status as enum ('pending', 'accepted', 'rejected');
create type delivery_status as enum ('pending', 'sent', 'failed');
create type member_role as enum ('nominator', 'replicator');

-- nominations
create table nominations (
  id uuid primary key default gen_random_uuid(),
  doi text not null,
  metadata jsonb not null default '{}',
  discipline text not null,
  justification text not null,
  nominator_uid text references auth.users(id) on delete set null,
  status nomination_status not null default 'pending',
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint nominations_doi_unique unique (doi)
);

-- votes
create table votes (
  nomination_id uuid not null references nominations(id) on delete cascade,
  user_uid text not null references auth.users(id) on delete cascade,
  value smallint not null check (value in (1, -1)),
  created_at timestamptz not null default now(),
  primary key (nomination_id, user_uid)
);

-- claims
create table claims (
  id uuid primary key default gen_random_uuid(),
  nomination_id uuid not null references nominations(id) on delete cascade,
  claimant_uid text not null references auth.users(id) on delete cascade,
  message text not null,
  status claim_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- working_groups
create table working_groups (
  id uuid primary key default gen_random_uuid(),
  nomination_id uuid not null references nominations(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- working_group_members
create table working_group_members (
  group_id uuid not null references working_groups(id) on delete cascade,
  user_uid text not null references auth.users(id) on delete cascade,
  role member_role not null default 'replicator',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_uid)
);
create index idx_wgm_group_user on working_group_members(group_id, user_uid);

-- hub_posts
create table hub_posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references working_groups(id) on delete cascade,
  author_uid text not null references auth.users(id) on delete cascade,
  content text not null,
  parent_id uuid references hub_posts(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- hub_messages
create table hub_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references working_groups(id) on delete cascade,
  author_uid text not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- hub_links
create table hub_links (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references working_groups(id) on delete cascade,
  url text not null,
  label text not null,
  added_by_uid text not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- inquiries
create table inquiries (
  id uuid primary key default gen_random_uuid(),
  nomination_id uuid not null references nominations(id) on delete cascade,
  sender_uid text not null references auth.users(id) on delete cascade,
  content text not null,
  delivery_status delivery_status not null default 'pending',
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- in_app_notifications
create table in_app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_uid text not null references auth.users(id) on delete cascade,
  type text not null,
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- moderation_logs
create table moderation_logs (
  id uuid primary key default gen_random_uuid(),
  admin_uid text not null references auth.users(id) on delete cascade,
  nomination_id uuid references nominations(id) on delete set null,
  action text not null,
  reason text,
  timestamp timestamptz not null default now()
);
```

- [ ] **Step 3: Push migration to Supabase**

```bash
npx supabase db push
```
Expected: Migration applied successfully.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/001_schema.sql
git commit -m "feat: add initial database schema"
```

---

### Task 5: RLS Policies

**Files:**
- Create: `supabase/migrations/002_rls.sql`

- [ ] **Step 1: Write RLS policies**

Create `supabase/migrations/002_rls.sql`:
```sql
-- Enable RLS on all tables
alter table nominations enable row level security;
alter table votes enable row level security;
alter table claims enable row level security;
alter table working_groups enable row level security;
alter table working_group_members enable row level security;
alter table hub_posts enable row level security;
alter table hub_messages enable row level security;
alter table hub_links enable row level security;
alter table inquiries enable row level security;
alter table in_app_notifications enable row level security;
alter table moderation_logs enable row level security;

-- nominations: public read for approved/in_progress; authenticated write
create policy "nominations_public_read" on nominations
  for select using (status in ('approved', 'in_progress'));

create policy "nominations_auth_insert" on nominations
  for insert with check (auth.uid() is not null);

create policy "nominations_admin_all" on nominations
  for all using (
    exists (
      select 1 from auth.users
      where id = auth.uid()
      and raw_user_meta_data->>'role' = 'maintainer'
    )
  );

-- votes: public read; authenticated write
create policy "votes_public_read" on votes
  for select using (true);

create policy "votes_auth_write" on votes
  for all using (auth.uid() = user_uid)
  with check (auth.uid() = user_uid);

-- claims: nominator and claimant can read; authenticated insert
create policy "claims_participant_read" on claims
  for select using (
    auth.uid() = claimant_uid
    or auth.uid() = (
      select nominator_uid from nominations where id = nomination_id
    )
  );

create policy "claims_auth_insert" on claims
  for insert with check (auth.uid() = claimant_uid);

create policy "claims_nominator_update" on claims
  for update using (
    auth.uid() = (
      select nominator_uid from nominations where id = nomination_id
    )
  );

-- hub_messages: strict membership-based RLS (second layer after server check)
create or replace function is_group_member(gid uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from working_group_members
    where group_id = gid and user_uid = auth.uid()
  )
$$;

create policy "hub_messages_member_only" on hub_messages
  for all using (is_group_member(group_id));

create policy "hub_posts_member_only" on hub_posts
  for all using (is_group_member(group_id));

create policy "hub_links_member_only" on hub_links
  for all using (is_group_member(group_id));

create policy "working_group_members_member_read" on working_group_members
  for select using (is_group_member(group_id));

-- in_app_notifications: user sees only their own
create policy "notifications_own" on in_app_notifications
  for all using (auth.uid() = user_uid);

-- inquiries: sender and group members can read
create policy "inquiries_read" on inquiries
  for select using (
    auth.uid() = sender_uid
    or exists (
      select 1 from working_groups wg
      join working_group_members wgm on wgm.group_id = wg.id
      where wg.nomination_id = inquiries.nomination_id
        and wgm.user_uid = auth.uid()
    )
  );

create policy "inquiries_auth_insert" on inquiries
  for insert with check (auth.uid() = sender_uid);
```

- [ ] **Step 2: Push migration**

```bash
npx supabase db push
```
Expected: Migration applied successfully.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/002_rls.sql
git commit -m "feat: add Row Level Security policies"
```

---

### Task 6: Views and Triggers

**Files:**
- Create: `supabase/migrations/003_views.sql`
- Create: `supabase/migrations/004_triggers.sql`

- [ ] **Step 1: Write views migration**

Create `supabase/migrations/003_views.sql`:
```sql
create or replace view nomination_vote_totals as
select
  nomination_id,
  coalesce(sum(value), 0) as score
from votes
group by nomination_id;
```

- [ ] **Step 2: Write triggers migration**

Create `supabase/migrations/004_triggers.sql`:
```sql
-- Trigger 1: update last_activity_at on votes, claims, hub_messages
create or replace function update_nomination_activity()
returns trigger
language plpgsql
as $$
declare
  v_nomination_id uuid;
begin
  if TG_TABLE_NAME = 'votes' then
    v_nomination_id := NEW.nomination_id;
  elsif TG_TABLE_NAME = 'claims' then
    v_nomination_id := NEW.nomination_id;
  elsif TG_TABLE_NAME = 'hub_messages' then
    select nomination_id into v_nomination_id
    from working_groups where id = NEW.group_id;
  end if;

  update nominations
  set last_activity_at = now()
  where id = v_nomination_id;

  return NEW;
end;
$$;

create trigger trg_vote_activity
  after insert on votes
  for each row execute function update_nomination_activity();

create trigger trg_claim_activity
  after insert on claims
  for each row execute function update_nomination_activity();

create trigger trg_hub_message_activity
  after insert on hub_messages
  for each row execute function update_nomination_activity();

-- Trigger 2: accept_claim atomically creates working group
create or replace function handle_claim_accepted()
returns trigger
language plpgsql
as $$
declare
  v_group_id uuid;
  v_nominator_uid text;
begin
  if NEW.status = 'accepted' and OLD.status = 'pending' then
    -- Get nominator
    select nominator_uid into v_nominator_uid
    from nominations where id = NEW.nomination_id;

    -- Create working group
    insert into working_groups (nomination_id)
    values (NEW.nomination_id)
    returning id into v_group_id;

    -- Add nominator
    insert into working_group_members (group_id, user_uid, role)
    values (v_group_id, v_nominator_uid, 'nominator');

    -- Add replicator
    insert into working_group_members (group_id, user_uid, role)
    values (v_group_id, NEW.claimant_uid, 'replicator');

    -- Update nomination status
    update nominations
    set status = 'in_progress'
    where id = NEW.nomination_id;
  end if;

  return NEW;
end;
$$;

create trigger trg_accept_claim
  after update on claims
  for each row execute function handle_claim_accepted();
```

- [ ] **Step 3: Push both migrations**

```bash
npx supabase db push
```
Expected: Both migrations applied.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/003_views.sql supabase/migrations/004_triggers.sql
git commit -m "feat: add vote totals view and activity/claim triggers"
```

---

### Task 7: Supabase Client Helpers

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/admin.ts`

- [ ] **Step 1: Create browser client**

Create `src/lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Create server client**

Create `src/lib/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

- [ ] **Step 3: Create service-role admin client**

Create `src/lib/supabase/admin.ts`:
```typescript
import { createClient } from '@supabase/supabase-js'

// Server-only: never import this in client components
export const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/
git commit -m "feat: add Supabase browser, server, and admin clients"
```

---

### Task 8: Better Auth Configuration

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...betterauth]/route.ts`

- [ ] **Step 1: Install Better Auth OAuth plugins**

```bash
npm install better-auth
```

- [ ] **Step 2: Write auth config**

Create `src/lib/auth.ts`:
```typescript
import { betterAuth } from 'better-auth'
import { genericOAuth } from 'better-auth/plugins'
import { Pool } from 'pg'
import { hashWithPepper, deterministicEmail } from '@/lib/crypto'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export const auth = betterAuth({
  database: { db: pool, type: 'postgres' },

  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const uidPepper = process.env.UID_PEPPER!
          const emailPepper = process.env.EMAIL_PEPPER!

          const hashedId = hashWithPepper(user.id, uidPepper)
          const dummyEmail = deterministicEmail(user.email ?? user.id, emailPepper)

          return {
            data: {
              ...user,
              id: hashedId,
              name: 'Anonymous Researcher',
              email: dummyEmail,
              image: null,
            },
          }
        },
      },
    },
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      scope: ['openid', 'email', 'offline_access'],
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      scope: ['read:user', 'user:email'],
    },
  },

  plugins: [
    genericOAuth({
      config: [
        {
          id: 'orcid',
          name: 'ORCID',
          issuer: 'https://orcid.org',
          clientId: process.env.ORCID_CLIENT_ID!,
          clientSecret: process.env.ORCID_CLIENT_SECRET!,
          authorizationUrl: 'https://orcid.org/oauth/authorize',
          tokenUrl: 'https://orcid.org/oauth/token',
          userInfoUrl: 'https://orcid.org/oauth/userinfo',
          scopes: ['/authenticate', 'openid'],
        },
      ],
    }),
  ],

  advanced: {
    cookiePrefix: '__Host-better-auth',
    useSecureCookies: process.env.NODE_ENV === 'production',
  },
})
```

- [ ] **Step 3: Create API route handler**

Create `src/app/api/auth/[...betterauth]/route.ts`:
```typescript
import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'

export const { GET, POST } = toNextJsHandler(auth)
```

- [ ] **Step 4: Add DATABASE_URL to .env.local.example**

Append to `.env.local.example`:
```bash
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/app/api/
git commit -m "feat: configure zero-PII Better Auth with Google, GitHub, ORCID"
```

---

### Task 9: Middleware & Route Protection

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Write middleware**

Create `src/middleware.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

const PUBLIC_PATHS = ['/', '/registry', '/nominations', '/sign-in']
const ADMIN_PATHS = ['/admin']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths and auth API
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/api/auth')
  ) {
    return NextResponse.next()
  }

  // Check session
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session) {
    const signIn = new URL('/sign-in', request.url)
    signIn.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(signIn)
  }

  // Guard admin routes
  if (ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    const role = session.user.role as string | undefined
    if (role !== 'maintainer') {
      return NextResponse.notFound()
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 2: Verify dev server starts without errors**

```bash
npm run dev
```
Expected: Server starts on http://localhost:3000. `/registry` is accessible without login; `/dashboard` redirects to `/sign-in`.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add middleware for auth and role-based route protection"
```

---

---

### Task 10: Sign-In Page

**Files:**
- Create: `src/app/sign-in/page.tsx`

- [ ] **Step 1: Install Better Auth React client**

```bash
npm install @better-auth/react
```

- [ ] **Step 2: Create auth client**

Create `src/lib/auth-client.ts`:
```typescript
import { createAuthClient } from 'better-auth/react'
import { genericOAuthClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? 'http://localhost:3000',
  plugins: [genericOAuthClient()],
})
```

- [ ] **Step 3: Create sign-in page**

Create `src/app/sign-in/page.tsx`:
```typescript
'use client'

import { useSearchParams } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Suspense } from 'react'

function SignInForm() {
  const params = useSearchParams()
  const callbackUrl = params.get('callbackUrl') ?? '/dashboard'

  async function signIn(provider: 'google' | 'github') {
    await authClient.signIn.social({ provider, callbackURL: callbackUrl })
  }

  async function signInOrcid() {
    await authClient.signIn.oauth2({ providerId: 'orcid', callbackURL: callbackUrl })
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm px-6">
        <h1 className="text-2xl font-bold text-center mb-2">Sign in</h1>
        <p className="text-sm text-muted-foreground text-center mb-8">
          No personal data is stored. We use privacy-preserving pseudonymous identifiers.
        </p>
        <div className="space-y-3">
          <Button variant="outline" className="w-full" onClick={() => signIn('google')}>
            Continue with Google
          </Button>
          <Button variant="outline" className="w-full" onClick={() => signIn('github')}>
            Continue with GitHub
          </Button>
          <Button variant="outline" className="w-full" onClick={signInOrcid}>
            Continue with ORCID
          </Button>
        </div>
      </div>
    </main>
  )
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  )
}
```

- [ ] **Step 4: Add NEXT_PUBLIC_BETTER_AUTH_URL to .env.local.example**

Append to `.env.local.example`:
```bash
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
```

- [ ] **Step 5: Verify sign-in flow in browser**

```bash
npm run dev
```
Navigate to http://localhost:3000/sign-in. Expected: three OAuth buttons render. Click Google — OAuth flow completes and redirects to `/dashboard`.

- [ ] **Step 6: Commit**

```bash
git add src/app/sign-in/ src/lib/auth-client.ts
git commit -m "feat: add OAuth sign-in page with Google, GitHub, and ORCID"
```

---

**Plan 1 complete.** After this plan is executed you will have: a working Next.js 15 project, the complete Supabase schema deployed with RLS and triggers, zero-PII Better Auth with three OAuth providers, middleware guarding all protected routes, and a working sign-in page. Proceed to Plan 2.
