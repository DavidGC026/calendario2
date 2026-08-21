import { prisma } from "@/lib/prisma"

export type AdminUserRow = {
  id: string
  email: string
  name: string | null
  role: "USER" | "ADMIN"
  aiEnabled: boolean
  hasPassword: boolean
  createdAt: string
  eventCount: number
}

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const rows = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      aiEnabled: true,
      passwordHash: true,
      createdAt: true,
      _count: { select: { events: true } },
    },
  })

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    aiEnabled: row.aiEnabled,
    hasPassword: Boolean(row.passwordHash),
    createdAt: row.createdAt.toISOString(),
    eventCount: row._count.events,
  }))
}
