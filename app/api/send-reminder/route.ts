import { getCurrentUserId } from "@/lib/auth"
import { sendEventDayReminderEmail } from "@/lib/email"
import type { EventDTO } from "@/lib/events"

/** Envío manual de recordatorio (misma plantilla que el cron). */
export async function POST(req: Request) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return Response.json({ error: "No autenticado" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const { to, event } = body ?? {}
  if (!to || typeof to !== "string" || !event || typeof event !== "object") {
    return Response.json({ error: "Faltan campos requeridos" }, { status: 400 })
  }

  const e = event as Record<string, unknown>
  const dto = {
    id: String(e.id ?? ""),
    title: String(e.title ?? ""),
    description: typeof e.description === "string" ? e.description : "",
    location: typeof e.location === "string" ? e.location : "",
    eventDate: String(e.eventDate ?? ""),
    startTime: String(e.startTime ?? ""),
    endTime: String(e.endTime ?? ""),
    color: typeof e.color === "string" ? e.color : "bg-blue-500",
    attendees: Array.isArray(e.attendees) ? (e.attendees as string[]) : [],
    participantUserIds: Array.isArray(e.participantUserIds) ? (e.participantUserIds as string[]) : [],
    participants: [],
    organizer: typeof e.organizer === "string" ? e.organizer : "You",
    day: typeof e.day === "number" ? e.day : 0,
  } satisfies EventDTO

  const result = await sendEventDayReminderEmail({ to, event: dto })
  if (!result.ok) {
    return Response.json({ error: result.error ?? "No se pudo enviar" }, { status: 502 })
  }

  return Response.json({ success: true })
}
