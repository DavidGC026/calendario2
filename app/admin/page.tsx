import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, FileText, Shield } from "lucide-react"

import { AdminUsersPanel } from "@/components/admin-users-panel"
import { getCurrentUser } from "@/lib/auth"
import { listAdminUsers } from "@/lib/admin-users"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Usuarios (admin) | Calendario inteligente",
  description: "Roles e IA por cuenta — solo administradores",
}

export default async function AdminUsersPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/login?callbackUrl=/admin")
  }
  if (user.role !== "ADMIN") {
    redirect("/")
  }

  const users = await listAdminUsers()

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-rose-950/90 via-slate-950 to-blue-950/90" />
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
              href="/notas"
              className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10"
            >
              <FileText className="h-4 w-4 shrink-0" />
              Notas
            </Link>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/25 ring-1 ring-amber-400/30">
              <Shield className="h-5 w-5 text-amber-100" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Usuarios</h1>
              <p className="mt-1 text-sm text-white/55">
                Admin entra a este panel y a las notas. IA abre el asistente de calendario. Cada
                cuenta sigue viendo solo su propia agenda.
              </p>
            </div>
          </div>
        </div>

        <AdminUsersPanel initialUsers={users} currentUserId={user.id} />
      </div>
    </main>
  )
}
