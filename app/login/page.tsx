"use client"

import Link from "next/link"
import { useState } from "react"
import { signIn } from "next-auth/react"

import { GoogleAuthSection } from "@/components/google-auth-section"
import { AppWallpaper } from "@/components/app-wallpaper"

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
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError("Credenciales inválidas")
      return
    }

    window.location.href = "/"
  }

  return (
    <main className="relative min-h-screen overflow-hidden text-slate-100">
      <AppWallpaper dimmer />
      <div className="relative flex min-h-screen items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl border border-white/20 bg-white/10 p-6 space-y-4 backdrop-blur-xl">
        <h1 className="text-2xl font-semibold">Iniciar sesión</h1>
        <p className="text-sm text-slate-300">Accede para gestionar tu calendario.</p>

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
          <div className="flex items-center justify-between">
            <label className="text-sm text-slate-300">Contraseña</label>
            <Link
              href="/login/forgot-password"
              className="text-xs text-blue-400 hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-white/20 bg-slate-900 px-3 py-2"
          />
        </div>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <button
          disabled={loading}
          className="w-full rounded-md bg-gradient-to-r from-rose-600 to-blue-600 py-2 font-medium disabled:opacity-50"
          type="submit"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <GoogleAuthSection label="Continuar con Google" />

        <p className="text-sm text-slate-300">
          ¿No tienes cuenta?{" "}
          <Link href="/register" className="text-blue-400 hover:underline">
            Regístrate
          </Link>
        </p>
      </form>
      </div>
    </main>
  )
}
