"use client"

import { useEffect, useMemo, useState } from "react"
import { Copy, KeyRound, Trash2 } from "lucide-react"

type ApiKey = {
  id: string
  name: string
  last4: string
  createdAt: string
  lastUsedAt: string | null
  expiresAt: string | null
}

type Props = {
  language: "es" | "en"
  inputClassName: string
}

/**
 * Llaves de API: dejar entrar a un programa sin darle la contraseña.
 *
 * La llave se enseña una sola vez, aquí, en cuanto se crea. No es una molestia
 * evitable: no se guarda en claro en ningún sitio, así que la alternativa sería
 * poder leerla siempre, y entonces cualquiera con la sesión abierta un minuto se
 * llevaría todas las que hay.
 */
export function ApiKeysCard({ language, inputClassName }: Props) {
  const t = useMemo(
    () =>
      language === "es"
        ? {
            heading: "Llaves de acceso para programas",
            subtitle:
              "Para que un programa (Jarvis, un script, otra máquina) entre a tu calendario sin tu contraseña. Cada una se revoca por separado.",
            namePh: "Para qué es (p. ej. «Jarvis»)",
            create: "Crear llave",
            creating: "Creando…",
            createdTitle: "Cópiala ahora: no se vuelve a enseñar",
            createdHint:
              "Guárdala donde la vaya a usar el programa. Si la pierdes, revócala y haz otra.",
            copy: "Copiar",
            copied: "Copiada",
            none: "Todavía no has creado ninguna.",
            created: "Creada",
            lastUsed: "Usada",
            never: "sin usar aún",
            expires: "caduca",
            revoke: "Revocar",
            confirmRevoke:
              "¿Revocar esta llave? El programa que la esté usando dejará de entrar de inmediato.",
            errorLoad: "No pude cargar las llaves.",
            errorCreate: "No pude crear la llave.",
            errorRevoke: "No pude revocar la llave.",
          }
        : {
            heading: "Access keys for programs",
            subtitle:
              "So a program (Jarvis, a script, another machine) can reach your calendar without your password. Each one is revoked separately.",
            namePh: "What it's for (e.g. “Jarvis”)",
            create: "Create key",
            creating: "Creating…",
            createdTitle: "Copy it now — it won't be shown again",
            createdHint: "Store it where the program will use it. If you lose it, revoke it and make another.",
            copy: "Copy",
            copied: "Copied",
            none: "You haven't created any yet.",
            created: "Created",
            lastUsed: "Used",
            never: "not used yet",
            expires: "expires",
            revoke: "Revoke",
            confirmRevoke: "Revoke this key? Whatever is using it will stop working immediately.",
            errorLoad: "Couldn't load the keys.",
            errorCreate: "Couldn't create the key.",
            errorRevoke: "Couldn't revoke the key.",
          },
    [language],
  )

  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [creating, setCreating] = useState(false)
  const [fresh, setFresh] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const locale = language === "es" ? "es-ES" : "en-GB"
  const fecha = (iso: string) => new Date(iso).toLocaleDateString(locale, { dateStyle: "medium" })

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/api/user/api-keys")
      if (!res.ok) {
        setError(t.errorLoad)
        return
      }
      const data = await res.json()
      setKeys(Array.isArray(data.apiKeys) ? data.apiKeys : [])
      setError(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || creating) return

    setCreating(true)
    setError(null)
    try {
      const res = await fetch("/api/user/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : t.errorCreate)
        return
      }
      setFresh(typeof data.key === "string" ? data.key : null)
      setCopied(false)
      setName("")
      await load()
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(id: string) {
    if (!window.confirm(t.confirmRevoke)) return
    const res = await fetch(`/api/user/api-keys/${id}`, { method: "DELETE" })
    if (!res.ok) {
      setError(t.errorRevoke)
      return
    }
    // Si la que se revoca es la que está en pantalla, se quita: enseñar una
    // llave muerta solo sirve para que alguien la pegue en un `.env`.
    setFresh(null)
    await load()
  }

  return (
    <section className="border-t border-white/10 pt-4">
      <h3 className="flex items-center gap-2 font-medium text-white/90">
        <KeyRound className="h-4 w-4" />
        {t.heading}
      </h3>
      <p className="mt-1 text-xs text-white/45">{t.subtitle}</p>

      <form onSubmit={handleCreate} className="mt-3 flex flex-wrap gap-2">
        <input
          className={`${inputClassName} min-w-0 flex-1`}
          placeholder={t.namePh}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          required
        />
        <button
          type="submit"
          disabled={creating || !name.trim()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm transition hover:bg-white/15 disabled:opacity-50"
        >
          {creating ? t.creating : t.create}
        </button>
      </form>

      {fresh ? (
        <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
          <p className="text-xs font-medium text-amber-100">{t.createdTitle}</p>
          <div className="mt-2 flex flex-wrap items-stretch gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-xs text-white/90">
              {fresh}
            </code>
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm transition hover:bg-white/15"
              onClick={async () => {
                await navigator.clipboard.writeText(fresh)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? t.copied : t.copy}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-amber-100/70">{t.createdHint}</p>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}

      {loading ? (
        <p className="mt-3 text-sm text-white/40">…</p>
      ) : keys.length === 0 ? (
        <p className="mt-3 text-sm text-white/40">{t.none}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {keys.map((k) => (
            <li
              key={k.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm text-white/85">{k.name}</span>
                <span className="block text-[11px] text-white/40">
                  ····{k.last4} · {t.created} {fecha(k.createdAt)} ·{" "}
                  {k.lastUsedAt ? `${t.lastUsed} ${fecha(k.lastUsedAt)}` : t.never}
                  {k.expiresAt ? ` · ${t.expires} ${fecha(k.expiresAt)}` : ""}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void handleRevoke(k.id)}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/15 px-2 py-1 text-xs text-white/70 transition hover:bg-red-500/20 hover:text-red-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t.revoke}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
