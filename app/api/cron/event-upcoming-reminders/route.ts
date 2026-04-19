import { sendEventUpcomingReminderEmail, isEmailConfigured } from "@/lib/email"
import { toEventDTO } from "@/lib/events"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * GET con `Authorization: Bearer CRON_SECRET` — envía recordatorios "X minutos
 * antes" para los eventos cuyo usuario configuró `reminderMinutesBefore`.
 *
 * Diseñado para ejecutarse cada ~5 minutos. Usa una ventana de gracia de
 * ±10 minutos alrededor del instante objetivo (`startAt - reminderMinutesBefore`)
 * para tolerar pequeños desfases del cron.
 *
 * Cada evento solo dispara un único correo gracias al campo
 * `reminderUpcomingSentAt`.
 */
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

  const now = Date.now()
  // Eventos cuyo inicio cae en las próximas 25h y aún no avisamos.
  // Filtramos en memoria porque el offset por evento es variable.
  const candidates = await prisma.event.findMany({
    where: {
      reminderUpcomingSentAt: null,
      reminderMinutesBefore: { not: null },
      startAt: {
        gte: new Date(now - 30 * 60_000), // tolera 30 min de retraso
        lte: new Date(now + 25 * 60 * 60_000),
      },
    },
    orderBy: { startAt: "asc" },
    take: 500,
  })

  const TOL_MS = 10 * 60_000

  let sent = 0
  for (const ev of candidates) {
    const minutes = ev.reminderMinutesBefore
    if (!minutes || minutes <= 0) continue

    const targetTs = ev.startAt.getTime() - minutes * 60_000
    // Solo si estamos dentro de la ventana [target-TOL, target+TOL]
    if (now < targetTs - TOL_MS) continue
    // Si ya pasó la hora del evento, descartamos (no tiene sentido recordar)
    if (now > ev.startAt.getTime()) {
      await prisma.event.update({
        where: { id: ev.id },
        data: { reminderUpcomingSentAt: new Date() },
      })
      continue
    }

    const dto = await toEventDTO(ev)
    const owner = await prisma.user.findUnique({
      where: { id: ev.userId },
      select: { email: true },
    })
    if (!owner?.email) continue

    const recipients = new Set<string>([owner.email])
    for (const p of dto.participants) {
      if (p.email) recipients.add(p.email)
    }

    const results = await Promise.all(
      [...recipients].map((to) =>
        sendEventUpcomingReminderEmail({ to, event: dto, minutesBefore: minutes }),
      ),
    )
    if (results.every((r) => r.ok)) {
      await prisma.event.update({
        where: { id: ev.id },
        data: { reminderUpcomingSentAt: new Date() },
      })
      sent += results.length
    } else {
      console.error("[cron/event-upcoming-reminders] Fallo al enviar", ev.id, results)
    }
  }

  return Response.json({
    ok: true,
    nowIso: new Date(now).toISOString(),
    candidates: candidates.length,
    emailsSent: sent,
  })
}
