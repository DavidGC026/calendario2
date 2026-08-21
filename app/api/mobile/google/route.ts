import { z } from "zod"

import { upsertGoogleUser, verifyGoogleIdToken } from "@/lib/google-users"
import { signMobileAccessToken } from "@/lib/mobile-jwt"
import { toPublicUser } from "@/lib/user-public"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  idToken: z.string().min(20),
})

/** Login nativo con ID token de Google (Credential Manager). */
export async function POST(req: Request) {
  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return Response.json({ error: "Token de Google inválido" }, { status: 400 })
  }

  const verified = await verifyGoogleIdToken(parsed.data.idToken)
  if (!verified.ok) {
    return Response.json({ error: verified.error }, { status: 401 })
  }

  const user = await upsertGoogleUser({ email: verified.email, name: verified.name })
  const token = await signMobileAccessToken(user.id, user.email)

  return Response.json({
    token,
    expiresIn: 60 * 24 * 60 * 60,
    user: toPublicUser(user),
  })
}
