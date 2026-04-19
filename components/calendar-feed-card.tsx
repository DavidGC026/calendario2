"use client"

import { useEffect, useMemo, useState } from "react"
import { Copy, Download, RefreshCw } from "lucide-react"

type Props = {
  language: "es" | "en"
}

export function CalendarFeedCard({ language }: Props) {
  const t = useMemo(
    () =>
      language === "es"
        ? {
            heading: "Suscribir / exportar calendario",
            subtitle:
              "Mantén tus eventos sincronizados en Apple Calendar, Google Calendar u otros mediante un enlace privado.",
            subscribe: "Enlace de suscripción (webcal)",
            download: "Descargar .ics",
            copy: "Copiar",
            copied: "Copiado",
            rotate: "Generar enlace nuevo",
            rotating: "Generando…",
            rotateHint:
              "Si has compartido el enlace por error, genera uno nuevo y vuelve a configurar tu cliente.",
          }
        : {
            heading: "Subscribe / export calendar",
            subtitle:
              "Keep your events in sync with Apple Calendar, Google Calendar or others via a private URL.",
            subscribe: "Subscription URL (webcal)",
            download: "Download .ics",
            copy: "Copy",
            copied: "Copied",
            rotate: "Regenerate URL",
            rotating: "Regenerating…",
            rotateHint:
              "If you shared the URL by mistake, regenerate it and reconfigure your client.",
          },
    [language],
  )

  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [rotating, setRotating] = useState(false)
  const [copied, setCopied] = useState(false)

  async function fetchToken() {
    setLoading(true)
    try {
      const res = await fetch("/api/user/calendar-feed")
      if (!res.ok) return
      const data = await res.json()
      setToken(typeof data.token === "string" ? data.token : null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchToken()
  }, [])

  async function rotate() {
    setRotating(true)
    try {
      const res = await fetch("/api/user/calendar-feed", { method: "POST" })
      if (!res.ok) return
      const data = await res.json()
      setToken(typeof data.token === "string" ? data.token : null)
    } finally {
      setRotating(false)
    }
  }

  const httpsUrl = token && typeof window !== "undefined" ? `${window.location.origin}/api/calendar/${token}` : ""
  const webcalUrl = httpsUrl ? httpsUrl.replace(/^https?:/, "webcal:") : ""

  return (
    <section className="border-t border-white/10 pt-4">
      <h3 className="font-medium text-white/90">{t.heading}</h3>
      <p className="mt-1 text-xs text-white/45">{t.subtitle}</p>

      {loading ? (
        <p className="mt-3 text-sm text-white/40">…</p>
      ) : (
        <div className="mt-3 space-y-3">
          <div>
            <label className="text-xs text-white/55">{t.subscribe}</label>
            <div className="mt-1 flex flex-wrap items-stretch gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs text-white/85">
                {webcalUrl}
              </code>
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm transition hover:bg-white/15"
                onClick={async () => {
                  if (!webcalUrl) return
                  await navigator.clipboard.writeText(webcalUrl)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? t.copied : t.copy}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={httpsUrl}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm transition hover:bg-white/15"
              download
            >
              <Download className="h-3.5 w-3.5" />
              {t.download}
            </a>
            <button
              type="button"
              onClick={() => void rotate()}
              disabled={rotating}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm transition hover:bg-white/15 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${rotating ? "animate-spin" : ""}`} />
              {rotating ? t.rotating : t.rotate}
            </button>
          </div>
          <p className="text-[11px] text-white/40">{t.rotateHint}</p>
        </div>
      )}
    </section>
  )
}
