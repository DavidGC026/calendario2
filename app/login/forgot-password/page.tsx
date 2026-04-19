"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

type Step = "request" | "confirm" | "done"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("request")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [info, setInfo] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setInfo("")
    setLoading(true)
    try {
      await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      setInfo("Si el correo existe, te hemos enviado un código de 6 dígitos. Revisa tu bandeja de entrada y la carpeta de spam.")
      setStep("confirm")
    } catch {
      setError("No se pudo enviar la solicitud. Inténtalo de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setInfo("")

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.")
      return
    }
    if (newPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.")
      return
    }
    if (!/^\d{6}$/.test(code.trim())) {
      setError("El código debe tener 6 dígitos.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
          newPassword,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || "No se pudo restablecer la contraseña.")
        return
      }
      setStep("done")
      setInfo("Contraseña actualizada. Ya puedes iniciar sesión.")
      setTimeout(() => router.push("/login"), 2500)
    } catch {
      setError("No se pudo restablecer la contraseña. Inténtalo de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setError("")
    setInfo("")
    setLoading(true)
    try {
      await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      setInfo("Si han pasado al menos 60 segundos desde el último envío, recibirás un código nuevo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Recuperar contraseña</h1>
          <p className="text-sm text-slate-300">
            {step === "request"
              ? "Te enviaremos un código de 6 dígitos a tu correo para confirmar que eres tú."
              : step === "confirm"
                ? "Introduce el código que te enviamos y elige una nueva contraseña."
                : "Todo listo. Te llevamos al inicio de sesión..."}
          </p>
        </header>

        {step === "request" && (
          <form onSubmit={handleRequest} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-white/20 bg-slate-900 px-3 py-2"
              />
            </div>

            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            {info ? <p className="text-sm text-emerald-400">{info}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-blue-600 py-2 font-medium disabled:opacity-50"
            >
              {loading ? "Enviando..." : "Enviar código"}
            </button>
          </form>
        )}

        {step === "confirm" && (
          <form onSubmit={handleConfirm} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-white/20 bg-slate-900 px-3 py-2"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-300">Código de 6 dígitos</label>
              <input
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full rounded-md border border-white/20 bg-slate-900 px-3 py-2 tracking-[0.5em] text-center text-lg font-mono"
                placeholder="······"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-300">Nueva contraseña</label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-md border border-white/20 bg-slate-900 px-3 py-2"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-300">Repite la contraseña</label>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-md border border-white/20 bg-slate-900 px-3 py-2"
              />
            </div>

            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            {info ? <p className="text-sm text-emerald-400">{info}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-blue-600 py-2 font-medium disabled:opacity-50"
            >
              {loading ? "Confirmando..." : "Cambiar contraseña"}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={handleResend}
                disabled={loading}
                className="text-blue-400 hover:underline disabled:opacity-50"
              >
                Reenviar código
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("request")
                  setCode("")
                  setNewPassword("")
                  setConfirmPassword("")
                  setError("")
                  setInfo("")
                }}
                className="text-slate-300 hover:underline"
              >
                Usar otro correo
              </button>
            </div>
          </form>
        )}

        {step === "done" && (
          <div className="space-y-3">
            <p className="text-sm text-emerald-400">{info}</p>
            <Link
              href="/login"
              className="inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium"
            >
              Ir al inicio de sesión
            </Link>
          </div>
        )}

        <p className="text-sm text-slate-300 pt-2 border-t border-white/10">
          ¿Recordaste la contraseña?{" "}
          <Link href="/login" className="text-blue-400 hover:underline">
            Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </main>
  )
}
