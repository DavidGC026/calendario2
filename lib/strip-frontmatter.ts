/** Quita frontmatter YAML inicial (--- ... ---) para mostrar solo el cuerpo Markdown. */
export function stripYamlFrontmatter(source: string): string {
  const t = source.trimStart()
  if (!t.startsWith("---\n")) return source
  const end = t.indexOf("\n---\n", 4)
  if (end === -1) return source
  return t.slice(end + 5).trimStart()
}
