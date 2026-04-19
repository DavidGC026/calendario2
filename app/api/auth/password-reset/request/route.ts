import { z } from "zod"

import { requestPasswordReset } from "@/lib/password-reset"
import { clientIp, rateLimit } from "@/lib/rate-limit"

const schema = z.object({
  email: z.string().email(),
})

export async function POST(req: Request) {
  // Antifraude: limitamos por IP (5/min) y por correo (3/10 min) para no
  // permitir spam de correos a un usuario aunque cambien la IP.
  const ip = clientIp(req)
  const rlIp = rateLimit(`reset-ip:${ip}`, 5, 60_000)
  if (!rlIp.allowed) {
    return Response.json({ ok: true })
  }

  try {
    const json = await req.json()
    const parsed = schema.safeParse(json)
    if (!parsed.success) {
      // No revelamos detalles para no diferenciar correos válidos de inválidos.
      return Response.json({ ok: true })
    }

    const rlEmail = rateLimit(`reset-email:${parsed.data.email.toLowerCase()}`, 3, 10 * 60_000)
    if (!rlEmail.allowed) {
      return Response.json({ ok: true })
    }

    await requestPasswordReset(parsed.data.email)
  } catch (e) {
    console.error("[password-reset/request]", e)
  }

  return Response.json({ ok: true })
}
