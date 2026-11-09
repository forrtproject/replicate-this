/**
 * A short plain-text excerpt of a Markdown comment: links become their text,
 * emphasis, code and quote markers are dropped, whitespace is collapsed, and
 * long text is cut at a word boundary with an ellipsis.
 */
export function excerpt(markdown: string, max: number): string {
  const plain = markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // [text](url) -> text
    .replace(/^\s{0,3}(>|[-*+]|\d+\.)\s+/gm, '') // quote and list markers
    .replace(/[*_`~]+/g, '') // emphasis and code markers
    .replace(/\s+/g, ' ')
    .trim()
  if (plain.length <= max) return plain
  const cut = plain.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}
