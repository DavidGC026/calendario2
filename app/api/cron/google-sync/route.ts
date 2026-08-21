import { syncUser } from "@/lib/google-calendar-sync"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * GET con Authorization: Bearer CRON_SECRET — sincroniza a todos los conectados.
 *
 * Un fallo de uno no puede parar a los demás: si el permiso de una persona
 * caducó, el resto de las agendas siguen igualándose. Cada error queda anotado
 * en su propio enlace, que es donde su dueño lo va a ver.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return Response.json({ error: "CRON_SECRET no configurado" }, { status: 503 })
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 })
  }

  const links = await prisma.googleCalendarLink.findMany({
    where: { syncEnabled: true },
    select: { userId: true },
  })

  let ok = 0
  let failed = 0
  const totals = { pushed: 0, pulled: 0, deletedHere: 0, deletedThere: 0, skipped: 0 }

  for (const { userId } of links) {
    try {
      const r = await syncUser(userId)
      totals.pushed += r.pushed
      totals.pulled += r.pulled
      totals.deletedHere += r.deletedHere
      totals.deletedThere += r.deletedThere
      totals.skipped += r.skipped
      ok += 1
    } catch {
      // El detalle ya quedó guardado en el enlace del usuario; aquí solo importa
      // seguir con el siguiente.
      failed += 1
    }
  }

  return Response.json({ ok: true, usuarios: links.length, sincronizados: ok, fallidos: failed, ...totals })
}
