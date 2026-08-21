"use client"

import { useState } from "react"
import { KeyRound, Loader2 } from "lucide-react"

import type { OpenAiKeyPublicStatus } from "@/lib/openai-settings"

const SOURCE_LABEL: Record<OpenAiKeyPublicStatus["source"], string> = {
  database: "Guardada en este panel (prioriza al .env)",
  env: "Tomada del entorno (.env / Docker)",
  none: "No hay clave configurada; la IA fallará hasta que pongas una",
}

type Props = {
  initial: OpenAiKeyPublicStatus
}

export function AdminOpenAiKeyPanel({ initial }: Props) {
  const [status, setStatus] = useState(initial)
  const [apiKey, setApiKey] = useState("")
  const [busy, setBusy] = useState<"save" | "reset" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  async function submit(body: { apiKey?: string; resetToEnv?: boolean }, mode: "save" | "reset") {
    setBusy(mode)
    setError(null)
    setOk(null)
    try {
      const res = await fetch("/api/admin/openai-key", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "No se pudo guardar")
        return
      }
      setStatus(data as OpenAiKeyPublicStatus)
      setApiKey("")
      setOk(mode === "reset" ? "Se volvió a la clave del entorno." : "Clave guardada y comprobada con OpenAI.")
    } catch {
      setError("No se pudo contactar con el servidor.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="rounded-2xl border border-white/12 bg-white/[0.05] p-4 backdrop-blur-md sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 ring-1 ring-blue-400/30">
          <KeyRound className="h-5 w-5 text-blue-100" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-white">Clave de OpenAI</h2>
          <p className="mt-1 text-sm text-white/55">
            La usan el chat, el parseo de eventos y la transcripción. No se muestra entera.
          </p>
          <p className="mt-2 text-sm text-white/80">
            {status.configured ? (
              <>
                Activa: <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">{status.hint}</code>
                <span className="mt-1 block text-xs text-white/45">{SOURCE_LABEL[status.source]}</span>
              </>
            ) : (
              SOURCE_LABEL.none
            )}
          </p>
        </div>
      </div>

      <form
        className="mt-4 grid gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          void submit({ apiKey }, "save")
        }}
      >
        <label className="block">
          <span className="text-xs font-medium text-white/55">Nueva clave (sk-…)</span>
          <input
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-…"
            className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5 text-sm text-white outline-none ring-rose-500/40 focus:ring-2"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={busy !== null || apiKey.trim().length < 20}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
          >
            {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Guardar y comprobar
          </button>
          <button
            type="button"
            disabled={busy !== null || status.source !== "database"}
            onClick={() => void submit({ resetToEnv: true }, "reset")}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm transition hover:bg-white/15 disabled:opacity-40"
          >
            {busy === "reset" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Usar la del .env
          </button>
        </div>
      </form>
      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      {ok ? <p className="mt-3 text-sm text-emerald-300">{ok}</p> : null}
    </section>
  )
}
