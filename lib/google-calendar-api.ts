/**
 * Cliente mínimo de la API de Google Calendar, con `fetch` y sin librería.
 *
 * `googleapis` son decenas de megas para usar cuatro rutas, y ya hay precedente
 * en esta base: `verifyGoogleIdToken` habla con Google a pelo. Lo que sí hace
 * falta es tratar bien tres respuestas que no son errores corrientes —el token
 * de sincronización caducado, el permiso revocado y el 429— porque cada una se
 * arregla de una manera distinta y confundirlas deja la sincronización muerta
 * sin decir por qué.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token"
const API = "https://www.googleapis.com/calendar/v3"

/** El único permiso que se pide: ver y cambiar eventos, nada más de la cuenta. */
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events"

export type GoogleDateTime = {
  /** "2026-08-21" para eventos de todo el día. */
  date?: string
  /** RFC3339. Sin desfase si viaja acompañado de `timeZone`. */
  dateTime?: string
  timeZone?: string
}

export type GoogleEvent = {
  id: string
  status?: string
  summary?: string
  description?: string
  location?: string
  start?: GoogleDateTime
  end?: GoogleDateTime
  updated?: string
  recurringEventId?: string
  htmlLink?: string
}

/** El permiso ya no vale: lo revocó el usuario o caducó. Solo se arregla reconectando. */
export class GoogleAuthError extends Error {}

/**
 * El testigo incremental caducó (410). No es un fallo: Google lo hace cuando ha
 * pasado demasiado tiempo. Se responde con una pasada completa.
 */
export class GoogleSyncTokenExpired extends Error {}

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim())
}

/** Un token de acceso nuevo a partir del refresh token. Dura una hora. */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    // `invalid_grant` es el caso que importa: el usuario retiró el permiso desde
    // su cuenta de Google, o el token lleva demasiado sin usarse. Reintentar no
    // lo arregla nunca.
    if (data.error === "invalid_grant") {
      throw new GoogleAuthError("Google retiró el permiso; hay que volver a conectar la cuenta.")
    }
    throw new Error(data.error_description ?? data.error ?? `Google contestó ${res.status} al renovar el token.`)
  }

  return {
    accessToken: data.access_token as string,
    // Un minuto de margen: si el token vence entre que se comprueba y se usa,
    // la pasada entera se cae por diez segundos de diferencia.
    expiresAt: new Date(Date.now() + (Number(data.expires_in ?? 3600) - 60) * 1000),
  }
}

/** Cambia el código de la vuelta de OAuth por el refresh token. Solo al conectar. */
export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error_description ?? data.error ?? `Google contestó ${res.status}.`)
  }

  return {
    refreshToken: (data.refresh_token as string | undefined) ?? null,
    accessToken: data.access_token as string,
    expiresAt: new Date(Date.now() + (Number(data.expires_in ?? 3600) - 60) * 1000),
    idToken: (data.id_token as string | undefined) ?? null,
  }
}

async function call(
  accessToken: string,
  path: string,
  { method = "GET", body, query }: { method?: string; body?: unknown; query?: Record<string, string | undefined> } = {},
) {
  const url = new URL(`${API}${path}`)
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, v)
  }

  const res = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  // 204 en los borrados: no hay cuerpo que leer.
  if (res.status === 204) return {}

  if (res.status === 410) throw new GoogleSyncTokenExpired("El token de sincronización caducó.")
  if (res.status === 401 || res.status === 403) {
    const data = await res.json().catch(() => ({}))
    const reason = data?.error?.errors?.[0]?.reason
    // 403 es ambiguo: puede ser «no tienes permiso» o «vas demasiado deprisa».
    // Solo el primero obliga a reconectar; el segundo se arregla esperando.
    if (res.status === 403 && (reason === "rateLimitExceeded" || reason === "userRateLimitExceeded")) {
      throw new Error("Google está limitando las peticiones; se reintenta en la próxima pasada.")
    }
    throw new GoogleAuthError(data?.error?.message ?? "Google rechazó el permiso.")
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `Google contestó ${res.status}.`)
  }
  return data
}

type ListOptions = {
  calendarId: string
  syncToken?: string | null
  timeMin?: string
  timeMax?: string
}

/**
 * Los eventos que cambiaron, o todos si no hay testigo.
 *
 * `singleEvents: true` expande las series en repeticiones sueltas, que es lo que
 * este calendario sabe guardar. A cambio, `timeMax` deja de ser opcional en la
 * pasada completa: sin él, una serie «todos los lunes, para siempre» se expande
 * hasta el infinito.
 */
export async function listEvents(
  accessToken: string,
  { calendarId, syncToken, timeMin, timeMax }: ListOptions,
): Promise<{ events: GoogleEvent[]; nextSyncToken: string | null }> {
  const events: GoogleEvent[] = []
  let pageToken: string | undefined
  let nextSyncToken: string | null = null

  do {
    const data = (await call(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events`, {
      query: {
        singleEvents: "true",
        showDeleted: "true",
        maxResults: "250",
        pageToken,
        // Con testigo, Google prohíbe mandar filtros de fecha: los lleva dentro.
        ...(syncToken ? { syncToken } : { timeMin, timeMax, orderBy: undefined }),
      },
    })) as { items?: GoogleEvent[]; nextPageToken?: string; nextSyncToken?: string }

    events.push(...(data.items ?? []))
    pageToken = data.nextPageToken
    nextSyncToken = data.nextSyncToken ?? null
  } while (pageToken)

  return { events, nextSyncToken }
}

export async function insertEvent(accessToken: string, calendarId: string, event: Record<string, unknown>) {
  return call(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    body: event,
  }) as Promise<GoogleEvent>
}

export async function patchEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: Record<string, unknown>,
) {
  return call(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    body: event,
  }) as Promise<GoogleEvent>
}

export async function deleteEvent(accessToken: string, calendarId: string, eventId: string) {
  try {
    await call(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
      method: "DELETE",
    })
  } catch (e) {
    // Ya no estaba: el objetivo era que no existiera y no existe. Tratarlo como
    // fallo dejaría la lápida dando vueltas para siempre.
    if (e instanceof Error && /404|not found|deleted/i.test(e.message)) return
    throw e
  }
}

/** El correo de la cuenta conectada, para poder enseñar cuál es en Ajustes. */
export async function fetchGoogleEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return ""
  const data = await res.json().catch(() => ({}))
  return typeof data.email === "string" ? data.email : ""
}
