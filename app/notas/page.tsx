import { readFile } from "fs/promises"
import path from "path"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, FileText } from "lucide-react"

import { MarkdownContent } from "@/components/markdown-content"
import { getCurrentSession } from "@/lib/auth"
import { stripYamlFrontmatter } from "@/lib/strip-frontmatter"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Notas | Calendario inteligente",
  description: "Notas en Markdown (content/notas.md)",
}

const NOTAS_PATH = path.join(process.cwd(), "content", "notas.md")

const FALLBACK_MD = `# Notas

No se encontró \`content/notas.md\`. Crea ese archivo en la raíz del proyecto (carpeta \`content/\`) y vuelve a cargar.
`

export default async function NotasPage() {
  const session = await getCurrentSession()
  if (!session) {
    redirect("/login?callbackUrl=/notas")
  }

  let raw: string
  try {
    raw = await readFile(NOTAS_PATH, "utf-8")
  } catch {
    raw = FALLBACK_MD
  }

  const markdown = stripYamlFrontmatter(raw)

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-950/90 via-slate-950 to-blue-950/90" />
      <div className="relative mx-auto max-w-3xl px-safe py-8 md:py-12">
        <div className="mb-8 flex flex-col gap-4 border-b border-white/10 pb-6">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            Volver al calendario
          </Link>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/25 ring-1 ring-sky-400/30">
              <FileText className="h-5 w-5 text-sky-200" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Notas</h1>
              <p className="mt-1 text-sm text-white/55">
                Contenido Markdown desde <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-sky-200">content/notas.md</code>
              </p>
            </div>
          </div>
        </div>

        <article className="rounded-2xl border border-white/10 bg-slate-950/50 p-5 shadow-xl backdrop-blur-md md:p-8">
          <MarkdownContent markdown={markdown} />
        </article>
      </div>
    </main>
  )
}
