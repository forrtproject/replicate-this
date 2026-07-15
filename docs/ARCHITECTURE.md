# Replicate This v2 — Architecture (Revised 2026-06-21)

This supersedes the Next.js/Supabase assumptions in `docs/superpowers/plans/*` and the
Design Specification where they conflict. The PRD review comments and three later
decisions (React-not-Next, Münster self-hosted server, plain Postgres) are authoritative.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | **Vite + React 19 + TypeScript** | SPA, static build served by nginx on Münster |
| Routing | **React Router v7** (SPA mode) | Client route guards (no Next middleware) |
| Data fetching | **TanStack Query** | Talks to our Hono API only |
| Styling | **Tailwind CSS + shadcn/ui** | Clean & Accessible; green accent `#059669` |
| Backend | **Node + Hono API server** | Replaces Next Server Actions AND Edge Functions |
| Auth | **Better Auth** (in the Hono server) | Google, GitHub, ORCID (genericOAuth); zero-PII hook |
| ORM / DB | **Drizzle ORM + Postgres** | Plain self-hosted Postgres on Münster |
| Hosting | **Münster university server (German soil)** | Satisfies GDPR residency directly |

## Authority model

- **Better Auth owns identity.** The Hono API owns **authorization** (all privileged
  reads/writes go through API route handlers that check the session + role).
- Postgres constraints/checks are defense-in-depth. There is **no Supabase `auth.uid()`
  RLS** — the SPA never talks to Postgres directly; it only calls the Hono API.
- The browser holds **no service-role secret**. Secrets live only in `server/`.

## Decisions that diverge from the Design Spec / Plans

1. **Voting = upvote + prediction.** A "want this replicated" upvote PLUS a separate
   yes/no "will it replicate?" prediction shown as a distribution. **Login required, NO
   24-hour account-age gate.**
2. **Contributions, auto-accept.** "Claims" renamed to **contributions**. Logged-in users
   signal intent to replicate; auto-accepted. **No nominator approval, no vetting modal,
   no handshake.**
3. **Collaboration hub DEFERRED** (out of scope v2). No working groups, hub posts/messages/
   links, no live chat. Schema leaves room to add later.
4. **Auth = Better Auth** (not Supabase Auth), hosted in the Hono server.
5. **Status vocabulary** includes terminal **completed / published** (per PRD comment),
   in addition to pending → approved → in_progress.
6. Nominators have **no special standing** after nominating (PRD comment): they are
   notified on status changes and may themselves become contributors. No "ghost nominator
   recovery" / promote flow.
7. DOI fallback: if Crossref fails, fall back to doi.org content negotiation; if that also
   fails, allow **manual reference entry** after DOI double-check (PRD comment [l]).

## Repo layout

```
web/      Vite React SPA          (frontend)
server/   Hono API + Better Auth  (backend, Drizzle schema, migrations)
docs/     PRD, spec, plans, this file
```

## Zero-PII (unchanged intent)

Better Auth `databaseHooks.user.create.before` strips name/email/image, replaces id with
`sha256(id + UID_PEPPER)` and email with a deterministic `sha256(email + EMAIL_PEPPER)@
privacy.forrt.org` dummy (stable for cross-provider account linking). Real PII never
persisted. Inquiry emails fetched transiently at send-time, never written to disk.

## Local-first mode

No live credentials yet. Build code + Drizzle migrations + API against a **local Postgres**
(or skip live DB). OAuth browser round-trips and email sending are stubbed/deferred until
creds + the Münster box are available.
