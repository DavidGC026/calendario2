import { sendEventDayReminderEmail, isEmailConfigured } from "@/lib/email"
import { eventDateInAppTimezone, todayInAppTimezone } from "@/lib/event-timezone"
import { toEventDTO } from "@/lib/events"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/** GET con Authorization: Bearer CRON_SECRET — envía recordatorios el día del evento (zona EVENT_TIMEZONE). */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    return Response.json({ error: "CRON_SECRET no configurado" }, { status: 503 })
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 })
  }

  if (!isEmailConfigured()) {
    return Response.json({ ok: true, skipped: true, reason: "RESEND_API_KEY no configurada" })
  }

  const today = todayInAppTimezone()
  const windowStart = new Date(Date.now() - 14 * 86400000)
  const windowEnd = new Date(Date.now() + 400 * 86400000)

  const candidates = await prisma.event.findMany({
    where: {
      emailRemindersEnabled: true,
      reminderEmailSentAt: null,
      startAt: { gte: windowStart, lte: windowEnd },
    },
    orderBy: { startAt: "asc" },
    take: 500,
  })

  let sent = 0
  for (const ev of candidates) {
    if (eventDateInAppTimezone(ev.startAt) !== today) continue

    const dto = await toEventDTO(ev)
    const owner = await prisma.user.findUnique({
      where: { id: ev.userId },
      select: { email: true },
    })
    if (!owner?.email) continue

    const result = await sendEventDayReminderEmail({ to: owner.email, event: dto })
    if (result.ok) {
      await prisma.event.update({
        where: { id: ev.id },
        data: { reminderEmailSentAt: new Date() },
      })
      sent += 1
    } else {
      console.error("[cron/event-reminders] Fallo al enviar recordatorio", ev.id, result)
    }
  }

  return Response.json({ ok: true, today, events: candidates.length, emailsSent: sent })
}
