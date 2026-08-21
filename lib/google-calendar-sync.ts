import type { GoogleCalendarLink } from "@prisma/client"

import { decryptSecret, encryptSecret } from "@/lib/secret-box"
import {
  GoogleAuthError,
  GoogleSyncTokenExpired,
  type GoogleEvent,
  deleteEvent,
  insertEvent,
  listEvents,
  patchEvent,
  refreshAccessToken,
} from "@/lib/google-calendar-api"
import { prisma } from "@/lib/prisma"

/**
 * Sincronización en los dos sentidos con Google Calendar.
 *
 * El orden es siempre el mismo —borrados, subidas, bajadas— y no es arbitrario:
 * bajar primero pisaría lo que el usuario acaba de escribir aquí, porque su
 * cambio todavía no ha llegado allá.
 *
 * Lo que de verdad hay que cuidar es el eco. Al subir un evento, Google lo
 * devuelve en la siguiente bajada; si se aplicara sin mirar, `updatedAt` se
 * movería, el evento volvería a parecer modificado, se subiría otra vez y así
 * para siempre, a doce vueltas por hora. Se corta comparando el contenido: si lo
 * que baja es igual a lo que hay, no se escribe nada, solo se marca como
 * igualado.
 *
 * ZONAS HORARIAS. Este calendario guarda hora de pared sin zona pegada: "14:00"
 * significa las dos de la tarde donde vive quien lo escribió. La zona es
 * `EVENT_TIMEZONE`. Al subir se le dice a Google explícitamente («14:00 en
 * America/Mexico_City»), y al bajar se traduce el instante que manda Google a la
 * hora de pared de esa misma zona. Sin ese par de conversiones, un evento de las
 * dos aparece en el teléfono a las ocho de la mañana.
 */

const TZ = process.env.EVENT_TIMEZONE || "Europe/Madrid"

/** Hacia atrás y hacia adelante en la pasada completa. Las series se expanden dentro. */
const WINDOW_PAST_DAYS = 90
const WINDOW_FUTURE_DAYS = 400

/** Tope por pasada, para que una agenda enorme no se coma el tiempo del cron. */
const MAX_PUSH_PER_RUN = 200

/** Un instante, contado en hora de pared de la zona del calendario. */
function instantToWallClock(instant: Date): { eventDate: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instant)

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  const hour = get("hour") === "24" ? "00" : get("hour")

  return { eventDate: `${get("year")}-${get("month")}-${get("day")}`, time: `${hour}:${get("minute")}` }
}

type Normalized = {
  title: string
  description: string
  location: string
  eventDate: string
  startTime: string
  endTime: string
}

/**
 * Un evento de Google en los términos de este calendario.
 *
 * Devuelve null cuando no hay forma honesta de representarlo, que hoy es un solo
 * caso: los que cruzan la medianoche. El modelo de aquí guarda un evento dentro
 * de un día —`eventDate` con hora de inicio y de fin—, así que un viaje de tres
 * días no cabe. Antes de recortarlo a las 23:59 y que parezca otra cosa, se deja
 * fuera y se cuenta cuántos hubo.
 */
function normalize(event: GoogleEvent): Normalized | null {
  const title = (event.summary ?? "").trim() || "(sin título)"
  const description = (event.description ?? "").trim()
  const location = (event.location ?? "").trim()

  // De todo el día: Google marca el final como el día siguiente, sin incluirlo.
  if (event.start?.date) {
    const endExclusive = event.end?.date
    const start = event.start.date
    if (endExclusive) {
      const dias = (Date.parse(`${endExclusive}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000
      if (dias > 1) return null
    }
    return { title, description, location, eventDate: start, startTime: "00:00", endTime: "23:59" }
  }

  if (!event.start?.dateTime || !event.end?.dateTime) return null

  const start = instantToWallClock(new Date(event.start.dateTime))
  const end = instantToWallClock(new Date(event.end.dateTime))

  if (end.eventDate !== start.eventDate) return null

  return {
    title,
    description,
    location,
    eventDate: start.eventDate,
    startTime: start.time,
    endTime: end.time,
  }
}

/** Lo que este calendario manda a Google, con la zona dicha en voz alta. */
function toGooglePayload(event: {
  title: string
  description: string | null
  location: string | null
  eventDate: string
  startTime: string
  endTime: string
}) {
  return {
    summary: event.title,
    description: event.description ?? "",
    location: event.location ?? "",
    start: { dateTime: `${event.eventDate}T${event.startTime}:00`, timeZone: TZ },
    end: { dateTime: `${event.eventDate}T${event.endTime}:00`, timeZone: TZ },
  }
}

/**
 * El token de acceso, reutilizado mientras siga vivo.
 *
 * Pedir uno nuevo en cada pasada serían doce peticiones por hora y por persona
 * para conseguir doce veces lo mismo.
 */
async function accessTokenFor(link: GoogleCalendarLink): Promise<string> {
  if (link.accessToken && link.accessTokenExpiresAt && link.accessTokenExpiresAt > new Date()) {
    return decryptSecret(link.accessToken)
  }

  const { accessToken, expiresAt } = await refreshAccessToken(decryptSecret(link.refreshToken))
  await prisma.googleCalendarLink.update({
    where: { id: link.id },
    data: { accessToken: encryptSecret(accessToken), accessTokenExpiresAt: expiresAt },
  })
  return accessToken
}

/**
 * Marca un evento como igualado con Google **sin mover `updatedAt`**.
 *
 * Por el camino normal de Prisma esto sería imposible: `@updatedAt` lo aplica el
 * cliente en cada `update`, así que la propia marca de «ya está sincronizado»
 * volvería a ensuciar el evento y este se subiría en la pasada siguiente, y en
 * la otra, y en la otra.
 */
async function markSynced(eventId: string, googleEventId: string) {
  await prisma.$executeRaw`
    UPDATE "Event"
    SET "googleEventId" = ${googleEventId}, "googleSyncedAt" = "updatedAt"
    WHERE "id" = ${eventId}`
}

function sameContent(a: Normalized, b: Normalized): boolean {
  return (
    a.title === b.title &&
    a.description === b.description &&
    a.location === b.location &&
    a.eventDate === b.eventDate &&
    a.startTime === b.startTime &&
    a.endTime === b.endTime
  )
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

/** Los componentes tal como los lee el resto de la aplicación (hora de pared). */
function localParts(row: { startAt: Date; endAt: Date; title: string; description: string | null; location: string | null }): Normalized {
  return {
    title: row.title,
    description: row.description ?? "",
    location: row.location ?? "",
    eventDate: `${row.startAt.getFullYear()}-${pad(row.startAt.getMonth() + 1)}-${pad(row.startAt.getDate())}`,
    startTime: `${pad(row.startAt.getHours())}:${pad(row.startAt.getMinutes())}`,
    endTime: `${pad(row.endAt.getHours())}:${pad(row.endAt.getMinutes())}`,
  }
}

export type SyncResult = {
  pushed: number
  pulled: number
  deletedHere: number
  deletedThere: number
  skipped: number
  fullResync: boolean
}

/**
 * Una pasada completa para un usuario.
 *
 * Los fallos de permiso apagan la sincronización en vez de reintentar cada cinco
 * minutos: un permiso revocado no se arregla insistiendo, y sí se arregla
 * reconectando desde Ajustes, que es lo que verá el usuario.
 */
export async function syncUser(userId: string): Promise<SyncResult> {
  const link = await prisma.googleCalendarLink.findUnique({ where: { userId } })
  if (!link || !link.syncEnabled) {
    return { pushed: 0, pulled: 0, deletedHere: 0, deletedThere: 0, skipped: 0, fullResync: false }
  }

  try {
    const result = await runSync(link)
    await prisma.googleCalendarLink.update({
      where: { id: link.id },
      data: { lastSyncAt: new Date(), lastError: null },
    })
    return result
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await prisma.googleCalendarLink.update({
      where: { id: link.id },
      data: {
        lastError: message.slice(0, 500),
        ...(e instanceof GoogleAuthError ? { syncEnabled: false } : {}),
      },
    })
    throw e
  }
}

async function runSync(link: GoogleCalendarLink): Promise<SyncResult> {
  const token = await accessTokenFor(link)
  const result: SyncResult = { pushed: 0, pulled: 0, deletedHere: 0, deletedThere: 0, skipped: 0, fullResync: false }

  // 1. Borrados de aquí. Primero, para que un evento borrado y recreado en el
  //    mismo intervalo no acabe borrando al recién nacido.
  const tombstones = await prisma.googleDeletion.findMany({ where: { userId: link.userId }, take: 100 })
  for (const stone of tombstones) {
    await deleteEvent(token, link.calendarId, stone.googleEventId)
    await prisma.googleDeletion.delete({ where: { id: stone.id } })
    result.deletedThere += 1
  }

  // 2. Lo que se tocó aquí desde la última vez. Las instancias de series
  //    recurrentes quedan fuera: son de solo lectura.
  const dirty = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Event"
    WHERE "userId" = ${link.userId}
      AND "googleRecurring" = false
      AND ("googleSyncedAt" IS NULL OR "updatedAt" > "googleSyncedAt")
    ORDER BY "startAt" ASC
    LIMIT ${MAX_PUSH_PER_RUN}`

  for (const { id } of dirty) {
    const row = await prisma.event.findUnique({ where: { id } })
    if (!row) continue

    // `localParts` ya trae título, descripción y lugar además de la hora de
    // pared: pasarlos otra vez por separado solo servía para pisarlos con lo mismo.
    const payload = toGooglePayload(localParts(row))

    const saved = row.googleEventId
      ? await patchEvent(token, link.calendarId, row.googleEventId, payload)
      : await insertEvent(token, link.calendarId, payload)

    await markSynced(row.id, saved.id)
    result.pushed += 1
  }

  // 3. Lo que cambió allá. Con testigo, Google manda solo la diferencia.
  let events: GoogleEvent[]
  let nextSyncToken: string | null
  try {
    ;({ events, nextSyncToken } = await listEvents(token, {
      calendarId: link.calendarId,
      syncToken: link.syncToken,
    }))
  } catch (e) {
    if (!(e instanceof GoogleSyncTokenExpired)) throw e
    // El testigo caducó: se vuelve a empezar con una ventana acotada. Sin
    // `timeMax`, una serie «todos los lunes, para siempre» se expandiría sin fin.
    result.fullResync = true
    ;({ events, nextSyncToken } = await listEvents(token, {
      calendarId: link.calendarId,
      timeMin: new Date(Date.now() - WINDOW_PAST_DAYS * 86_400_000).toISOString(),
      timeMax: new Date(Date.now() + WINDOW_FUTURE_DAYS * 86_400_000).toISOString(),
    }))
  }

  for (const event of events) {
    const existing = await prisma.event.findFirst({
      where: { userId: link.userId, googleEventId: event.id },
    })

    if (event.status === "cancelled") {
      if (existing) {
        // Borrado directo y no `deleteEventForUser`: allá ya no está, así que
        // dejar una lápida sería pedir que se borre lo que nadie tiene.
        await prisma.event.delete({ where: { id: existing.id } })
        result.deletedHere += 1
      }
      continue
    }

    const incoming = normalize(event)
    if (!incoming) {
      result.skipped += 1
      continue
    }

    const recurring = Boolean(event.recurringEventId)

    if (!existing) {
      const created = await prisma.event.create({
        data: {
          userId: link.userId,
          title: incoming.title,
          description: incoming.description || null,
          location: incoming.location || null,
          startAt: new Date(`${incoming.eventDate}T${incoming.startTime}:00`),
          endAt: new Date(`${incoming.eventDate}T${incoming.endTime}:00`),
          googleEventId: event.id,
          googleRecurring: recurring,
        },
      })
      await markSynced(created.id, event.id)
      result.pulled += 1
      continue
    }

    // Aquí se corta el eco: si lo que baja es lo que ya hay —normalmente porque
    // acabamos de subirlo—, no se escribe. Escribirlo movería `updatedAt`, el
    // evento volvería a parecer modificado y se subiría otra vez, en bucle.
    if (sameContent(localParts(existing), incoming) && existing.googleRecurring === recurring) {
      await markSynced(existing.id, event.id)
      continue
    }

    await prisma.event.update({
      where: { id: existing.id },
      data: {
        title: incoming.title,
        description: incoming.description || null,
        location: incoming.location || null,
        startAt: new Date(`${incoming.eventDate}T${incoming.startTime}:00`),
        endAt: new Date(`${incoming.eventDate}T${incoming.endTime}:00`),
        googleRecurring: recurring,
        // Cambió la hora: los avisos que ya se mandaron dejan de valer.
        reminderEmailSentAt: null,
        reminderUpcomingSentAt: null,
      },
    })
    await markSynced(existing.id, event.id)
    result.pulled += 1
  }

  if (nextSyncToken) {
    await prisma.googleCalendarLink.update({
      where: { id: link.id },
      data: { syncToken: nextSyncToken },
    })
  }

  return result
}
