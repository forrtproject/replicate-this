# Replicate This v2: Architecture

First revised 2026-06-21; updated 2026-10-21 after the October feedback rounds
and usability review.

This supersedes the Next.js/Supabase assumptions in `docs/superpowers/plans/*` and the
Design Specification where they conflict. The PRD review comments and the later
decisions below are authoritative. For what the system does today, see
[SYSTEM.md](SYSTEM.md).

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | **Vite + React 19 + TypeScript** | SPA; static build on GitHub Pages at `forrt.org/replicate-this` |
| Routing | **React Router v7** (data router) | Client route guards (no Next middleware) |
| Data fetching | **TanStack Query** | Talks to our Hono API only |
| Styling | **Tailwind CSS v4** | Hand-built components; brand green `#047857` (darkened from `#059669` for 4.5:1 contrast) |
| Backend | **Node + Hono API server** | Replaces Next Server Actions AND Edge Functions |
| Auth | **Better Auth** (in the Hono server) | Google, GitHub, ORCID (genericOAuth); popup + bearer token when the API is on another site |
| ORM / DB | **Drizzle ORM + Postgres** | Plain Postgres beside the API |
| Hosting | **API on an aaPanel server under PM2** | Interim host `api-replicate-this.keeganvaz.in`; the Münster university server was the original plan |

## Authority model

- **Better Auth owns identity.** The Hono API owns **authorization**: all privileged
  reads and writes go through API route handlers that check the session and role.
- Postgres constraints are defence in depth. There is **no Supabase `auth.uid()`
  RLS**: the SPA never talks to Postgres, only to the Hono API.
- The browser holds **no service-role secret**. Secrets live only in `server/`.

## Decisions that diverge from the Design Spec / Plans

1. **Voting = upvote + forecast.** A "want this checked" upvote, plus a separate
   yes/no forecast shown as a distribution. The forecast question follows the requested
   check ("Will it replicate?" / "Will the results prove robust?" / "Will the finding hold
   up?"). **Login required, no 24-hour account-age gate.**
2. **Contributions, auto-accept.** "Claims" renamed to **contributions**. Signed-in users
   join a study's team without approval: no nominator vetting, no handshake.
3. **Collaboration hub deferred** (out of scope for v2). No working groups, hub
   posts, messages or links, and no live chat. The schema leaves room to add them later.
4. **Auth = Better Auth** (not Supabase Auth), hosted in the Hono server.
5. **Status vocabulary** includes terminal **completed / published** (per PRD comment),
   in addition to pending → approved → in_progress. The interface names them by the
   next action: pending is "Pending review", approved is "Looking for contributors".
6. Nominators have **no special standing** after nominating (PRD comment): they are
   notified on status changes and may themselves become contributors. No "ghost nominator
   recovery" or promote flow.
7. **DOI fallback:** if Crossref fails, try doi.org content negotiation; if that also
   fails, allow **manual reference entry** (PRD comment [l]). Papers with no DOI at all
   can be nominated with a hand-entered reference and a link (`doi` is nullable).
8. **Real names encouraged** (October 2026, reversing "pseudonymous by default"). A new
   account's display name starts as the provider's profile name; the user can change it
   or roll a pseudonym. Provider emails and pictures are still never stored.
9. **"Newest" is the default sort.** Ranking by upvotes first would keep popular
   nominations on top and make them more popular regardless of merit (a Matthew effect).
10. **Reproduction includes robustness checks.** A reproduction re-runs the original
    analysis (on the original data, or the original code for simulation studies)
    and/or varies the analysis to test robustness.
11. **Actions clicked while signed out are finished after sign-in.** An upvote or forecast
    is stored in the tab, applied once the person is back on the same page, and confirmed
    with an Undo. It is never applied if sign-in wasn't started, and the server endpoints
    used for it only add, so a replay can't remove an existing vote.

## Repo layout

```
web/      Vite React SPA          (frontend)
server/   Hono API + Better Auth  (backend, Drizzle schema, migrations)
docs/     PRD, spec, plans, SYSTEM.md, this file
```

## Identity and personal data

Better Auth's `mapProfileToUser` and `databaseHooks.user.create.before` replace the
provider profile before any row is written. The login email becomes a deterministic
`<sha256(email + EMAIL_PEPPER)>@privacy.forrt.org` dummy, the same across providers so
accounts link automatically, and the image is dropped. The user id is Better Auth's own
random id, not derived from the provider. (`UID_PEPPER` is read at startup but not used
by any derivation today.) The provider email is kept only as the user's editable
notification address, and OAuth tokens are discarded before every write. Full detail in
[SYSTEM.md § 7](SYSTEM.md#7-privacy-model-minimal-pii).

## Running locally

Local development uses Postgres from `docker-compose.yml` and the API on port 8787, with
Vite proxying `/api`. `npm run dev:remote` in `web/` points a local web app at the
deployed API instead; the server must list `http://localhost:5173` in
`EXTRA_WEB_ORIGINS` for that to work.
