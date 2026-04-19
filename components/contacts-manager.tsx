"use client"

import { useEffect, useMemo, useState } from "react"
import { Trash2, Pencil, Check, X, Plus } from "lucide-react"

import type { ContactCategory, ContactDTO } from "@/lib/contacts"
import { CONTACT_CATEGORIES, categoryLabel } from "@/lib/contacts"

const CATEGORY_BADGE_CLASS: Record<ContactCategory, string> = {
  FAMILY: "bg-purple-500/20 text-purple-100 ring-purple-400/30",
  FRIEND: "bg-orange-500/20 text-orange-100 ring-orange-400/30",
  WORK: "bg-green-500/20 text-green-100 ring-green-400/30",
  OTHER: "bg-blue-500/20 text-blue-100 ring-blue-400/30",
}

type Props = {
  language: "es" | "en"
  inputClassName: string
}

export function ContactsManager({ language, inputClassName }: Props) {
  const t = useMemo(
    () =>
      language === "es"
        ? {
            heading: "Contactos",
            subtitle:
              "La IA usa tus contactos para colocar el evento en el calendario correcto cuando mencionas a alguien por nombre.",
            empty: "Aún no tienes contactos. Crea uno o deja que la IA te lo proponga al añadir un evento.",
            namePh: "Nombre (p. ej. Benjamin)",
            relationPh: "Relación (opcional, p. ej. hermano)",
            add: "Añadir",
            saving: "Guardando…",
            cancel: "Cancelar",
            save: "Guardar",
            edit: "Editar",
            delete: "Eliminar",
            confirmDelete: "¿Eliminar este contacto?",
            errorAdd: "No se pudo añadir el contacto.",
            errorUpdate: "No se pudo actualizar.",
            errorDelete: "No se pudo eliminar.",
          }
        : {
            heading: "Contacts",
            subtitle:
              "The AI uses your contacts to place events in the correct calendar lane when you mention someone by name.",
            empty: "No contacts yet. Create one or let the AI suggest one when you add an event.",
            namePh: "Name (e.g. Benjamin)",
            relationPh: "Relation (optional, e.g. brother)",
            add: "Add",
            saving: "Saving…",
            cancel: "Cancel",
            save: "Save",
            edit: "Edit",
            delete: "Delete",
            confirmDelete: "Delete this contact?",
            errorAdd: "Could not add contact.",
            errorUpdate: "Could not update.",
            errorDelete: "Could not delete.",
          },
    [language],
  )

  const [contacts, setContacts] = useState<ContactDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newName, setNewName] = useState("")
  const [newCategory, setNewCategory] = useState<ContactCategory>("FAMILY")
  const [newRelation, setNewRelation] = useState("")
  const [adding, setAdding] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editCategory, setEditCategory] = useState<ContactCategory>("FAMILY")
  const [editRelation, setEditRelation] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/api/contacts")
      if (!res.ok) throw new Error("load")
      const data = await res.json()
      setContacts(Array.isArray(data.contacts) ? data.contacts : [])
    } catch {
      /* keep silent; UI is non-blocking */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    setError(null)
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          category: newCategory,
          relation: newRelation.trim() || undefined,
        }),
      })
      if (!res.ok) {
        setError(t.errorAdd)
        return
      }
      setNewName("")
      setNewRelation("")
      setNewCategory("FAMILY")
      await load()
    } finally {
      setAdding(false)
    }
  }

  function startEdit(c: ContactDTO) {
    setEditingId(c.id)
    setEditName(c.name)
    setEditCategory(c.category)
    setEditRelation(c.relation ?? "")
  }

  async function handleSaveEdit(id: string) {
    setSavingEdit(true)
    setError(null)
    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          category: editCategory,
          relation: editRelation.trim() || null,
        }),
      })
      if (!res.ok) {
        setError(t.errorUpdate)
        return
      }
      setEditingId(null)
      await load()
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t.confirmDelete)) return
    setError(null)
    const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" })
    if (!res.ok) {
      setError(t.errorDelete)
      return
    }
    await load()
  }

  return (
    <section className="border-t border-white/10 pt-4">
      <h3 className="font-medium text-white/90">{t.heading}</h3>
      <p className="mt-1 text-xs text-white/45">{t.subtitle}</p>

      <form onSubmit={handleAdd} className="mt-3 grid gap-2">
        <input
          className={inputClassName}
          placeholder={t.namePh}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          required
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            className={inputClassName}
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as ContactCategory)}
          >
            {CONTACT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c, language)}
              </option>
            ))}
          </select>
          <input
            className={inputClassName}
            placeholder={t.relationPh}
            value={newRelation}
            onChange={(e) => setNewRelation(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className="inline-flex w-fit items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 text-sm font-medium shadow-lg disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {adding ? t.saving : t.add}
        </button>
      </form>

      {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}

      <ul className="mt-4 space-y-2">
        {loading ? (
          <li className="text-sm text-white/40">…</li>
        ) : contacts.length === 0 ? (
          <li className="text-sm text-white/40">{t.empty}</li>
        ) : (
          contacts.map((c) => {
            const isEditing = editingId === c.id
            return (
              <li
                key={c.id}
                className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm"
              >
                {isEditing ? (
                  <div className="grid gap-2">
                    <input
                      className={inputClassName}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <select
                        className={inputClassName}
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value as ContactCategory)}
                      >
                        {CONTACT_CATEGORIES.map((cc) => (
                          <option key={cc} value={cc}>
                            {categoryLabel(cc, language)}
                          </option>
                        ))}
                      </select>
                      <input
                        className={inputClassName}
                        placeholder={t.relationPh}
                        value={editRelation}
                        onChange={(e) => setEditRelation(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={savingEdit}
                        onClick={() => void handleSaveEdit(c.id)}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-500/30 px-3 py-1 text-xs text-emerald-100 disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                        {savingEdit ? t.saving : t.save}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="inline-flex items-center gap-1 rounded-md bg-white/10 px-3 py-1 text-xs text-white/80"
                      >
                        <X className="h-3.5 w-3.5" />
                        {t.cancel}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-white/90">{c.name}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] uppercase ring-1 ${CATEGORY_BADGE_CLASS[c.category]}`}
                        >
                          {categoryLabel(c.category, language)}
                        </span>
                      </div>
                      {c.relation ? (
                        <div className="text-xs text-white/45">{c.relation}</div>
                      ) : null}
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        className="rounded-md bg-white/10 p-1.5 text-white/80 hover:bg-white/15"
                        title={t.edit}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(c.id)}
                        className="rounded-md bg-red-500/20 p-1.5 text-red-100 hover:bg-red-500/30"
                        title={t.delete}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            )
          })
        )}
      </ul>
    </section>
  )
}
