#!/usr/bin/env node
/**
 * Screenshot harness: captures every main screen of the web app, as an
 * anonymous visitor, a signed-in researcher, a brand-new account and a
 * maintainer, for visual review.
 *
 * Prerequisites (see docs/SYSTEM.md § 8 for the local stack):
 *   1. API and web dev servers running (`npm run dev` in server/ and web/).
 *   2. Demo data: in server/, `npm run db:seed && npm run db:demo &&
 *      npx tsx src/db/demo-activity.ts` (replaces placeholder papers, staggers dates).
 *   3. Sessions: in server/, `npx tsx src/scripts/dev-sessions.ts > sessions.json`
 *      (any path; pass it with --sessions).
 *
 * Usage (from web/):
 *   node scripts/screenshots.mjs --sessions ../server/sessions.json --out shots/desktop
 *   node scripts/screenshots.mjs --sessions … --out shots/phone --width 390 --height 844
 *   node scripts/screenshots.mjs --sessions … --only registry,nomination-approved
 *
 * Options: --base (default http://localhost:5173/replicate-this), --api
 * (default http://localhost:8787), --width
 * (1440), --height (900), --only (comma-separated screen names), --viewport-only
 * (capture the first screen only instead of the full page).
 */
import { chromium } from 'playwright'
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]])
    return acc
  }, []),
)
const base = (args.base ?? 'http://localhost:5173/replicate-this').replace(/\/$/, '')
const out = args.out ?? 'shots'
const width = Number(args.width ?? 1440)
const height = Number(args.height ?? 900)
const only = args.only ? String(args.only).split(',') : null
if (!args.sessions) {
  console.error('--sessions <file> is required (output of server/src/scripts/dev-sessions.ts)')
  process.exit(1)
}
const sessions = JSON.parse(readFileSync(args.sessions, 'utf8'))

const api = (args.api ?? 'http://localhost:8787').replace(/\/$/, '')
const nominations = await fetch(`${api}/api/nominations`)
  .then((r) => r.json())
  .then((d) => d.nominations)
const byTitle = (prefix) => {
  const n = nominations.find((x) => x.metadata?.title?.startsWith(prefix))
  if (!n) throw new Error(`Demo nomination "${prefix}…" not found; seed the demo data first`)
  return n.id
}

// The fixed screen list. Keep it stable so screenshots stay comparable over time.
const SCREENS = [
  { name: 'registry', path: '/nominations', as: null },
  { name: 'registry-signed-in', path: '/nominations', as: 'user' },
  { name: 'registry-filtered', path: '/nominations?status=in_progress', as: null },
  { name: 'registry-no-results', path: '/nominations?q=zebrafish+telepathy', as: null },
  { name: 'nomination-approved-owner', path: () => `/nominations/${byTitle('Power Posing')}`, as: 'user' },
  { name: 'nomination-in-progress', path: () => `/nominations/${byTitle('Ego Depletion')}`, as: null },
  { name: 'nomination-completed', path: () => `/nominations/${byTitle('Growth in a Time of Debt')}`, as: null },
  { name: 'nomination-pending-owner', path: () => `/nominations/${byTitle('Minimum Wages and Employment')}`, as: 'user' },
  { name: 'nomination-maintainer-view', path: () => `/nominations/${byTitle('Publication bias in the social sciences')}`, as: 'admin' },
  {
    name: 'researcher-profile',
    path: () => `/nominations/${byTitle('Feeling the Future')}`,
    as: null,
    // Researcher URLs use an opaque token, so follow the nominator link.
    async setup(page) {
      const link = page.locator('a[href*="/researchers/"]').first()
      await link.click()
      await page.waitForURL(/\/researchers\//)
    },
  },
  { name: 'sign-in', path: '/sign-in', as: null },
  { name: 'guidelines', path: '/guidelines', as: null },
  { name: 'not-found', path: '/no-such-page', as: null },
  { name: 'nominate-empty', path: '/nominate', as: 'user' },
  {
    name: 'nominate-doi-resolved',
    path: '/nominate',
    as: 'user',
    async setup(page) {
      await page.getByPlaceholder('10.1000/example').fill('10.1037/0022-3514.79.6.995')
      await page.locator('#doi-status').getByText('When choice is demotivating', { exact: false }).waitFor({ timeout: 15000 })
    },
  },
  { name: 'nomination-edit', path: () => `/nominations/${byTitle('Power Posing')}/edit`, as: 'user' },
  { name: 'dashboard', path: '/dashboard', as: 'user' },
  { name: 'profile', path: '/profile', as: 'user' },
  { name: 'welcome', path: '/welcome', as: 'newcomer' },
  { name: 'admin-review', path: '/admin', as: 'admin' },
  { name: 'admin-comments', path: '/admin/comments', as: 'admin' },
  { name: 'admin-users', path: '/admin/users', as: 'admin' },
]

mkdirSync(out, { recursive: true })
const browser = await chromium.launch()
const contexts = {}
async function contextFor(role) {
  const key = role ?? 'anon'
  if (contexts[key]) return contexts[key]
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: width < 700 ? 2 : 1,
    reducedMotion: 'reduce',
    locale: 'en-GB',
    timezoneId: 'Europe/London',
  })
  if (role) {
    await ctx.addCookies([
      { name: sessions.cookieName, value: sessions[role], url: new URL(base).origin, httpOnly: true, sameSite: 'Lax' },
    ])
  }
  contexts[key] = ctx
  return ctx
}

const failures = []
for (const s of SCREENS) {
  if (only && !only.includes(s.name)) continue
  const ctx = await contextFor(s.as)
  const page = await ctx.newPage()
  try {
    const path = typeof s.path === 'function' ? s.path() : s.path
    await page.goto(base + path, { waitUntil: 'networkidle' })
    if (s.setup) await s.setup(page)
    await page.waitForLoadState('networkidle')
    // Park the pointer so no row is captured in its hover state.
    await page.mouse.move(0, 0)
    // Let fonts and late layout settle; hide the caret so shots are stable.
    await page.evaluate(() => document.fonts.ready)
    await page.addStyleTag({ content: '*{caret-color:transparent!important}' })
    await page.waitForTimeout(300)
    const file = join(out, `${s.name}.png`)
    await page.screenshot({ path: file, fullPage: !args['viewport-only'] })
    console.log(`✓ ${s.name}`)
  } catch (err) {
    failures.push(s.name)
    console.error(`✗ ${s.name}: ${err.message.split('\n')[0]}`)
  } finally {
    await page.close()
  }
}
await browser.close()
if (failures.length) process.exit(1)
