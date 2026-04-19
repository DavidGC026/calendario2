import { getCurrentUserId } from "@/lib/auth"
import { getOrCreateCalendarFeedToken, rotateCalendarFeedToken } from "@/lib/calendar-feed"

export async function GET() {
  const userId = await getCurrentUserId()
  if (!userId) return Response.json({ error: "No autenticado" }, { status: 401 })
  const token = await getOrCreateCalendarFeedToken(userId)
  return Response.json({ token })
}

/** Rota el token actual; las suscripciones existentes dejan de funcionar. */
export async function POST() {
  const userId = await getCurrentUserId()
  if (!userId) return Response.json({ error: "No autenticado" }, { status: 401 })
  const token = await rotateCalendarFeedToken(userId)
  return Response.json({ token })
}
