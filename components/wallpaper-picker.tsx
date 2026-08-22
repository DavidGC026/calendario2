"use client"

import { useRef, useState } from "react"
import { ImagePlus, RotateCcw } from "lucide-react"

import {
  DEFAULT_WALLPAPER,
  WALLPAPER_PRESETS,
  compressWallpaperFile,
  writeStoredWallpaper,
} from "@/lib/wallpaper"

type Props = {
  userId: string | undefined
  value: string
  onChange: (src: string) => void
  language: "es" | "en"
  inputClassName: string
}

export function WallpaperPicker({ userId, value, onChange, language, inputClassName }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  function apply(src: string) {
    setError("")
    writeStoredWallpaper(userId, src)
    onChange(src)
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError("")
    try {
      const data = await compressWallpaperFile(file)
      apply(data)
    } catch {
      setError(
        language === "es"
          ? "No pude usar esa imagen. Prueba con un JPG o PNG más ligero."
          : "Could not use that image. Try a smaller JPG or PNG.",
      )
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div>
      <h3 className="font-medium text-white/90">
        {language === "es" ? "Fondo" : "Background"}
      </h3>
      <p className="mt-1 text-xs text-white/55">
        {language === "es"
          ? "Elige una escena o sube una foto. Se guarda en este dispositivo."
          : "Pick a scene or upload a photo. It stays on this device."}
      </p>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {WALLPAPER_PRESETS.map((preset) => {
          const selected = value === preset.url
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => apply(preset.url)}
              className={`overflow-hidden rounded-xl ring-2 transition ${
                selected ? "ring-dvg-gold-light" : "ring-white/15 hover:ring-white/35"
              }`}
              aria-pressed={selected}
              title={language === "es" ? preset.labelEs : preset.labelEn}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preset.url} alt="" className="aspect-[4/5] w-full object-cover" />
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className={`${inputClassName} !w-auto inline-flex min-h-11 items-center gap-2 px-3 py-2 text-sm disabled:opacity-50`}
        >
          <ImagePlus className="h-4 w-4" />
          {busy
            ? language === "es"
              ? "Procesando…"
              : "Processing…"
            : language === "es"
              ? "Subir foto"
              : "Upload photo"}
        </button>
        <button
          type="button"
          onClick={() => apply(DEFAULT_WALLPAPER)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm transition hover:bg-white/15"
        >
          <RotateCcw className="h-4 w-4" />
          {language === "es" ? "Por defecto" : "Default"}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
    </div>
  )
}
