import { prisma } from "@/lib/prisma"

export type AdminNoteDTO = {
  id: string
  title: string
  body: string
  createdAt: string
  updatedAt: string
  author: { id: string; email: string; name: string | null }
}

export async function listAdminNotes(): Promise<AdminNoteDTO[]> {
  const rows = await prisma.adminNote.findMany({
    orderBy: { updatedAt: "desc" },
    include: { author: { select: { id: true, email: true, name: true } } },
  })
  return rows.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
    author: n.author,
  }))
}
