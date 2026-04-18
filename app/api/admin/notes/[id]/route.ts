import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().max(100_000).optional(),
})

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, ctx: Ctx) {
  const admin = await requireAdmin()
  if (!admin) {
    return Response.json({ error: "No autorizado" }, { status: 403 })
  }

  const { id } = await ctx.params

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(json)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const data = parsed.data
  if (data.title === undefined && data.body === undefined) {
    return Response.json({ error: "Nada que actualizar" }, { status: 400 })
  }

  try {
    const note = await prisma.adminNote.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.body !== undefined ? { body: data.body } : {}),
      },
      include: { author: { select: { id: true, email: true, name: true } } },
    })
    return Response.json({
      note: {
        id: note.id,
        title: note.title,
        body: note.body,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
        author: note.author,
      },
    })
  } catch {
    return Response.json({ error: "Nota no encontrada" }, { status: 404 })
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const admin = await requireAdmin()
  if (!admin) {
    return Response.json({ error: "No autorizado" }, { status: 403 })
  }

  const { id } = await ctx.params

  try {
    await prisma.adminNote.delete({ where: { id } })
    return Response.json({ ok: true })
  } catch {
    return Response.json({ error: "Nota no encontrada" }, { status: 404 })
  }
}
