"use client"

import Link from "next/link"
import { useState } from "react"
import { signIn } from "next-auth/react"

import { GoogleAuthSection } from "@/components/google-auth-section"
import { AppWallpaper } from "@/components/app-wallpaper"
import { DvgMark } from "@/components/dvg-mark"

export default function RegisterPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    })

    const data = await response.json()
    if (!response.ok) {
      setLoading(false)
      setError(data.error ?? "No se pudo crear la cuenta")
      return
    }

    const login = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (login?.error) {
      setError("Cuenta creada, pero no se pudo iniciar sesión automáticamente")
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
            <h1 className="text-2xl font-semibold">Crear cuenta</h1>
          </div>
        </div>
        <p className="text-sm text-white">Empieza a gestionar tus eventos con persistencia real.</p>

        <div className="space-y-2">
          <label htmlFor="register-name" className="text-sm text-white">Nombre</label>
          <input
            id="register-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-white/20 bg-black/25 px-3 py-2 outline-none backdrop-blur-md transition focus:border-dvg-gold-light/60 focus:ring-2 focus:ring-dvg-gold/25"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="register-email" className="text-sm text-white">Email</label>
          <input
            id="register-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-white/20 bg-black/25 px-3 py-2 outline-none backdrop-blur-md transition focus:border-dvg-gold-light/60 focus:ring-2 focus:ring-dvg-gold/25"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="register-password" className="text-sm text-white">Contraseña</label>
          <input
            id="register-password"
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
          {loading ? "Creando cuenta..." : "Registrarme"}
        </button>

        <GoogleAuthSection label="Registrarme con Google" />

        <p className="text-sm text-white">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-dvg-gold-light underline decoration-dvg-gold-light/50 underline-offset-4">
            Inicia sesión
          </Link>
        </p>
      </form>
      </div>
    </main>
  )
}
