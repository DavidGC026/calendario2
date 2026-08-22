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
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover saturate-[0.68] sepia-[0.18] contrast-[1.04]"
        />
      ) : (
        <Image
          src={src}
          alt=""
          fill
          className="object-cover saturate-[0.68] sepia-[0.18] contrast-[1.04]"
          priority
          unoptimized
        />
      )}
      <div
        className={
          dimmer
            ? "absolute inset-0 bg-neutral-950/[0.72] backdrop-blur-[2px]"
            : "absolute inset-0 bg-gradient-to-b from-neutral-950/[0.68] via-neutral-950/[0.48] to-neutral-950/[0.86]"
        }
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_12%_-10%,rgba(166,27,36,0.30),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_95%_90%,rgba(166,106,24,0.24),transparent)]" />
    </div>
  )
}
