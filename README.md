# Replicate This v2

A community-driven, privacy-first registry for nominating published research
papers that merit independent **replication or reproduction**. Researchers
nominate studies, upvote the ones they most want verified, predict whether they
will replicate, and sign up to run replications.

Built by FORRT / Replication Journal Federation. Self-hosted on the Münster
university server (German soil → GDPR data residency by default).

## Architecture

A **React SPA** talking to a **Hono API** over a plain **Postgres** database.
The SPA never touches Postgres directly — all privileged logic lives server-side.

```
web/      Vite + React 19 + TS + React Router + TanStack Query + Tailwind v4   (SPA)
server/   Hono + Better Auth + Drizzle ORM + Postgres                          (API)
docs/     PRD, design spec, ARCHITECTURE.md (authoritative decisions), plans
```

See [docs/SYSTEM.md](docs/SYSTEM.md) for the full system reference — nomination
lifecycle states, complete database schema, roles/permissions, API surface,
notifications, integrations (Slack, Postmark, weekly export), and the privacy
model. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the decision record,
including where this revises the original PRD/design spec (React not Next,
Münster hosting, upvote+prediction voting, auto-accept contributions, deferred
collaboration hub).

### Privacy (zero-PII)

Better Auth strips name/email/image before any row is written: the user id
becomes `sha256(providerId + pepper)` and the email a deterministic dummy
(`<hash>@privacy.forrt.org`) that is stable across providers for account
linking. Real PII is never persisted.

## Getting started (local)

```bash
# 1. Database (Docker) — or point DATABASE_URL at any Postgres
docker compose up -d

# 2. API server
cd server
cp .env.example .env        # fill in OAuth creds + peppers + secret
npm install
npm run db:migrate          # apply schema + triggers
npm run dev                 # http://localhost:8787

# 3. Web app
cd ../web
npm install
npm run dev                 # http://localhost:5173 (proxies /api -> :8787)
```

To grant yourself admin: set `role = 'maintainer'` on your `user` row after
first sign-in.

## Scripts

| Location | Command | What |
|---|---|---|
| `server` | `npm run dev` / `build` / `start` | run / compile / serve the API |
| `server` | `npm run db:generate` / `db:migrate` | Drizzle migrations |
| `server` | `npm test` | crypto + Crossref unit tests |
| `web` | `npm run dev` / `build` | run / build the SPA |
| `web` | `npm test` | component + util tests |

## Status

Implemented: auth (Google/GitHub/ORCID, zero-PII), nominations + Crossref/doi.org
lookup with manual fallback, public registry with filter/sort, upvote +
prediction voting, auto-accept contributions, inquiries, in-app notifications,
admin moderation (approve/reject/undo + lifecycle status).

Deferred (per revised scope): collaboration hub (working groups, chat, message
board), transactional inquiry email (Postmark), ORCID-weighted voting.
