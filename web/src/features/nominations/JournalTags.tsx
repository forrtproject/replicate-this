import { BookMarked } from 'lucide-react'
import { Tooltip } from '@/components/ui/Tooltip'
import { matchJournalTags, type JournalTagInput } from './journal-tags'

/**
 * Target-journal chips: where the resulting replication / reproduction could
 * be published. Hovering a chip shows the full journal name and why the
 * nomination qualifies.
 */
export function JournalTags({ nomination }: { nomination: JournalTagInput }) {
  const tags = matchJournalTags(nomination)
  if (tags.length === 0) return null
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {tags.map((t) => (
        <Tooltip
          key={t.key}
          content={
            <>
              <span className="font-semibold">{t.name}</span>
              <br />
              {t.hint}
            </>
          }
        >
          <span className="inline-flex cursor-help items-center gap-1 rounded-full border border-line bg-muted px-2 py-0.5 text-xs font-medium text-ink/70">
            <BookMarked className="h-3 w-3 opacity-60" />
            {t.key}
          </span>
        </Tooltip>
      ))}
    </span>
  )
}
