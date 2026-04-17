import bcrypt from "bcryptjs"
import { z } from "zod"

import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
})

export async function PATCH(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ error: "No autenticado" }, { status: 401 })
  }

  const json = await req.json()
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 })
  }

  const { currentPassword, newPassword } = parsed.data
  const ok = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!ok) {
    return Response.json({ error: "Contraseña actual incorrecta" }, { status: 403 })
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  })

  return Response.json({ success: true })
}
