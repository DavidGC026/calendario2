"use client"

import Link from "next/link"
import { useState } from "react"
import { signIn } from "next-auth/react"

import { GoogleAuthSection } from "@/components/google-auth-section"
import { AppWallpaper } from "@/components/app-wallpaper"
import { DvgMark } from "@/components/dvg-mark"

function describeSignInResult(result: { error?: string | null; url?: string | null; ok?: boolean }) {
  if (result.url?.includes("csrf=true")) {
    return "Error de sesión (CSRF). Recarga la página con Ctrl+F5 e inténtalo otra vez."
  }
  if (result.error === "CredentialsSignin" || result.url?.includes("error=CredentialsSignin")) {
    return "Credenciales inválidas"
  }
  if (result.error) {
    return `Error de autenticación: ${result.error}`
  }
  return null
}

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const result = await signIn("credentials", {
      email: email.trim(),
      password,
      redirect: false,
    })

    void fetch("/api/auth/login-attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        ok: result?.ok ?? false,
        error: result?.error ?? null,
        url: result?.url ?? null,
      }),
    })

    setLoading(false)

    if (!result?.ok) {
      setError(describeSignInResult(result ?? {}) ?? "No se pudo iniciar sesión")
      return
    }

    window.location.href = "/"
  }

  return (
    <main className="relative min-h-[100dvh] overflow-x-hidden overflow-y-auto text-slate-100">
      <AppWallpaper dimmer />
      <div className="relative flex min-h-[100dvh] items-center justify-center px-4 py-6">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 rounded-2xl border border-dvg-gold-light/25 bg-neutral-950/80 p-6 text-white shadow-2xl backdrop-blur-xl">
        <div className="mb-1 flex items-center gap-3">
          <DvgMark className="h-11 w-11" decorative={false} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-dvg-gold-light">DVG Calendar</p>
            <h1 className="text-2xl font-semibold">Iniciar sesión</h1>
          </div>
        </div>
        <p className="text-sm text-white">Accede para gestionar tu calendario.</p>

        <div className="space-y-2">
          <label htmlFor="login-email" className="text-sm text-white">Email</label>
          <input
            id="login-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-white/25 bg-neutral-950/[0.48] px-3 py-2 text-white outline-none backdrop-blur-md transition focus:border-dvg-gold-light/60 focus:ring-2 focus:ring-dvg-gold/25"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="login-password" className="text-sm text-white">Contraseña</label>
            <Link
              href="/login/forgot-password"
              className="text-xs font-medium text-dvg-gold-light underline decoration-dvg-gold-light/50 underline-offset-4"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <input
            id="login-password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-white/20 bg-black/25 px-3 py-2 outline-none backdrop-blur-md transition focus:border-dvg-gold-light/60 focus:ring-2 focus:ring-dvg-gold/25"
          />
        </div>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <button
          disabled={loading}
          className="w-full rounded-md bg-gradient-to-r from-dvg-red to-dvg-gold py-2 font-medium shadow-lg transition hover:brightness-110 disabled:opacity-50"
          type="submit"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <GoogleAuthSection label="Continuar con Google" />

        <p className="text-sm text-white">
          ¿No tienes cuenta?{" "}
          <Link href="/register" className="font-medium text-dvg-gold-light underline decoration-dvg-gold-light/50 underline-offset-4">
            Regístrate
          </Link>
        </p>
      </form>
      </div>
    </main>
  )
}
