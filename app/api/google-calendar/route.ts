import { getCurrentUserId } from "@/lib/auth"
import { googleConfigured } from "@/lib/google-calendar-api"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/** Cómo va la conexión con Google: para pintar Ajustes y para contar los fallos. */
export async function GET() {
  const userId = await getCurrentUserId()
  if (!userId) return Response.json({ error: "No autenticado" }, { status: 401 })

  const link = await prisma.googleCalendarLink.findUnique({ where: { userId } })

  return Response.json({
    configured: googleConfigured(),
    // Ni el refresh token ni el de acceso salen de aquí, ni siquiera cifrados.
    link: link
      ? {
          googleEmail: link.googleEmail,
          calendarId: link.calendarId,
          syncEnabled: link.syncEnabled,
          lastSyncAt: link.lastSyncAt?.toISOString() ?? null,
          lastError: link.lastError,
          createdAt: link.createdAt.toISOString(),
        }
      : null,
  })
}

/**
 * Desconecta la cuenta.
 *
 * Los eventos que ya bajaron se quedan: son suyos y borrarlos de golpe sería
 * una sorpresa desagradable. Lo que se va es el permiso y el rastro que ata cada
 * evento con su gemelo de Google, para que reconectar no intente casarlos a
 * ciegas.
 */
export async function DELETE() {
  const userId = await getCurrentUserId({ allowApiKey: false })
  if (!userId) return Response.json({ error: "No autenticado" }, { status: 401 })

  await prisma.$transaction([
    prisma.googleCalendarLink.deleteMany({ where: { userId } }),
    prisma.googleDeletion.deleteMany({ where: { userId } }),
    prisma.event.updateMany({
      where: { userId },
      data: { googleEventId: null, googleSyncedAt: null, googleRecurring: false },
    }),
  ])

  return Response.json({ success: true })
}
