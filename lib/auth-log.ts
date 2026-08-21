import fs from "fs"
import path from "path"

import { prisma } from "@/lib/prisma"

export type AuthLogChannel = "web" | "mobile"
export type AuthLogReason =
  | "success"
  | "validation_failed"
  | "user_not_found"
  | "bad_password"
  | "csrf_failed"
  | "server_error"

type AuthLogInput = {
  channel: AuthLogChannel
  email?: string | null
  ip?: string | null
  userAgent?: string | null
  success: boolean
  reason: AuthLogReason
  detail?: string | null
}

const LOG_DIR = process.env.AUTH_LOG_DIR ?? "/app/logs"
const LOG_FILE = path.join(LOG_DIR, "auth.log")

function appendFileLog(entry: AuthLogInput) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true })
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      ...entry,
    })
    fs.appendFileSync(LOG_FILE, `${line}\n`, "utf8")
  } catch (err) {
    console.error("[auth-log] no se pudo escribir archivo:", err)
  }
}

export async function logAuthAttempt(entry: AuthLogInput) {
  appendFileLog(entry)

  try {
    await prisma.authLog.create({
      data: {
        channel: entry.channel,
        email: entry.email?.trim().toLowerCase() ?? null,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent?.slice(0, 512) ?? null,
        success: entry.success,
        reason: entry.reason,
        detail: entry.detail?.slice(0, 1000) ?? null,
      },
    })
  } catch (err) {
    console.error("[auth-log] no se pudo guardar en BD:", err)
  }
}

export function getRequestMeta(req?: Request | null) {
  if (!req) {
    return { ip: null as string | null, userAgent: null as string | null }
  }

  const forwarded = req.headers.get("x-forwarded-for")
  const ip = forwarded?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null
  const userAgent = req.headers.get("user-agent")

  return { ip, userAgent }
}
