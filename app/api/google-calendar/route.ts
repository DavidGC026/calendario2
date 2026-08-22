import { getCurrentUserId } from "@/lib/auth"
import { CALENDAR_SCOPE, googleConfigured } from "@/lib/google-calendar-api"
import { redirectUri, signOAuthState } from "@/lib/google-calendar-link"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * La dirección de Google donde se concede el permiso, ya firmada.
 *
 * En la web basta con redirigir desde /connect, porque el navegador lleva la
 * sesión puesta. La app de Android no: guarda un JWT en una cabecera, y una
 * pestaña del navegador no se lo lleva consigo, así que abrir /connect desde el
 * teléfono daría un 401.
 *
 * Por eso la dirección se entrega aquí, en la misma llamada con la que la app
 * pregunta cómo va la conexión: la app la pide con su token, la abre en el
 * navegador y Google vuelve al callback, que se identifica por el `state`
 * firmado y no necesita ninguna sesión. Una petición en vez de un flujo aparte.
 */
async function buildConnectUrl(userId: string): Promise<string | null> {
  if (!googleConfigured()) return null

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID ?? "")
  url.searchParams.set("redirect_uri", redirectUri())
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", `${CALENDAR_SCOPE} email`)
  url.searchParams.set("access_type", "offline")
  url.searchParams.set("prompt", "consent")
  url.searchParams.set("include_granted_scopes", "true")
  url.searchParams.set("state", await signOAuthState(userId))

  return url.toString()
}

/** Cómo va la conexión con Google: para pintar Ajustes y para contar los fallos. */
export async function GET() {
  const userId = await getCurrentUserId()
  if (!userId) return Response.json({ error: "No autenticado" }, { status: 401 })

  const link = await prisma.googleCalendarLink.findUnique({ where: { userId } })

  return Response.json({
    configured: googleConfigured(),
    // Caduca en diez minutos, así que se pide cuando se va a usar y no se guarda.
    connectUrl: await buildConnectUrl(userId),
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
