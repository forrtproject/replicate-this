#!/usr/bin/env bash
# Runs on the server after CI has rsynced the build. Installs runtime deps,
# applies migrations, restarts the API. Failing loudly is deliberate: a bad
# migration must stop the deploy rather than restart into a broken schema.
set -euo pipefail
cd "$(dirname "$0")"

# A non-interactive ssh session skips the login profile, so aaPanel's Node
# directory (which carries npm and pm2) has to be put on PATH by hand.
NODE_BIN="$(ls -d /www/server/nodejs/v*/bin 2>/dev/null | sort -V | tail -1 || true)"
if [ -n "$NODE_BIN" ]; then export PATH="$NODE_BIN:$PATH"; fi

# --omit=optional as well: the optional peer deps of drizzle-orm and better-auth
# otherwise drag tsx, vitest, drizzle-kit and esbuild along (131M vs 50M).
npm ci --omit=dev --omit=optional
node dist/db/migrate.js
pm2 startOrRestart ecosystem.config.cjs --update-env
pm2 save
