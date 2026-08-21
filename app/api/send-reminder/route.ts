import { getCurrentUser } from "@/lib/auth"
import { sendEventDayReminderEmail } from "@/lib/email"
import { prisma } from "@/lib/prisma"
import { toEventDTO } from "@/lib/events"

/** Envío manual de recordatorio al dueño del evento (misma plantilla que el cron). */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ error: "No autenticado" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const eventId = body && typeof body.eventId === "string" ? body.eventId : ""
  if (!eventId) {
    return Response.json({ error: "Falta eventId" }, { status: 400 })
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, userId: user.id },
  })
  if (!event) {
    return Response.json({ error: "Evento no encontrado" }, { status: 404 })
  }

  const dto = await toEventDTO(event)
  const result = await sendEventDayReminderEmail({ to: user.email, event: dto })
  if (!result.ok) {
    return Response.json({ error: result.error ?? "No se pudo enviar" }, { status: 502 })
  }

  return Response.json({ success: true })
}
