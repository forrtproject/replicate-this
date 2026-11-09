import { Link } from 'react-router-dom'

/** The short version of the nomination guidelines, beside the nominate and edit forms. */
export function NominationGuidance({
  editing = false,
  children,
}: {
  editing?: boolean
  /** Shown under the guidance in the same sticky column. */
  children?: React.ReactNode
}) {
  if (editing) {
    return (
      <aside className="lg:order-2">
        <div className="lg:sticky lg:top-20">
        <div className="rounded-lg border border-band-line bg-band p-5 text-sm leading-relaxed">
          <h2 className="label">When editing</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-4 text-ink/85 marker:text-muted-foreground">
            <li>Keep the case about the evidence, never the authors.</li>
            <li>Add links to data, code or materials as they become available.</li>
            <li>Comments and votes stay with the nomination when you save.</li>
          </ul>
          <p className="mt-4 flex gap-4 border-t border-line pt-3">
            <Link to="/guidelines" target="_blank" className="font-medium text-forest hover:underline">
              Full guidelines
            </Link>
            <Link to="/code-of-conduct" target="_blank" className="font-medium text-forest hover:underline">
              Code of Conduct
            </Link>
          </p>
        </div>
        {children}
        </div>
      </aside>
    )
  }
  return (
    <aside className="lg:order-2">
      <div className="lg:sticky lg:top-20">
      <div className="rounded-lg border border-band-line bg-band p-5 text-sm leading-relaxed">
        <h2 className="label">A good nomination</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-4 text-ink/85 marker:text-muted-foreground">
          <li>Gives the DOI, so everyone looks at the same paper.</li>
          <li>
            Says why a second look is valuable: the finding is influential, later work rests
            on it, or the evidence is thin.
          </li>
          <li>Notes what is openly available, so others can judge feasibility.</li>
          <li>Is about the evidence, never the authors. No allegations of misconduct.</li>
        </ul>
        <p className="mt-3 text-muted-foreground">
          Search the{' '}
          <Link to="/nominations" className="text-forest underline">
            registry
          </Link>{' '}
          first: if the study is listed, upvote it instead.
        </p>
        <p className="mt-4 flex gap-4 border-t border-line pt-3">
          <Link to="/guidelines" target="_blank" className="font-medium text-forest hover:underline">
            Full guidelines
          </Link>
          <Link to="/code-of-conduct" target="_blank" className="font-medium text-forest hover:underline">
            Code of Conduct
          </Link>
        </p>
      </div>
      {children}
      </div>
    </aside>
  )
}
