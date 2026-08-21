import { encryptSecret } from "@/lib/secret-box"
import { exchangeCodeForTokens, fetchGoogleEmail } from "@/lib/google-calendar-api"
import { redirectUri, verifyOAuthState } from "@/lib/google-calendar-link"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/** Vuelve al calendario con el resultado colgado de la URL, para poder contarlo. */
function backToApp(status: string) {
  const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/+$/, "")
  return Response.redirect(`${base}/?google=${status}`, 302)
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")

  if (url.searchParams.get("error")) return backToApp("denegado")
  if (!code || !state) return backToApp("error")

  // De quién es esta vuelta lo dice el `state` firmado, no la sesión del
  // navegador: así un `code` ajeno no puede engancharse a otra cuenta.
  const userId = await verifyOAuthState(state)
  if (!userId) return backToApp("expirado")

  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri())

    // Sin refresh token no hay sincronización que dure: pasa cuando Google ya
    // dio permiso antes y no se le pidió `prompt=consent`. Mejor decirlo que
    // guardar un enlace que se apaga en una hora.
    if (!tokens.refreshToken) return backToApp("sin-permiso-permanente")

    const email = await fetchGoogleEmail(tokens.accessToken)

    await prisma.googleCalendarLink.upsert({
      where: { userId },
      update: {
        googleEmail: email,
        refreshToken: encryptSecret(tokens.refreshToken),
        accessToken: encryptSecret(tokens.accessToken),
        accessTokenExpiresAt: tokens.expiresAt,
        syncEnabled: true,
        lastError: null,
        // Volver a conectar empieza de cero: el testigo viejo puede referirse a
        // un calendario que ya no es el mismo.
        syncToken: null,
      },
      create: {
        userId,
        googleEmail: email,
        refreshToken: encryptSecret(tokens.refreshToken),
        accessToken: encryptSecret(tokens.accessToken),
        accessTokenExpiresAt: tokens.expiresAt,
      },
    })

    return backToApp("conectado")
  } catch {
    return backToApp("error")
  }
}
