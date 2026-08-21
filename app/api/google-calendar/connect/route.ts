import { getCurrentUserId } from "@/lib/auth"
import { CALENDAR_SCOPE, googleConfigured } from "@/lib/google-calendar-api"
import { redirectUri, signOAuthState } from "@/lib/google-calendar-link"

export const dynamic = "force-dynamic"

/**
 * Manda al usuario a dar permiso en Google.
 *
 * Es un flujo aparte del login a propósito. Si el permiso de calendario se
 * pidiera dentro del «Entrar con Google», se lo pediríamos también a quien solo
 * quiere iniciar sesión —y además funciona para quien entra con contraseña, que
 * con el otro camino se quedaría fuera—.
 */
export async function GET() {
  // Conectar una cuenta de Google es una acción de cuenta: no la puede disparar
  // una llave de API, igual que no puede crear otras llaves.
  const userId = await getCurrentUserId({ allowApiKey: false })
  if (!userId) return Response.json({ error: "No autenticado" }, { status: 401 })
  if (!googleConfigured()) {
    return Response.json({ error: "Google no está configurado en el servidor" }, { status: 503 })
  }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID ?? "")
  url.searchParams.set("redirect_uri", redirectUri())
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", `${CALENDAR_SCOPE} email`)
  // Sin `offline` Google da un token de una hora y ninguno de refresco, y la
  // sincronización moriría en cuanto el usuario cerrara la pestaña.
  url.searchParams.set("access_type", "offline")
  // `consent` fuerza a que devuelva refresh token también cuando el usuario ya
  // había dado permiso antes: si no, en la segunda conexión vuelve sin llave.
  url.searchParams.set("prompt", "consent")
  url.searchParams.set("include_granted_scopes", "true")
  url.searchParams.set("state", await signOAuthState(userId))

  return Response.redirect(url.toString(), 302)
}
