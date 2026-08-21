import bcrypt from "bcryptjs"
import { z } from "zod"

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
  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return Response.json({ error: "Correo o contraseña inválidos" }, { status: 400 })
  }

  const email = normalizeEmail(parsed.data.email)
  const user = await findUserByEmail(email)
  if (!user?.passwordHash) {
    return Response.json({ error: "Credenciales incorrectas" }, { status: 401 })
  }

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash)
  if (!ok) {
    return Response.json({ error: "Credenciales incorrectas" }, { status: 401 })
  }

  const token = await signMobileAccessToken(user.id, user.email)

  return Response.json({
    token,
    expiresIn: 60 * 24 * 60 * 60,
    user: toPublicUser(user),
  })
}
