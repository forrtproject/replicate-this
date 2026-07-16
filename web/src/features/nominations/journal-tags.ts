import type { AvailabilityKey, VerificationType } from '@/types'

/**
 * Target-journal tags: outlets that could publish the resulting replication /
 * reproduction study. Derived on the fly from the nomination's discipline,
 * verification type, and availability — never stored, so editing a nomination
 * (or changing these rules) updates the tags everywhere at once.
 */

export interface JournalTagInput {
  discipline: string
  verificationType: VerificationType
  availability: AvailabilityKey[]
  /** Nominator-flagged: the study is experimental research (gates the RX tag). */
  experimentalResearch?: boolean
}

export interface JournalTag {
  key: string
  /** Full journal name, shown in the tooltip. */
  name: string
  /** Why this nomination qualifies, shown in the tooltip. */
  hint: string
}

const wantsReproduction = (t: VerificationType) => t === 'reproduction' || t === 'both'

const RULES: (JournalTag & { matches: (n: JournalTagInput) => boolean })[] = [
  {
    key: 'R2',
    name: 'R²',
    hint: 'Accepts replication and reproduction studies from all disciplines.',
    matches: () => true,
  },
  {
    key: 'JRR',
    name: 'Journal of Robustness Reports',
    hint: 'Robustness reproductions — re-running the original analysis plus alternative specifications. Social sciences and beyond.',
    matches: (n) => wantsReproduction(n.verificationType),
  },
  {
    key: 'JCRE',
    name: 'Journal of Comments and Replications in Economics',
    hint: 'Replications, reproductions, and comments on published economics research.',
    matches: (n) => n.discipline === 'Economics',
  },
  {
    key: 'RC',
    name: 'ReScience C',
    hint: 'Reruns and rewrites of computational research — this study shares open code.',
    // No "computational" discipline exists; open code is our signal that the
    // study is computational enough to rerun or rewrite.
    matches: (n) => n.availability.includes('open_code'),
  },
  {
    key: 'RX',
    name: 'Rx — Experimental Research (ReScience X)',
    hint: 'Reruns and rewrites of experimental research — the nominator flagged this study as experimental.',
    matches: (n) => !!n.experimentalResearch,
  },
]

/** The target journals this nomination qualifies for, in fixed display order. */
export function matchJournalTags(n: JournalTagInput): JournalTag[] {
  return RULES.filter((r) => r.matches(n)).map(({ key, name, hint }) => ({ key, name, hint }))
}
