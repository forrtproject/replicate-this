import { createHash } from 'node:crypto'

/** SHA-256 of `input + pepper`, hex-encoded. Deterministic, one-way. */
export function hashWithPepper(input: string, pepper: string): string {
  return createHash('sha256')
    .update(input + pepper)
    .digest('hex')
}

/**
 * Deterministic dummy email of the form `<hash>@privacy.forrt.org`.
 * Stable for the same real email across providers, enabling account
 * linking without ever persisting the real address.
 */
export function deterministicEmail(rawEmail: string, pepper: string): string {
  const hash = hashWithPepper(rawEmail.toLowerCase().trim(), pepper)
  return `${hash}@privacy.forrt.org`
}
