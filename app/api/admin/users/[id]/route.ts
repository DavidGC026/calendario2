import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const patchSchema = z.object({
  role: z.enum(["USER", "ADMIN"]),
})

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const admin = await requireAdmin()
  if (!admin) {
    return Response.json({ error: "No autorizado" }, { status: 403 })
  }

  const { id } = await params
  const json = await req.json()
  const parsed = patchSchema.safeParse(json)
  if (!parsed.success) {
    return Response.json({ error: "Payload inválido" }, { status: 400 })
  }

  if (id === admin.id && parsed.data.role === "USER") {
    return Response.json({ error: "No puedes quitarte el rol de administrador a ti mismo" }, { status: 400 })
  }

  const target = await prisma.user.findUnique({ where: { id } })
  if (!target) {
    return Response.json({ error: "Usuario no encontrado" }, { status: 404 })
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role: parsed.data.role },
    select: { id: true, email: true, name: true, role: true },
  })

  return Response.json({ user: updated })
}
