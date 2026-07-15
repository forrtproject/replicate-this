import { FlaskConical, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/components/ui/Tooltip'
import type { VerificationType } from '@/types'
import { VERIFICATION_CONFIG, TERM_DEFINITIONS } from './verification'

/** A term (Replication / Reproduction) rendered with a definition tooltip. */
export function DefinedTerm({ term }: { term: keyof typeof TERM_DEFINITIONS }) {
  return (
    <Tooltip content={TERM_DEFINITIONS[term]}>
      <span className="cursor-help underline decoration-dotted underline-offset-2">
        {term}
        <HelpCircle className="ml-0.5 inline h-3 w-3 align-text-top opacity-60" />
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

/** Prominent banner for the detail page — states what is needed, with tooltips. */
export function VerificationBanner({ type }: { type: VerificationType }) {
  const { label, term } = VERIFICATION_CONFIG[type]
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border-l-4 border-green bg-green-tint px-4 py-3',
      )}
    >
      <FlaskConical className="mt-0.5 h-5 w-5 flex-shrink-0 text-green" />
      <div className="text-sm">
        <p className="font-display font-semibold text-forest">{label}</p>
        <p className="mt-0.5 text-muted-foreground">
          {type === 'both' ? (
            <>
              A <DefinedTerm term="Replication" /> or a{' '}
              <DefinedTerm term="Reproduction" /> would both be valuable here.
            </>
          ) : term ? (
            <>
              A <DefinedTerm term={term} /> would help confirm whether this finding holds.
            </>
          ) : null}
        </p>
      </div>
    </div>
  )
}
