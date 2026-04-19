import { z } from "zod"

import { confirmPasswordReset } from "@/lib/password-reset"

const schema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/u, "El código debe ser de 6 dígitos"),
  newPassword: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
})

export async function POST(req: Request) {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return Response.json({ error: "Cuerpo inválido" }, { status: 400 })
  }

  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    return Response.json(
      { error: "Datos inválidos", issues: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const result = await confirmPasswordReset(parsed.data)
  if (!result.ok) {
    const status = result.reason === "weak_password" ? 400 : 400
    const message =
      result.reason === "expired"
        ? "El código ha caducado. Solicita uno nuevo."
        : result.reason === "too_many_attempts"
          ? "Demasiados intentos fallidos. Solicita un código nuevo."
          : result.reason === "weak_password"
            ? "La contraseña debe tener al menos 6 caracteres."
            : "Código incorrecto."
    return Response.json({ error: message, reason: result.reason }, { status })
  }

  return Response.json({ ok: true })
}
