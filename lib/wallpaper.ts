export const WALLPAPER_STORAGE_PREFIX = "calendar-app-wallpaper:"

export const DEFAULT_WALLPAPER =
  "https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?q=80&w=2070&auto=format&fit=crop"

export const WALLPAPER_PRESETS = [
  {
    id: "dusk",
    url: DEFAULT_WALLPAPER,
    labelEs: "Atardecer",
    labelEn: "Dusk",
  },
  {
    id: "peaks",
    url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=2070&auto=format&fit=crop",
    labelEs: "Cumbres",
    labelEn: "Peaks",
  },
  {
    id: "coast",
    url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2070&auto=format&fit=crop",
    labelEs: "Costa",
    labelEn: "Coast",
  },
  {
    id: "night",
    url: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?q=80&w=2070&auto=format&fit=crop",
    labelEs: "Noche",
    labelEn: "Night",
  },
] as const

export function wallpaperStorageKey(userId: string | undefined) {
  return `${WALLPAPER_STORAGE_PREFIX}${userId ?? "anon"}`
}

export function readStoredWallpaper(userId: string | undefined): string {
  if (typeof window === "undefined") return DEFAULT_WALLPAPER
  try {
    const raw = localStorage.getItem(wallpaperStorageKey(userId))
    if (raw && (raw.startsWith("https://") || raw.startsWith("data:image/"))) return raw
  } catch {
    // localStorage bloqueado
  }
  return DEFAULT_WALLPAPER
}

export function writeStoredWallpaper(userId: string | undefined, value: string) {
  localStorage.setItem(wallpaperStorageKey(userId), value)
}

/** Comprime a JPEG para caber en localStorage (~4 MB de margen). */
export async function compressWallpaperFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("NOT_IMAGE")
  }
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await loadImage(objectUrl)
    const maxSide = 1920
    let width = img.naturalWidth
    let height = img.naturalHeight
    if (width > maxSide || height > maxSide) {
      const scale = Math.min(maxSide / width, maxSide / height)
      width = Math.round(width * scale)
      height = Math.round(height * scale)
    }
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("NO_CANVAS")
    ctx.drawImage(img, 0, 0, width, height)
    let quality = 0.78
    let data = canvas.toDataURL("image/jpeg", quality)
    while (data.length > 3_500_000 && quality > 0.4) {
      quality -= 0.1
      data = canvas.toDataURL("image/jpeg", quality)
    }
    if (data.length > 4_000_000) throw new Error("TOO_LARGE")
    return data
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("LOAD_FAILED"))
    img.src = src
  })
}
