# Replicate This: web app

The single-page app for Replicate This: Vite, React 19, TypeScript, React
Router, TanStack Query and Tailwind CSS v4. It talks only to the Hono API in
`../server`. For what the system does, see [../docs/SYSTEM.md](../docs/SYSTEM.md);
§ 10 covers this app's cross-page behaviour.

## Running it

```bash
npm install
npm run dev          # http://localhost:5173/replicate-this/, /api proxied to localhost:8787
npm run dev:remote   # same, but against the deployed API (see below)
npm test             # Vitest + Testing Library
npm run lint         # ESLint
npm run build        # type-check and build to dist/
```

The dev server is pinned to port 5173 (`strictPort`) because the API trusts
exact origins for sign-in. Everything is served under `/replicate-this/`,
matching GitHub Pages; `http://localhost:5173/` redirects there.

## Pointing at an API

`VITE_API_ORIGIN` is read at build time (`src/lib/config.ts`):

- **Unset** (normal `npm run dev`): calls go to same-origin `/api`, which Vite
  proxies to a local API on port 8787. Sign-in uses the ordinary redirect flow.
- **Set** (`npm run dev:remote` via `.env.remote`, and the Pages build): calls
  go straight to that origin, and sign-in switches to the popup flow
  (`src/lib/popup-sign-in.ts`), because the session cookie would be third-party.

`dev:remote` needs the API server to trust `http://localhost:5173`
(`EXTRA_WEB_ORIGINS` in its `.env`); otherwise the browser blocks every
response with a CORS error. It is for short-term testing against real data.

## Layout

```
src/
  pages/              one component per route (see src/router.tsx)
  features/<area>/    components, API hooks and logic for nominations, comments,
                      contributions, profile, notifications, admin, updates
  components/layout/  RootLayout (header, skip link, footer) and RouteAnnouncer
  components/ui/      shared pieces: RichText, MarkdownDoc, Tooltip, Toaster
  lib/                API client, auth client, config, page titles, toasts,
                      the pending signed-out action, small hooks
public/               static files, including the nomination guidelines and
                      Code of Conduct (Markdown, editable on GitHub)
```

## Conventions

- **Server state** goes through TanStack Query hooks in `features/<area>/api.ts`.
  Vote and forecast hooks update the cached list and detail in place.
- **Interface text** follows the existing voice: plain sentences, sentence case,
  no em dashes. Status names come from `features/nominations/status.ts`.
- **Accessibility:** every control needs a visible label, a visible focus ring
  and a 24px or larger target. Pages set their title with `usePageTitle`, and
  confirmations go through `useToast` rather than taking focus.
- **Colours** are tokens in `src/index.css` (`--color-green` is `#047857`,
  chosen for 4.5:1 contrast on every background it's used on).
