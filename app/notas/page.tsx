import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, FileText, Shield } from "lucide-react"

import { AdminNotesManager } from "@/components/admin-notes-manager"
import { getCurrentUser } from "@/lib/auth"
import { listAdminNotes } from "@/lib/admin-notes"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Notas (admin) | Calendario inteligente",
  description: "Notas en Markdown — solo administradores",
}

export default async function NotasPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login?callbackUrl=/notas")
  }
  if (user.role !== "ADMIN") {
    redirect("/")
  }

  const notes = await listAdminNotes()

  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-dvg-red-dark/90 via-neutral-950 to-dvg-gold-dark/80" />
      <div className="relative mx-auto max-w-3xl px-safe py-8 md:max-w-4xl md:py-12">
        <div className="mb-8 flex flex-col gap-4 border-b border-white/10 pb-6">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              Volver al calendario
            </Link>
            <Link
              href="/admin"
              className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10"
            >
              <Shield className="h-4 w-4 shrink-0" />
              Usuarios
            </Link>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-dvg-gold/25 ring-1 ring-dvg-gold-light/30">
              <FileText className="h-5 w-5 text-dvg-gold-light" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Notas</h1>
              <p className="mt-1 text-sm text-white/55">
                Solo administradores. Crea y edita notas en Markdown; se guardan en la base de datos.
              </p>
            </div>
          </div>
        </div>

        <AdminNotesManager initialNotes={notes} />
      </div>
    </main>
  )
}
