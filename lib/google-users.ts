import { prisma } from "@/lib/prisma"

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function findUserByEmail(email: string) {
  const normalized = normalizeEmail(email)
  return prisma.user.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" } },
  })
}

/**
 * Crea o reutiliza el usuario local al entrar con Google.
 * Si ya existía una cuenta con el mismo correo (p. ej. email+contraseña),
 * se enlaza: mismo id, sin duplicar.
 */
export async function upsertGoogleUser(input: { email: string; name?: string | null }) {
  const email = normalizeEmail(input.email)
  const name = input.name?.trim() || null
  const existing = await findUserByEmail(email)

  if (existing) {
    const data: { email?: string; name?: string | null } = {}
    if (existing.email !== email) data.email = email
    if (!existing.name && name) data.name = name
    if (Object.keys(data).length === 0) return existing
    return prisma.user.update({ where: { id: existing.id }, data })
  }

  return prisma.user.create({
    data: {
      email,
      name,
      passwordHash: null,
      aiEnabled: false,
    },
  })
}

type GoogleTokenInfo = {
  aud?: string
  email?: string
  email_verified?: string | boolean
  name?: string
}

/**
 * Valida un ID token de Google (web o Android Credential Manager) contra
 * `GOOGLE_CLIENT_ID`. No usamos la librería oficial para no añadir dependencia.
 */
export async function verifyGoogleIdToken(idToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  if (!clientId) {
    return { ok: false as const, error: "Google no está configurado" }
  }

  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  )
  if (!res.ok) {
    return { ok: false as const, error: "Token de Google inválido" }
  }

  const payload = (await res.json()) as GoogleTokenInfo
  if (payload.aud !== clientId) {
    return { ok: false as const, error: "Token de Google inválido" }
  }

  const verified = payload.email_verified === true || payload.email_verified === "true"
  const email = typeof payload.email === "string" ? payload.email : ""
  if (!verified || !email) {
    return { ok: false as const, error: "El correo de Google no está verificado" }
  }

  return {
    ok: true as const,
    email,
    name: typeof payload.name === "string" ? payload.name : null,
  }
}
