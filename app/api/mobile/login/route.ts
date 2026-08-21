import bcrypt from "bcryptjs"
import { z } from "zod"

import { getRequestMeta, logAuthAttempt } from "@/lib/auth-log"
import { signMobileAccessToken } from "@/lib/mobile-jwt"
import { findUserByEmail, normalizeEmail } from "@/lib/google-users"
import { toPublicUser } from "@/lib/user-public"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

/** Login para apps nativas: devuelve JWT Bearer (Authorization en el resto de la API). */
export async function POST(req: Request) {
  const meta = getRequestMeta(req)
  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    await logAuthAttempt({
      channel: "mobile",
      email: typeof json?.email === "string" ? json.email : null,
      ip: meta.ip,
      userAgent: meta.userAgent,
      success: false,
      reason: "validation_failed",
      detail: parsed.error.issues.map((i) => i.message).join("; "),
    })
    return Response.json({ error: "Correo o contraseña inválidos" }, { status: 400 })
  }

  const email = normalizeEmail(parsed.data.email)
  const user = await findUserByEmail(email)
  if (!user?.passwordHash) {
    await logAuthAttempt({
      channel: "mobile",
      email,
      ip: meta.ip,
      userAgent: meta.userAgent,
      success: false,
      reason: user ? "bad_password" : "user_not_found",
    })
    return Response.json({ error: "Credenciales incorrectas" }, { status: 401 })
  }

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash)
  if (!ok) {
    await logAuthAttempt({
      channel: "mobile",
      email,
      ip: meta.ip,
      userAgent: meta.userAgent,
      success: false,
      reason: "bad_password",
    })
    return Response.json({ error: "Credenciales incorrectas" }, { status: 401 })
  }

  await logAuthAttempt({
    channel: "mobile",
    email,
    ip: meta.ip,
    userAgent: meta.userAgent,
    success: true,
    reason: "success",
  })

  const token = await signMobileAccessToken(user.id, user.email)

  return Response.json({
    token,
    expiresIn: 60 * 24 * 60 * 60,
    user: toPublicUser(user),
  })
}
