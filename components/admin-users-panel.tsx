"use client"

import { useMemo, useState } from "react"
import { Loader2, Search, Shield, Sparkles } from "lucide-react"

import type { AdminUserRow } from "@/lib/admin-users"

type Props = {
  initialUsers: AdminUserRow[]
  currentUserId: string
}

function formatJoined(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function AdminUsersPanel({ initialUsers, currentUserId }: Props) {
  const [users, setUsers] = useState(initialUsers)
  const [query, setQuery] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => {
      const hay = `${u.name ?? ""} ${u.email}`.toLowerCase()
      return hay.includes(q)
    })
  }, [users, query])

  async function patchUser(id: string, body: { role?: "USER" | "ADMIN"; aiEnabled?: boolean }) {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "No se pudo actualizar")
        return
      }
      const next = data.user as Pick<AdminUserRow, "id" | "email" | "name" | "role" | "aiEnabled">
      setUsers((prev) =>
        prev.map((u) => (u.id === next.id ? { ...u, role: next.role, aiEnabled: next.aiEnabled } : u)),
      )
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-white/55">
          {users.length} cuentas · {users.filter((u) => u.role === "ADMIN").length} admin ·{" "}
          {users.filter((u) => u.aiEnabled).length} con IA
        </p>
        <label className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 sm:max-w-xs">
          <Search className="h-4 w-4 shrink-0 text-white/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o correo"
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
          />
        </label>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-8 text-center text-sm text-white/50">
          Nadie coincide con «{query.trim()}».
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((u) => {
            const busy = busyId === u.id
            const isSelf = u.id === currentUserId
            const initial = (u.name?.[0] ?? u.email[0] ?? "?").toUpperCase()
            return (
              <li
                key={u.id}
                className="rounded-2xl border border-white/12 bg-white/[0.05] p-4 backdrop-blur-md"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-dvg-red-soft to-dvg-gold text-sm font-bold text-white ring-2 ring-dvg-gold-light/25">
                      {initial}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">
                        {u.name?.trim() || "Sin nombre"}
                        {isSelf ? (
                          <span className="ml-2 rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-normal text-white/70">
                            tú
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-sm text-white/55">{u.email}</p>
                      <p className="mt-1 text-xs text-white/40">
                        Alta {formatJoined(u.createdAt)} · {u.eventCount}{" "}
                        {u.eventCount === 1 ? "evento" : "eventos"}
                        {u.hasPassword ? "" : " · entra con Google"}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <button
                      type="button"
                      disabled={busy || (isSelf && u.role === "ADMIN")}
                      onClick={() =>
                        patchUser(u.id, { role: u.role === "ADMIN" ? "USER" : "ADMIN" })
                      }
                      className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium ring-1 transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        u.role === "ADMIN"
                          ? "bg-amber-500/20 text-amber-100 ring-amber-400/35"
                          : "bg-white/[0.06] text-white/75 ring-white/15 hover:bg-white/10"
                      }`}
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                      {u.role === "ADMIN" ? "Admin" : "Hacer admin"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => patchUser(u.id, { aiEnabled: !u.aiEnabled })}
                      className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium ring-1 transition disabled:opacity-40 ${
                        u.aiEnabled
                          ? "bg-rose-500/25 text-rose-100 ring-rose-400/35"
                          : "bg-white/[0.06] text-white/75 ring-white/15 hover:bg-white/10"
                      }`}
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {u.aiEnabled ? "IA activa" : "Activar IA"}
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
