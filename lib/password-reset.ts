import bcrypt from "bcryptjs"
import { randomInt } from "node:crypto"

import { prisma } from "@/lib/prisma"
import { sendPasswordResetCodeEmail } from "@/lib/email"

/** Tiempo de validez del código que se envía por email. */
export const PASSWORD_RESET_TTL_MINUTES = 15

/** Intentos máximos por token antes de invalidarlo (anti fuerza bruta). */
export const PASSWORD_RESET_MAX_ATTEMPTS = 5

/**
 * Mínimo de segundos entre dos solicitudes consecutivas de código para el
 * mismo usuario. Evita que se le bombardeen correos a un usuario y que se
 * use la app como spammer.
 */
export const PASSWORD_RESET_RESEND_COOLDOWN_SECONDS = 60

/** Genera un código numérico de 6 dígitos (con ceros a la izquierda). */
function generateNumericCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0")
}

/**
 * Solicita un código de recuperación. SIEMPRE devuelve `{ ok: true }` aunque
 * el correo no exista, para no filtrar qué cuentas están registradas.
 *
 * - Invalida tokens anteriores no consumidos del mismo usuario.
 * - Aplica un cooldown corto (`PASSWORD_RESET_RESEND_COOLDOWN_SECONDS`) entre
 *   solicitudes para evitar abuso.
 * - Envía el código por Resend; si Resend no está configurado se loguea una
 *   advertencia pero la respuesta al cliente sigue siendo genérica.
 */
export async function requestPasswordReset(rawEmail: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase()
  if (!email) return

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return
  }

  const recent = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, consumedAt: null },
    orderBy: { createdAt: "desc" },
  })
  if (recent) {
    const elapsedMs = Date.now() - recent.createdAt.getTime()
    if (elapsedMs < PASSWORD_RESET_RESEND_COOLDOWN_SECONDS * 1000) {
      return
    }
  }

  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, consumedAt: null },
    data: { consumedAt: new Date() },
  })

  const code = generateNumericCode()
  const codeHash = await bcrypt.hash(code, 10)
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60_000)

  await prisma.passwordResetToken.create({
    data: { userId: user.id, codeHash, expiresAt },
  })

  const result = await sendPasswordResetCodeEmail({
    to: user.email,
    code,
    expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
  })
  if (!result.ok) {
    console.error("[password-reset] no se pudo enviar el correo:", result.error)
  }
}

export type ConfirmResetResult =
  | { ok: true }
  | {
      ok: false
      reason: "invalid_code" | "expired" | "too_many_attempts" | "weak_password"
    }

/**
 * Verifica el código y, si es válido, actualiza la contraseña del usuario y
 * marca el token como consumido. También invalida el resto de tokens vivos
 * para que no queden códigos antiguos utilizables.
 */
export async function confirmPasswordReset(params: {
  email: string
  code: string
  newPassword: string
}): Promise<ConfirmResetResult> {
  const email = params.email.trim().toLowerCase()
  const code = params.code.trim()
  const newPassword = params.newPassword

  if (newPassword.length < 6) {
    return { ok: false, reason: "weak_password" }
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return { ok: false, reason: "invalid_code" }
  }

  const token = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, consumedAt: null },
    orderBy: { createdAt: "desc" },
  })
  if (!token) {
    return { ok: false, reason: "invalid_code" }
  }

  if (token.attempts >= PASSWORD_RESET_MAX_ATTEMPTS) {
    await prisma.passwordResetToken.update({
      where: { id: token.id },
      data: { consumedAt: new Date() },
    })
    return { ok: false, reason: "too_many_attempts" }
  }

  if (token.expiresAt.getTime() < Date.now()) {
    await prisma.passwordResetToken.update({
      where: { id: token.id },
      data: { consumedAt: new Date() },
    })
    return { ok: false, reason: "expired" }
  }

  const matches = await bcrypt.compare(code, token.codeHash)
  if (!matches) {
    await prisma.passwordResetToken.update({
      where: { id: token.id },
      data: { attempts: { increment: 1 } },
    })
    return { ok: false, reason: "invalid_code" }
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
  ])

  return { ok: true }
}
