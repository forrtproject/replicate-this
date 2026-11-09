import { FlaskConical } from 'lucide-react'
import { Tooltip } from '@/components/ui/Tooltip'
import type { VerificationType } from '@/types'
import { VERIFICATION_CONFIG, TERM_DEFINITIONS } from './verification'

/** A term (Replication / Reproduction) rendered with a definition tooltip. */
export function DefinedTerm({
  term,
  lowercase = true,
}: {
  term: keyof typeof TERM_DEFINITIONS
  lowercase?: boolean
}) {
  return (
    <Tooltip content={TERM_DEFINITIONS[term]}>
      <span className="cursor-help text-ink underline decoration-dotted underline-offset-2">
        {lowercase ? term.toLowerCase() : term}
      </span>
    </Tooltip>
  )
}

/** Compact pill for cards. */
export function VerificationBadge({ type }: { type: VerificationType }) {
  const { short } = VERIFICATION_CONFIG[type]
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-tint px-2 py-0.5 text-xs font-medium text-forest">
      <FlaskConical className="h-3 w-3" />
      {short}
    </span>
  )
}
