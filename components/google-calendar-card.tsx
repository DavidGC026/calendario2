"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Calendar, RefreshCw, Unlink } from "lucide-react"

type Link = {
  googleEmail: string
  calendarId: string
  syncEnabled: boolean
  lastSyncAt: string | null
  lastError: string | null
  createdAt: string
}

type Props = {
  language: "es" | "en"
}

/**
 * Conectar el calendario con Google, y ver si de verdad está sincronizando.
 *
 * Lo segundo importa tanto como lo primero: una sincronización rota no se nota
 * —el calendario sigue ahí, con sus eventos— hasta que falta una cita. Por eso
 * la tarjeta enseña siempre la última vez que funcionó y el último fallo, en vez
 * de un «conectado» que puede llevar tres semanas mintiendo.
 */
export function GoogleCalendarCard({ language }: Props) {
  const t = useMemo(
    () =>
      language === "es"
        ? {
            heading: "Google Calendar",
            subtitle:
              "Sincroniza en los dos sentidos: lo que apuntes aquí aparece en Google y lo de Google aparece aquí.",
            connect: "Conectar con Google",
            notConfigured: "El servidor no tiene configurado Google (faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET).",
            connectedAs: "Conectado como",
            lastSync: "Última sincronización",
            never: "todavía ninguna",
            syncNow: "Sincronizar ahora",
            syncing: "Sincronizando…",
            disconnect: "Desconectar",
            confirmDisconnect:
              "¿Desconectar Google Calendar? Los eventos que ya se bajaron se quedan aquí, pero dejan de sincronizarse.",
            paused: "Sincronización detenida: Google retiró el permiso. Vuelve a conectar.",
            hint: "Se sincroniza sola cada pocos minutos. Los eventos repetidos de Google se ven aquí, pero no se pueden editar desde este lado.",
            resultado: (r: Resultado) =>
              `Subidos ${r.pushed}, bajados ${r.pulled}, borrados aquí ${r.deletedHere}, borrados en Google ${r.deletedThere}` +
              (r.skipped ? `, omitidos ${r.skipped} (cruzan la medianoche)` : ""),
            justConnected: "Cuenta de Google conectada.",
            justDenied: "No diste permiso, así que no se conectó nada.",
            justExpired: "La conexión tardó demasiado; inténtalo otra vez.",
            justNoRefresh: "Google no dio permiso permanente. Quita el acceso desde tu cuenta de Google y vuelve a conectar.",
            justError: "No se pudo conectar con Google.",
          }
        : {
            heading: "Google Calendar",
            subtitle: "Two-way sync: what you add here shows up in Google, and the other way around.",
            connect: "Connect with Google",
            notConfigured: "Google isn't configured on the server (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET missing).",
            connectedAs: "Connected as",
            lastSync: "Last sync",
            never: "none yet",
            syncNow: "Sync now",
            syncing: "Syncing…",
            disconnect: "Disconnect",
            confirmDisconnect:
              "Disconnect Google Calendar? Events already pulled stay here, but they stop syncing.",
            paused: "Sync stopped: Google withdrew permission. Please reconnect.",
            hint: "It syncs by itself every few minutes. Google's recurring events appear here but can't be edited from this side.",
            resultado: (r: Resultado) =>
              `Pushed ${r.pushed}, pulled ${r.pulled}, deleted here ${r.deletedHere}, deleted in Google ${r.deletedThere}` +
              (r.skipped ? `, skipped ${r.skipped} (cross midnight)` : ""),
            justConnected: "Google account connected.",
            justDenied: "You didn't grant permission, so nothing was connected.",
            justExpired: "The connection took too long; try again.",
            justNoRefresh: "Google didn't grant lasting permission. Remove access in your Google account and reconnect.",
            justError: "Couldn't connect to Google.",
          },
    [language],
  )

  const [configured, setConfigured] = useState(true)
  const [link, setLink] = useState<Link | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/google-calendar")
      if (!res.ok) return
      const data = await res.json()
      setConfigured(Boolean(data.configured))
      setLink(data.link ?? null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // La vuelta de Google trae el resultado en la URL. Se lee, se cuenta y se
  // limpia, para que recargar la página no repita el mensaje para siempre.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const estado = params.get("google")
    if (!estado) return

    const mensajes: Record<string, string> = {
      conectado: t.justConnected,
      denegado: t.justDenied,
      expirado: t.justExpired,
      "sin-permiso-permanente": t.justNoRefresh,
      error: t.justError,
    }
    if (estado === "conectado") setMessage(mensajes[estado])
    else setError(mensajes[estado] ?? t.justError)

    params.delete("google")
    const rest = params.toString()
    window.history.replaceState({}, "", window.location.pathname + (rest ? `?${rest}` : ""))
  }, [t])

  async function syncNow() {
    setSyncing(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch("/api/google-calendar/sync", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setError(typeof data.error === "string" ? data.error : t.justError)
      } else {
        setMessage(t.resultado(data.result as Resultado))
      }
      await load()
    } finally {
      setSyncing(false)
    }
  }

  async function disconnect() {
    if (!window.confirm(t.confirmDisconnect)) return
    await fetch("/api/google-calendar", { method: "DELETE" })
    setMessage(null)
    setError(null)
    await load()
  }

  const fecha = (iso: string) =>
    new Date(iso).toLocaleString(language === "es" ? "es-ES" : "en-GB", { dateStyle: "medium", timeStyle: "short" })

  return (
    <section className="border-t border-white/10 pt-4">
      <h3 className="flex items-center gap-2 font-medium text-white/90">
        <Calendar className="h-4 w-4" />
        {t.heading}
      </h3>
      <p className="mt-1 text-xs text-white/45">{t.subtitle}</p>

      {!configured ? (
        <p className="mt-3 text-sm text-white/40">{t.notConfigured}</p>
      ) : loading ? (
        <p className="mt-3 text-sm text-white/40">…</p>
      ) : !link ? (
        <a
          href="/api/google-calendar/connect"
          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm transition hover:bg-white/15"
        >
          <Calendar className="h-4 w-4" />
          {t.connect}
        </a>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-sm text-white/85">
              {t.connectedAs} <span className="text-white">{link.googleEmail || link.calendarId}</span>
            </p>
            <p className="text-[11px] text-white/40">
              {t.lastSync}: {link.lastSyncAt ? fecha(link.lastSyncAt) : t.never}
            </p>
          </div>

          {!link.syncEnabled ? (
            <p className="flex items-start gap-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t.paused}
            </p>
          ) : null}

          {link.lastError ? <p className="text-xs text-red-300">{link.lastError}</p> : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void syncNow()}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm transition hover:bg-white/15 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? t.syncing : t.syncNow}
            </button>
            <a
              href="/api/google-calendar/connect"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm transition hover:bg-white/15"
            >
              <Calendar className="h-3.5 w-3.5" />
              {t.connect}
            </a>
            <button
              type="button"
              onClick={() => void disconnect()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-sm text-white/70 transition hover:bg-red-500/20 hover:text-red-100"
            >
              <Unlink className="h-3.5 w-3.5" />
              {t.disconnect}
            </button>
          </div>

          <p className="text-[11px] text-white/40">{t.hint}</p>
        </div>
      )}

      {message ? <p className="mt-2 text-xs text-emerald-300">{message}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </section>
  )
}

type Resultado = {
  pushed: number
  pulled: number
  deletedHere: number
  deletedThere: number
  skipped: number
}
