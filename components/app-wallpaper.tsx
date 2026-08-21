"use client"

import Image from "next/image"

import { DEFAULT_WALLPAPER } from "@/lib/wallpaper"

type Props = {
  src?: string
  /** Capa más oscura (login / pantallas sin calendario). */
  dimmer?: boolean
}

export function AppWallpaper({ src = DEFAULT_WALLPAPER, dimmer = false }: Props) {
  const isData = src.startsWith("data:")

  return (
    <div className="pointer-events-none fixed inset-0 -z-0">
      {isData ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL local del usuario
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <Image src={src} alt="" fill className="object-cover" priority unoptimized />
      )}
      <div
        className={
          dimmer
            ? "absolute inset-0 bg-slate-950/78 backdrop-blur-[2px]"
            : "absolute inset-0 bg-gradient-to-b from-slate-950/72 via-slate-950/52 to-slate-950/88"
        }
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_12%_-10%,rgba(225,29,72,0.32),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_95%_90%,rgba(37,99,235,0.28),transparent)]" />
    </div>
  )
}
