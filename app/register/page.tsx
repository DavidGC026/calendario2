"use client"

import Link from "next/link"
import { useState } from "react"
import { signIn } from "next-auth/react"

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
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Crear cuenta</h1>
        <p className="text-sm text-slate-300">Empieza a gestionar tus eventos con persistencia real.</p>

        <div className="space-y-2">
          <label className="text-sm text-slate-300">Nombre</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-white/20 bg-slate-900 px-3 py-2"
          />
        </div>

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
          <label className="text-sm text-slate-300">Contraseña</label>
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
          className="w-full rounded-md bg-blue-600 py-2 font-medium disabled:opacity-50"
          type="submit"
        >
          {loading ? "Creando cuenta..." : "Registrarme"}
        </button>

        <p className="text-sm text-slate-300">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-blue-400 hover:underline">
            Inicia sesión
          </Link>
        </p>
      </form>
    </main>
  )
}
