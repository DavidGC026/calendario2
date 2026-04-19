import { prisma } from "@/lib/prisma"
import { listEventsForUser } from "@/lib/events"
import { buildIcsCalendar } from "@/lib/ical"

/**
 * Feed iCal público (no requiere sesión, autenticado por token opaco en la URL).
 * Sirve para suscribirse desde Apple Calendar / Google Calendar via `webcal://`.
 *
 * Si quieres revocar la suscripción de un dispositivo basta con regenerar
 * el token desde la app y reconfigurar el cliente con la nueva URL.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  if (!token || token.length < 16) {
    return new Response("Not found", { status: 404 })
  }

  const user = await prisma.user.findUnique({
    where: { calendarFeedToken: token },
    select: { id: true, name: true, email: true },
  })
  if (!user) {
    return new Response("Not found", { status: 404 })
  }

  const events = await listEventsForUser(user.id)
  const ics = buildIcsCalendar(events, {
    calendarName: `Calendario de ${user.name ?? user.email}`,
  })

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="calendario.ics"`,
      // Recomendamos a los clientes refrescar cada 15 min.
      "Cache-Control": "private, max-age=900",
    },
  })
}
