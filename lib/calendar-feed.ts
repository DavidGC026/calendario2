import { randomBytes } from "node:crypto"

import { prisma } from "@/lib/prisma"

function generateToken(): string {
  // 32 bytes URL-safe ⇒ 43 caracteres aprox.; suficiente entropía.
  return randomBytes(32).toString("base64url")
}

/**
 * Devuelve el token actual del usuario; lo crea si todavía no tenía.
 * Idempotente: dos llamadas seguidas devuelven el mismo token.
 */
export async function getOrCreateCalendarFeedToken(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { calendarFeedToken: true } })
  if (user?.calendarFeedToken) return user.calendarFeedToken

  const token = generateToken()
  await prisma.user.update({ where: { id: userId }, data: { calendarFeedToken: token } })
  return token
}

/** Genera un token nuevo (invalida el anterior). Útil tras compartir por error. */
export async function rotateCalendarFeedToken(userId: string): Promise<string> {
  const token = generateToken()
  await prisma.user.update({ where: { id: userId }, data: { calendarFeedToken: token } })
  return token
}
