"use client"

import { useEffect, useState } from "react"

import { GoogleSignInButton } from "@/components/google-sign-in-button"

export function GoogleAuthSection({ label }: { label: string }) {
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch("/api/auth/providers")
      .then((res) => res.json())
      .then((providers: { google?: unknown }) => {
        if (!cancelled) setAvailable(Boolean(providers?.google))
      })
      .catch(() => {
        if (!cancelled) setAvailable(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!available) return null

  return (
    <div className="space-y-3">
      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-slate-950/80 px-2 text-slate-400">o</span>
        </div>
      </div>
      <GoogleSignInButton label={label} />
    </div>
  )
}
