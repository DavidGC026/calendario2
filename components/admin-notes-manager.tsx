"use client"

import { useMemo, useState } from "react"
import { Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react"

import { MarkdownContent } from "@/components/markdown-content"
import type { AdminNoteDTO } from "@/lib/admin-notes"

type Props = {
  initialNotes: AdminNoteDTO[]
}

export function AdminNotesManager({ initialNotes }: Props) {
  const [notes, setNotes] = useState<AdminNoteDTO[]>(initialNotes)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [draftTitle, setDraftTitle] = useState("")
  const [draftBody, setDraftBody] = useState("")

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editBody, setEditBody] = useState("")

  const sorted = useMemo(() => [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [notes])

  async function refresh() {
    const res = await fetch("/api/admin/notes")
    if (!res.ok) {
      setError("No se pudieron cargar las notas")
      return
    }
    const data = (await res.json()) as { notes: AdminNoteDTO[] }
    setNotes(data.notes)
  }

  function startCreate() {
    setError(null)
    setCreating(true)
    setDraftTitle("")
    setDraftBody("")
  }

  function cancelCreate() {
    setCreating(false)
    setDraftTitle("")
    setDraftBody("")
  }

  async function submitCreate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: draftTitle.trim(), body: draftBody }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "No se pudo crear")
        return
      }
      setNotes((prev) => [data.note, ...prev])
      cancelCreate()
    } finally {
      setLoading(false)
    }
  }

  function startEdit(n: AdminNoteDTO) {
    setEditingId(n.id)
    setEditTitle(n.title)
    setEditBody(n.body)
    setCreating(false)
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditTitle("")
    setEditBody("")
  }

  async function submitEdit(id: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim(), body: editBody }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "No se pudo guardar")
        return
      }
      setNotes((prev) => prev.map((x) => (x.id === id ? data.note : x)))
      cancelEdit()
    } finally {
      setLoading(false)
    }
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar esta nota?")) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/notes/${id}`, { method: "DELETE" })
      if (!res.ok) {
        setError("No se pudo eliminar")
        return
      }
      setNotes((prev) => prev.filter((x) => x.id !== id))
      if (editingId === id) cancelEdit()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-100">{error}</div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => (creating ? cancelCreate() : startCreate())}
          className="inline-flex items-center gap-2 rounded-xl border border-sky-500/40 bg-sky-500/20 px-4 py-2.5 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/30 disabled:opacity-50"
          disabled={loading}
        >
          {creating ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {creating ? "Cancelar" : "Nueva nota"}
        </button>
        <button
          type="button"
          onClick={() => void refresh()}
          className="text-sm text-white/50 underline-offset-2 hover:text-white/80 hover:underline"
          disabled={loading}
        >
          Recargar lista
        </button>
      </div>

      {creating ? (
        <section className="rounded-2xl border border-white/15 bg-slate-950/60 p-5 md:p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Nueva nota</h2>
          <label className="block text-sm text-white/60">
            Título
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-base text-white outline-none ring-sky-500/40 focus:ring-2"
              placeholder="Ej. Despliegue abril 2026"
              maxLength={200}
            />
          </label>
          <label className="mt-4 block text-sm text-white/60">
            Contenido (Markdown)
            <textarea
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              rows={12}
              className="mt-1.5 w-full resize-y rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 font-mono text-sm text-white outline-none ring-sky-500/40 focus:ring-2"
              placeholder="# Encabezado&#10;&#10;- lista&#10;- **negrita**"
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void submitCreate()}
              disabled={loading || !draftTitle.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-sky-500 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar
            </button>
          </div>
        </section>
      ) : null}

      {sorted.length === 0 && !creating ? (
        <p className="rounded-2xl border border-dashed border-white/20 bg-white/[0.03] px-6 py-12 text-center text-white/55">
          Aún no hay notas. Pulsa <strong className="text-white/80">Nueva nota</strong> para crear la primera.
        </p>
      ) : null}

      <ul className="space-y-6">
        {sorted.map((n) => (
          <li key={n.id} className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/50 shadow-xl backdrop-blur-md">
            {editingId === n.id ? (
              <div className="p-5 md:p-6">
                <h2 className="mb-4 text-lg font-semibold text-white">Editar nota</h2>
                <label className="block text-sm text-white/60">
                  Título
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-base text-white outline-none ring-sky-500/40 focus:ring-2"
                    maxLength={200}
                  />
                </label>
                <label className="mt-4 block text-sm text-white/60">
                  Contenido (Markdown)
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={12}
                    className="mt-1.5 w-full resize-y rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 font-mono text-sm text-white outline-none ring-sky-500/40 focus:ring-2"
                  />
                </label>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void submitEdit(n.id)}
                    disabled={loading || !editTitle.trim()}
                    className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-sky-500 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Guardar cambios
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="rounded-xl border border-white/20 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10"
                    disabled={loading}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-5 py-4 md:px-6">
                  <div>
                    <h2 className="text-xl font-semibold text-white">{n.title}</h2>
                    <p className="mt-1 text-xs text-white/45">
                      Actualizado {new Date(n.updatedAt).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
                      {" · "}
                      {n.author.email}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(n)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-3 py-1.5 text-sm text-white/90 transition hover:bg-white/10"
                      disabled={loading}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(n.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-1.5 text-sm text-red-100 transition hover:bg-red-900/50"
                      disabled={loading}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Eliminar
                    </button>
                  </div>
                </div>
                <div className="p-5 md:p-8">
                  <MarkdownContent markdown={n.body || "_Sin contenido_"} />
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
