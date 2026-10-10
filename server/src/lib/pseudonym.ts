import { randomInt } from 'node:crypto'
import { and, eq, ne, sql } from 'drizzle-orm'
import { db, schema } from '@/db'

/**
 * Display names. We encourage real names: a new account starts with the name
 * from its sign-in provider when there is one (see `initialDisplayName`). The
 * Reddit-style pseudonyms ("BrightQuasar42") are the fallback, and what the
 * profile's Randomize button suggests for anyone who prefers not to use theirs.
 */

// Kept free of anything that could read as a dig at the person wearing it
// (no "Fossil", "Placebo", …): a name is suggested, not chosen.
const ADJECTIVES = [
  'Bright', 'Curious', 'Rigorous', 'Skeptical', 'Diligent', 'Careful',
  'Bold', 'Quiet', 'Rapid', 'Steady', 'Keen', 'Candid',
  'Precise', 'Patient', 'Vivid', 'Lucid', 'Robust', 'Subtle',
  'Earnest', 'Nimble', 'Sharp', 'Tenacious', 'Honest', 'Modest',
] as const

const NOUNS = [
  'Quasar', 'Neutrino', 'Axiom', 'Theorem', 'Pipette', 'Catalyst',
  'Vector', 'Neuron', 'Genome', 'Isotope', 'Pendulum', 'Prism',
  'Photon', 'Enzyme', 'Tensor', 'Comet', 'Lemma', 'Sample',
  'Datum', 'Journal', 'Preprint', 'Orbit', 'Compass', 'Beacon',
] as const

function randomPseudonym(): string {
  const adj = ADJECTIVES[randomInt(ADJECTIVES.length)]
  const noun = NOUNS[randomInt(NOUNS.length)]
  return `${adj}${noun}${randomInt(10, 100)}`
}

/** Case-insensitive taken-check among live (non-deleted) accounts. */
export async function pseudonymTaken(name: string, excludeUid?: string): Promise<boolean> {
  const conditions = [
    sql`lower(${schema.user.name}) = lower(${name})`,
    eq(schema.user.deleted, false),
  ]
  if (excludeUid) conditions.push(ne(schema.user.id, excludeUid))
  const [row] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(and(...conditions))
    .limit(1)
  return Boolean(row)
}

/** Generates a pseudonym that isn't taken yet (checked against the DB). */
export async function generateUniquePseudonym(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const candidate = randomPseudonym()
    if (!(await pseudonymTaken(candidate))) return candidate
  }
  // Practically unreachable; fall back to a random suffix that cannot collide
  // with the word-list space.
  return `Researcher-${randomInt(1e9).toString(36)}${Date.now().toString(36)}`
}

export const PSEUDONYM_MAX_LENGTH = 50

/**
 * Validates a user-chosen display name. Returns the trimmed name or an error
 * message. Real names need apostrophes and full stops ("Siobhán O'Brien",
 * "J. Smith"); reserved names guard the anonymity tombstone and legacy default.
 */
export function validatePseudonym(raw: string): { name?: string; error?: string } {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (name.length < 3) return { error: 'Names need at least 3 characters.' }
  if (name.length > PSEUDONYM_MAX_LENGTH) {
    return { error: `Names must be at most ${PSEUDONYM_MAX_LENGTH} characters.` }
  }
  if (!/^[\p{L}\p{N}][\p{L}\p{M}\p{N} _.'’-]*$/u.test(name)) {
    return { error: 'Use letters, numbers, spaces, hyphens, apostrophes or full stops only.' }
  }
  const reserved = ['deleted account', 'anonymous researcher']
  if (reserved.includes(name.toLowerCase())) {
    return { error: 'That name is reserved.' }
  }
  return { name }
}

/**
 * The name a new account starts with: the provider's profile name when it is a
 * usable, untaken display name, otherwise a random pseudonym. A taken real name
 * gets a numeric suffix rather than being swapped for a pseudonym, since two
 * researchers sharing a name is common.
 */
export async function initialDisplayName(providerName: string | null | undefined): Promise<string> {
  const { name } = validatePseudonym(providerName ?? '')
  if (name && !['deleted account', 'anonymous researcher'].includes(name.toLowerCase())) {
    if (!(await pseudonymTaken(name))) return name
    for (let n = 2; n < 10; n++) {
      const candidate = `${name} ${n}`
      if (candidate.length <= PSEUDONYM_MAX_LENGTH && !(await pseudonymTaken(candidate))) {
        return candidate
      }
    }
  }
  return generateUniquePseudonym()
}
