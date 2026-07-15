import { randomInt } from 'node:crypto'
import { and, eq, ne, sql } from 'drizzle-orm'
import { db, schema } from '@/db'

/**
 * Reddit-style auto-generated pseudonyms ("BrightQuasar42"): every account
 * gets one at signup and can change it (to any unique name) in their profile.
 */

const ADJECTIVES = [
  'Bright', 'Curious', 'Rigorous', 'Skeptical', 'Diligent', 'Careful',
  'Bold', 'Quiet', 'Rapid', 'Steady', 'Keen', 'Candid',
  'Precise', 'Patient', 'Vivid', 'Lucid', 'Robust', 'Subtle',
  'Earnest', 'Nimble', 'Sharp', 'Tenacious', 'Honest', 'Modest',
] as const

const NOUNS = [
  'Quasar', 'Neutrino', 'Axiom', 'Theorem', 'Pipette', 'Catalyst',
  'Vector', 'Neuron', 'Genome', 'Isotope', 'Pendulum', 'Prism',
  'Photon', 'Enzyme', 'Tensor', 'Fossil', 'Comet', 'Lemma',
  'Placebo', 'Sample', 'Datum', 'Archive', 'Journal', 'Preprint',
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

export const PSEUDONYM_MAX_LENGTH = 30

/**
 * Validates a user-chosen pseudonym. Returns the trimmed name or an error
 * message. Reserved names guard the anonymity tombstone and legacy default.
 */
export function validatePseudonym(raw: string): { name?: string; error?: string } {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (name.length < 3) return { error: 'Pseudonyms need at least 3 characters.' }
  if (name.length > PSEUDONYM_MAX_LENGTH) {
    return { error: `Pseudonyms must be at most ${PSEUDONYM_MAX_LENGTH} characters.` }
  }
  if (!/^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u.test(name)) {
    return { error: 'Use letters, numbers, spaces, hyphens or underscores only.' }
  }
  const reserved = ['deleted account', 'anonymous researcher']
  if (reserved.includes(name.toLowerCase())) {
    return { error: 'That name is reserved.' }
  }
  return { name }
}
