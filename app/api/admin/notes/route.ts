import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import { listAdminNotes } from "@/lib/admin-notes"
import { prisma } from "@/lib/prisma"

const createSchema = z.object({
  title: z.string().trim().min(1, "Título requerido").max(200),
  body: z.string().max(100_000),
})

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) {
    return Response.json({ error: "No autorizado" }, { status: 403 })
  }
  const notes = await listAdminNotes()
  return Response.json({ notes })
}

export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return Response.json({ error: "No autorizado" }, { status: 403 })
  }

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }

  const parsed = createSchema.safeParse(json)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const note = await prisma.adminNote.create({
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      authorId: admin.id,
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
}
