import { createHash } from "node:crypto"
import { stat, readFile } from "node:fs/promises"
import path from "node:path"

import { NextResponse } from "next/server"

const APK_PATH = path.join(process.cwd(), "public", "downloads", "dvgcalendar.apk")

let cache:
  | {
      mtimeMs: number
      sizeBytes: number
      sha256: string
      updatedAt: string
    }
  | null = null

/**
 * Devuelve metadatos del APK descargable (tamaño, sha256, fecha de
 * publicación). El sha256 se cachea hasta que cambia el mtime del fichero.
 */
export async function GET() {
  try {
    const info = await stat(APK_PATH)
    if (!cache || cache.mtimeMs !== info.mtimeMs) {
      const buf = await readFile(APK_PATH)
      const sha256 = createHash("sha256").update(buf).digest("hex")
      cache = {
        mtimeMs: info.mtimeMs,
        sizeBytes: info.size,
        sha256,
        updatedAt: new Date(info.mtimeMs).toISOString(),
      }
    }
    return NextResponse.json({
      available: true,
      sizeBytes: cache.sizeBytes,
      sizeMB: Math.round((cache.sizeBytes / (1024 * 1024)) * 10) / 10,
      sha256: cache.sha256,
      updatedAt: cache.updatedAt,
      url: "/downloads/dvgcalendar.apk",
    })
  } catch {
    return NextResponse.json({ available: false }, { status: 404 })
  }
}
