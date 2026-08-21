import { getCurrentUserId } from "@/lib/auth"
import { syncUser } from "@/lib/google-calendar-sync"

export const dynamic = "force-dynamic"
/** Una agenda grande en la primera pasada tarda más que el límite de por defecto. */
export const maxDuration = 120

/** Sincronizar ahora, sin esperar al cron. Lo usa el botón de Ajustes. */
export async function POST() {
  const userId = await getCurrentUserId()
  if (!userId) return Response.json({ error: "No autenticado" }, { status: 401 })

  try {
    return Response.json({ ok: true, result: await syncUser(userId) })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 })
  }
}
