# Replicate This v2

A community registry for nominating published research papers that merit an
independent **replication or reproduction**. Researchers nominate studies,
upvote the ones they most want checked, predict whether the finding will hold
up, and join the team doing the work.

Built by FORRT / Replication Journal Federation.

## Architecture

A **React SPA** talking to a **Hono API** over a plain **Postgres** database.
The SPA never touches Postgres; all privileged logic lives server-side.

```
web/      Vite + React 19 + TS + React Router + TanStack Query + Tailwind v4   (SPA)
server/   Hono + Better Auth + Drizzle ORM + Postgres                          (API)
docs/     SYSTEM.md (reference), ARCHITECTURE.md (decisions), PRD, plans
```

[docs/SYSTEM.md](docs/SYSTEM.md) is the full system reference: nomination
lifecycle, database schema, roles and permissions, API surface,
notifications, integrations, privacy model, environment variables and the web
app's behaviour. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) records the
decisions behind it, including where they depart from the original PRD and
design spec.

### Privacy

Better Auth never stores a provider's email or picture. The login email is a
deterministic dummy (`<hash>@privacy.forrt.org`, keyed with `EMAIL_PEPPER`) that
stays the same across providers, so one person's Google, GitHub and ORCID
sign-ins link to one account. The display name starts as the provider's profile
name, because we encourage real names; users can change it or pick a pseudonym.
The only real email stored is the optional notification address. Details in
[SYSTEM.md § 7](docs/SYSTEM.md#7-privacy-model-minimal-pii).

## Getting started (local)

```bash
# 1. Database (Docker), or point DATABASE_URL at any Postgres
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
npm run dev                 # http://localhost:5173/replicate-this/ (proxies /api to :8787)
```

To make yourself a maintainer after your first sign-in, run
`npm run make-admin` in `server/`.

**Testing against the deployed API instead of a local one:** run
`npm run dev:remote` in `web/`. This only works while the API server has
`EXTRA_WEB_ORIGINS=http://localhost:5173` set; see
[SYSTEM.md § 8](docs/SYSTEM.md#8-environment-variables). It is meant for
short-term testing.

## Deployment

Both deploy from `main` through GitHub Actions:

- **Web** (`.github/workflows/deploy.yml`): static build published to GitHub
  Pages at `https://forrt.org/replicate-this`. The API address is baked in at
  build time from the `VITE_API_ORIGIN` Actions variable, falling back for now
  to `https://api-replicate-this.keeganvaz.in`.
- **API** (`.github/workflows/deploy-api.yml`): tested and built in CI, copied
  to the aaPanel server over SSH, then `server/deploy-post.sh` installs
  dependencies, **runs pending migrations** and restarts the process under PM2.
  Production settings are documented in `server/.env.production.example`.

## Scripts

| Location | Command | What |
|---|---|---|
| `server` | `npm run dev` / `build` / `start` | run / compile / serve the API |
| `server` | `npm run db:generate` / `db:migrate` | create / apply Drizzle migrations |
| `server` | `npm run db:seed` / `db:demo` / `make-admin` | sample data; grant the maintainer role |
| `server` | `npm test` | unit tests (email hashing, email-action tokens, OAuth token scrubbing, profile links, Crossref, Slack) |
| `server` | `npm run export:data` | write the public registry export |
| `web` | `npm run dev` / `dev:remote` / `build` | run locally / run against the deployed API / build |
| `web` | `npm test` / `lint` | component and logic tests / ESLint |

## Status

Implemented:
- sign-in with Google, GitHub or ORCID, with linked accounts and display names;
- public researcher profiles;
- nominations by DOI with a live lookup (Crossref, then doi.org, then manual entry), and nominations for papers with no DOI;
- the public registry, with search, filters and sorting;
- upvotes and yes/no forecasts;
- auto-accepted contributions;
- progress updates and inquiries;
- threaded comments with Markdown, likes and flags;
- in-app notifications, plus opt-in email via Postmark;
- maintainer moderation: approve, reject and undo, lifecycle status, comment and user management, and one-click review from email.

The Slack integration (a private channel per study) is on hold: the server code
is kept, but the web app doesn't show it.

Deferred: the collaboration hub (working groups, chat, message board) and
ORCID-weighted voting.
