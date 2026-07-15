# Replicate This v2.0 — Design Specification

**Date:** 2026-04-17 (updated 2026-04-21)
**Organization:** FORRT / Replication Journal Federation
**Status:** Approval Needed for Implementation

---

## 1. Overview

Replicate This is a community-driven, public registry for nominating published research papers for independent verification through replication or reproduction. v2.0 transitions from a static registry to an interactive platform where researchers can nominate studies, contribute replication intent, and signal community priority through voting.

The platform is designed around two core constraints that shape every decision:

- **Zero-PII compliance** with German Datenschutz (GDPR) — no names, emails, or identifying data are persisted to the database
- **Zero infrastructure cost** at rest — serverless architecture on Vercel with Supabase, near-$0 to host

---

## 2. Tech Stack

| Component    | Technology                                    | Reason                                                            |
| ------------ | --------------------------------------------- | ----------------------------------------------------------------- |
| Framework    | Next.js 15+ (App Router)                      | SSR for privacy, Server Actions for logic, React 19 optimistic UI |
| Auth         | Better Auth                                   | Type-safe, customizable hooks, ORCID OIDC support                 |
| Database     | Supabase (Postgres, Frankfurt `eu-central-1`) | GDPR data residency, Realtime, RLS                                |
| Deployment   | Vercel                                        | Serverless, zero initial cost                                     |
| DOI Metadata | Crossref API                                  | Open, free metadata source for academic papers                    |

---

## 3. Visual Design

**Direction: Clean & Accessible**

Light backgrounds, neutral whites, green accent (`#059669`), sans-serif typeface. Designed for a broad academic audience — approachable and readable, not sterile. Reference aesthetic: Wikipedia meets Linear.

Status badges use semantic colour: green for `approved`, amber for `in_progress` (displayed publicly as "In Progress"), grey for `pending` (admin-only view).

---

## 4. Architecture Approach

**Hybrid: BaaS-first for public surfaces, Server Actions for private/complex logic.**

- The public registry (nominations list, voting, DOI lookup) uses Supabase RLS for data access — simple, fast, low overhead
- Contribution flows are fully gated by server-side checks in Next.js — RLS acts as a second enforcement layer, not the primary gate
- This keeps simple features simple and gives explicit control where permissions are complex

---

## 5. Database Schema

### `nominations`

| Column             | Type        | Notes                                                                                         |
| ------------------ | ----------- | --------------------------------------------------------------------------------------------- |
| `id`               | UUID PK     |                                                                                               |
| `doi`              | TEXT UNIQUE | Normalised: `toLowerCase().trim()` before write                                               |
| `metadata`         | JSONB       | Cached Crossref response: title, authors, journal, publication_date                           |
| `discipline`       | TEXT        | Dropdown-constrained                                                                          |
| `justification`    | TEXT        | Free text from submitter                                                                      |
| `nominator_uid`    | TEXT        | References `users.id`; SET NULL on user deletion — nomination record is retained              |
| `status`           | ENUM        | `pending` → `approved` → `in_progress` → (terminal); `rejected` any time before `in_progress` |
| `last_activity_at` | TIMESTAMPTZ | Updated by trigger on votes and contributions inserts                                         |
| `created_at`       | TIMESTAMPTZ |                                                                                               |

### `votes`

| Column          | Type        | Notes                       |
| --------------- | ----------- | --------------------------- |
| `nomination_id` | UUID FK     |                             |
| `user_uid`      | TEXT FK     | ON DELETE CASCADE            |
| `value`         | SMALLINT    | +1 only                     |
| `created_at`    | TIMESTAMPTZ | Used for 24-hour gate check |

**Constraint:** `UNIQUE(nomination_id, user_uid)`

### `contributions`

| Column           | Type        | Notes                                         |
| ---------------- | ----------- | --------------------------------------------- |
| `id`             | UUID PK     |                                               |
| `nomination_id`  | UUID FK     |                                               |
| `contributor_uid`| TEXT        | References `users.id`; SET NULL on user deletion — contribution record is retained |
| `message`        | TEXT        | Contributor's pitch — expertise, lab, timeline |
| `created_at`     | TIMESTAMPTZ |                                               |

### `user_social_links`

| Column       | Type        | Notes                                                                  |
| ------------ | ----------- | ---------------------------------------------------------------------- |
| `id`         | UUID PK     |                                                                        |
| `user_uid`   | TEXT FK     | ON DELETE CASCADE                                                      |
| `platform`   | TEXT        | e.g. `orcid`, `github`, `twitter`, `linkedin`, `mastodon`, `website`  |
| `url`        | TEXT        | Full URL to user's profile on that platform                            |
| `created_at` | TIMESTAMPTZ |                                                                        |

**Note:** Social links are user-opted-in public disclosures and are stored as plain text. Users are informed at the point of entry that these are publicly visible. ON DELETE CASCADE removes links when the user deletes their account.

### `in_app_notifications`

| Column       | Type        | Notes                                                                    |
| ------------ | ----------- | ------------------------------------------------------------------------ |
| `id`         | UUID PK     |                                                                          |
| `user_uid`   | TEXT FK     | ON DELETE CASCADE                                                        |
| `type`       | TEXT        | e.g. `new_contribution`, `nomination_rejected`                           |
| `data`       | JSONB       | Context payload (nomination_id, reason text, etc.)                       |
| `read_at`    | TIMESTAMPTZ | Nullable                                                                 |
| `created_at` | TIMESTAMPTZ |                                                                          |

### `moderation_logs`

| Column          | Type        | Notes                                                              |
| --------------- | ----------- | ------------------------------------------------------------------ |
| `id`            | UUID PK     |                                                                    |
| `admin_uid`     | TEXT FK     |                                                                    |
| `nomination_id` | UUID FK     |                                                                    |
| `action`        | TEXT        | e.g. `approved`, `rejected`, `undo_rejection`                      |
| `reason`        | TEXT        | Required for rejection actions                                     |
| `timestamp`     | TIMESTAMPTZ |                                                                    |

### Views

**`nomination_vote_totals`**

```sql
CREATE VIEW nomination_vote_totals AS
SELECT nomination_id, COUNT(*) AS score
FROM votes
GROUP BY nomination_id;
```

Stays a standard view for v2. Can be converted to a Materialized View with a refresh trigger if performance degrades at scale.

### Triggers

**`update_last_activity`** — fires AFTER INSERT on `votes`, `contributions`; sets `nominations.last_activity_at = NOW()` for the relevant `nomination_id`.

**`accept_contribution_transaction`** — fires AFTER INSERT on `contributions`; atomically:

1. Sets `nominations.status = 'in_progress'`
2. Creates `in_app_notifications` for the nominator (if non-null) confirming a contributor has joined

---

## 6. Authentication & Privacy

### Providers

Google, GitHub, ORCID (via OIDC using `genericOAuth` plugin). ORCID's `sub` claim is the 16-digit iD — already a pseudonymous academic identifier by design.

### Zero-PII Hook

```typescript
export const auth = betterAuth({
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const hashedId = sha256(user.id + process.env.UID_PEPPER);
          const dummyEmail =
            sha256(user.email + process.env.EMAIL_PEPPER) +
            "@privacy.forrt.org";
          return {
            data: {
              ...user,
              id: hashedId,
              name: "Anonymous Researcher",
              email: dummyEmail, // Satisfies unique constraint; real email never stored
              image: null,
            },
          };
        },
      },
    },
  },
  advanced: {
    cookiePrefix: "__Host-better-auth",
    useSecureCookies: true,
  },
});
```

**Account linking:** The deterministic `sha256(rawEmail + EMAIL_PEPPER)` dummy email is stable across providers that share the same underlying email address — account linking works without storing the real email.

### Session & Deletion

- Sessions: `httpOnly`, `sameSite: lax`, `secure`, server-only (`__Host-` prefix)
- Delete account: purges the `users` row. `nominations.nominator_uid` and `contributions.contributor_uid` are SET NULL — **nomination and contribution records are permanent scientific records and are never deleted**. The user's authorship association is removed, but the scientific record remains intact.

### GDPR Notes

- UIDs are **pseudonymised**, not anonymised. Treated as personal data internally.
- Social links are stored by explicit user consent and are publicly visible — this is stated clearly in the UI at the point of entry.
- Right to erasure: single-click account deletion removes the user row and all personal associations. Nominations and contributions they created remain as stable scientific records with a null author reference.

---

## 7. Nomination & Moderation Pipeline

### Submission Flow

1. Logged-in user submits form: DOI, discipline, justification
2. Server Action normalises DOI (`toLowerCase().trim()`)
3. Checks `nominations` for existing non-rejected entry with same DOI — returns "This study has already been nominated" with a link if found
4. Calls Crossref API with `AbortController` (5-second timeout) and a `User-Agent: mailto:admin@forrt.org` header to join the Crossref Polite Pool (faster, less rate-limited) — on timeout, returns friendly error; nomination is not written
5. On success: writes `nominations` row with `status: pending`, caches Crossref metadata into `metadata JSONB`
6. Creates `in_app_notifications` for all `maintainer` role users

### Moderation Dashboard (`/admin`)

- Protected route — middleware checks `maintainer` role; `notFound()` if not
- Supabase Realtime subscription on `nominations` filtered to `status: pending` — live badge on new arrivals
- **Pending tab:** paginated list showing cached title, discipline, justification, researcher token (`user_uid.slice(0,6)`), submission date
- **Approve:** status → `approved`, logged to `moderation_logs`
- **Reject:** requires reason field; status → `rejected`, reason delivered to nominator via `in_app_notification` (type: `nomination_rejected`), logged
- **Archived tab:** shows rejected nominations; **Undo** action resets to `pending`, logs reversal

### Status Flow

```
pending → approved → in_progress
    ↓
 rejected  (admin override, any time before in_progress)
```

Admins can manually override status at any point before `in_progress`.

---

## 8. Community Voting

- Gated: user must be logged in and account must be older than 24 hours (`created_at < NOW() - INTERVAL '24 hours'`)
- Server Action toggle: no vote → insert; existing vote → delete (un-vote)
- `UNIQUE(nomination_id, user_uid)` enforced at DB level
- Score computed from `nomination_vote_totals` view (COUNT of upvotes) — never cached on the nomination row
- Registry default sort: `score DESC`, secondary `last_activity_at DESC`; additional sort by `created_at` via query param
- Frontend: optimistic UI via `useOptimistic` — immediate increment/highlight, server rollback on failure
- ORCID vote weighting: future feature, implementable as a view-level change only — no schema migration required

---

## 9. Contributions

### Contribution Submission

- "Contribute to this study" button visible on all `approved` and `in_progress` nominations
- Contributor writes a pitch message (expertise, lab readiness, timeline)
- Server Action inserts `contributions` row
- `accept_contribution_transaction` trigger fires automatically — sets nomination `in_progress` and notifies nominator
- `in_app_notifications` sent to nominator (if non-null) confirming new contributor, and to contributor as confirmation

Contributions are open — multiple contributors can join the same nomination. Accepting one does not block others.

---

## 10. Inquiry System

Third parties can contact nominators or contributors directly via the social profiles those users have chosen to display publicly.

### Social Profile Display

- On any nomination's public page, the nominator's and contributors' displayed social links are shown (if they have added any)
- Social platforms supported: ORCID, GitHub, Twitter/X, LinkedIn, Mastodon, personal website
- Users manage their social links from their account settings — links are opt-in and can be added or removed at any time
- Removing a social link takes effect immediately across all nomination pages

### Contact Flow

1. Interested party views a nomination page and sees the nominator's or contributor's displayed social links
2. Contact happens directly on the external platform of the nominator's or contributor's choosing
3. No in-app messaging or email relay is involved

This approach respects researcher agency — they choose which platforms they are reachable on and bear no obligation to respond through the platform.

---

## 11. Public Registry

- Lists all nominations with `status` in (`approved`, `in_progress`)
- Each card: cached title, authors, journal, year (from `metadata`), vote score, status badge, discipline tag. The `in_progress` status renders as "In Progress" on the public badge
- Filterable by discipline, status
- Sorted by score DESC / last_activity_at DESC by default
- Contribute button visible on all approved and in-progress entries

---

## 12. User Personas & Routes

| Persona      | Key Routes                                                       |
| ------------ | ---------------------------------------------------------------- |
| Nominator    | `/nominate`, `/dashboard` (nomination status), `/settings/socials` |
| Contributor  | `/registry`, `/settings/socials`                                 |
| Maintainer   | `/admin` (moderation queue, archived tab)                        |
| Public       | `/registry`, `/nominations/[id]` (read-only)                     |

---

## 13. Compliance Summary

| Requirement          | Implementation                                                          |
| -------------------- | ----------------------------------------------------------------------- |
| Data residency       | Supabase Frankfurt `eu-central-1`                                       |
| No PII storage       | Deterministic dummy email; name/image stripped in `databaseHooks`       |
| Pseudonymisation     | UIDs are hashed + peppered; treated as personal data internally         |
| Social links         | Stored by explicit user consent; clearly labelled as publicly visible   |
| Right to erasure     | User row deleted; `nominator_uid`/`contributor_uid` SET NULL; scientific records retained |
| Cookie security      | `__Host-` prefix, `httpOnly`, `secure`, `sameSite: lax`                 |

---

## 14. Out of Scope for v2

- **Collaborative Hub** — private working groups per nomination, including: threaded message board (`hub_posts`), live chat (`hub_messages`), shared external links (`hub_links`), member management (`working_group_members`), and Ghost Nominator Recovery (admin-promoted role transfer). Deferred to a future release.
- ORCID-weighted voting (view-level change when ready)
- Real-time presence indicators
- Public researcher profiles
- Replication outcome tracking / result submission
