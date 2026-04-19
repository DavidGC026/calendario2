import { type Event } from "@prisma/client"

import { formatISODateLocal } from "@/lib/calendar-view-utils"
import { resolveParticipantUserIdsForOwner } from "@/lib/friends"
import { prisma } from "@/lib/prisma"

export type EventParticipant = {
  id: string
  name: string | null
  email: string
}

export type EventDTO = {
  id: string
  title: string
  description: string
  location: string
  eventDate: string
  startTime: string
  endTime: string
  color: string
  attendees: string[]
  participantUserIds: string[]
  participants: EventParticipant[]
  organizer: string
  day: number
  /** Minutos antes del inicio para recordatorio extra. Null = sin aviso previo. */
  reminderMinutesBefore: number | null
  /** Si false, no se envían correos de recordatorio para este evento. */
  emailRemindersEnabled: boolean
}

/** Valores aceptados para el aviso "X minutos antes". null = sin aviso previo. */
export const REMINDER_MINUTES_OPTIONS = [null, 5, 15, 30, 60, 120, 1440] as const

function sanitizeReminderMinutes(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return null
  if (n <= 0) return null
  // Solo permitimos valores conocidos para evitar abusos / typos.
  return (REMINDER_MINUTES_OPTIONS as readonly (number | null)[]).includes(n)
    ? (n as number)
    : null
}

type CreateEventInput = {
  title: string
  eventDate: string
  startTime: string
  endTime: string
  description?: string | null
  location?: string | null
  color?: string | null
  attendees?: string[] | null
  participantUserIds?: string[] | null
  /** Nombres o fragmentos; se resuelven contra la lista de amigos del dueño. */
  participantNameHints?: string[] | null
  organizer?: string | null
  reminderMinutesBefore?: number | null
  emailRemindersEnabled?: boolean
}

type UpdateEventInput = Partial<CreateEventInput>

function toDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`)
}

function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${hours}:${minutes}`
}

/** Si fin <= inicio (p. ej. "desde la 1pm" sin duración), ajusta fin a +1 h el mismo día o 23:59 si cruza medianoche. */
export function ensureEndAfterStart(
  eventDate: string,
  startTime: string,
  endTime: string,
): { startTime: string; endTime: string } {
  const startAt = toDateTime(eventDate, startTime)
  const endAt = toDateTime(eventDate, endTime)
  if (endAt > startAt) {
    return { startTime, endTime }
  }
  const plus1h = new Date(startAt.getTime() + 60 * 60 * 1000)
  const startDay = new Date(`${eventDate}T12:00:00`)
  const sameCalendarDay =
    plus1h.getFullYear() === startDay.getFullYear() &&
    plus1h.getMonth() === startDay.getMonth() &&
    plus1h.getDate() === startDay.getDate()
  if (sameCalendarDay) {
    return { startTime, endTime: formatTime(plus1h) }
  }
  return { startTime, endTime: "23:59" }
}

async function loadParticipants(ids: string[]): Promise<EventParticipant[]> {
  const unique = [...new Set(ids)].filter(Boolean)
  if (unique.length === 0) return []
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, email: true, name: true },
  })
  const order = new Map(unique.map((id, i) => [id, i]))
  return users.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
}

export async function toEventDTO(event: Event): Promise<EventDTO> {
  const ids = event.participantUserIds ?? []
  const participants = await loadParticipants(ids)
  return {
    id: event.id,
    title: event.title,
    description: event.description ?? "",
    location: event.location ?? "",
    eventDate: formatISODateLocal(event.startAt),
    startTime: formatTime(event.startAt),
    endTime: formatTime(event.endAt),
    color: event.color,
    attendees: event.attendees,
    participantUserIds: ids,
    participants,
    organizer: event.organizer ?? "You",
    day: event.startAt.getDate(),
    reminderMinutesBefore: event.reminderMinutesBefore ?? null,
    emailRemindersEnabled: event.emailRemindersEnabled,
  }
}

async function findOverlaps(userId: string, startAt: Date, endAt: Date, excludeEventId?: string) {
  return prisma.event.findMany({
    where: {
      userId,
      ...(excludeEventId ? { id: { not: excludeEventId } } : {}),
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    orderBy: { startAt: "asc" },
  })
}

export async function listEventsForUser(userId: string) {
  const events = await prisma.event.findMany({
    where: { userId },
    orderBy: [{ startAt: "asc" }],
  })

  return Promise.all(events.map(toEventDTO))
}

export async function getEventsForDate(userId: string, date: string) {
  const start = new Date(`${date}T00:00:00`)
  const end = new Date(`${date}T23:59:59`)

  const events = await prisma.event.findMany({
    where: {
      userId,
      startAt: { gte: start, lte: end },
    },
    orderBy: [{ startAt: "asc" }],
  })

  return Promise.all(events.map(toEventDTO))
}

export async function createEventForUser(userId: string, input: CreateEventInput, allowConflict = false) {
  const participantUserIds = await resolveParticipantUserIdsForOwner(
    userId,
    input.participantUserIds,
    input.participantNameHints,
  )

  const { startTime: st, endTime: et } = ensureEndAfterStart(input.eventDate, input.startTime, input.endTime)
  const startAt = toDateTime(input.eventDate, st)
  const endAt = toDateTime(input.eventDate, et)

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    throw new Error("Fecha u hora inválida")
  }

  if (startAt >= endAt) {
    throw new Error("La hora de fin debe ser mayor que la hora de inicio")
  }

  const conflicts = await findOverlaps(userId, startAt, endAt)
  if (!allowConflict && conflicts.length > 0) {
    return { event: null, conflicts: await Promise.all(conflicts.map(toEventDTO)) }
  }

  const emailOn = input.emailRemindersEnabled !== false
  const event = await prisma.event.create({
    data: {
      userId,
      title: input.title,
      description: input.description ?? null,
      location: input.location ?? null,
      startAt,
      endAt,
      color: input.color ?? "bg-blue-500",
      attendees: input.attendees ?? [],
      participantUserIds,
      organizer: input.organizer ?? "You",
      reminderMinutesBefore: emailOn ? sanitizeReminderMinutes(input.reminderMinutesBefore) : null,
      emailRemindersEnabled: emailOn,
    },
  })

  return { event: await toEventDTO(event), conflicts: await Promise.all(conflicts.map(toEventDTO)) }
}

export async function updateEventForUser(
  userId: string,
  eventId: string,
  input: UpdateEventInput,
  allowConflict = false,
) {
  const existing = await prisma.event.findFirst({
    where: { id: eventId, userId },
  })

  if (!existing) {
    return { event: null, conflicts: [], notFound: true as const }
  }

  const nextDate = input.eventDate ?? formatISODateLocal(existing.startAt)
  const nextStartTime = input.startTime ?? formatTime(existing.startAt)
  const nextEndTime = input.endTime ?? formatTime(existing.endAt)
  const { startTime: st, endTime: et } = ensureEndAfterStart(nextDate, nextStartTime, nextEndTime)

  const startAt = toDateTime(nextDate, st)
  const endAt = toDateTime(nextDate, et)

  if (startAt >= endAt) {
    throw new Error("La hora de fin debe ser mayor que la hora de inicio")
  }

  const conflicts = await findOverlaps(userId, startAt, endAt, eventId)
  if (!allowConflict && conflicts.length > 0) {
    return { event: null, conflicts: await Promise.all(conflicts.map(toEventDTO)), notFound: false as const }
  }

  const hasNewIds = input.participantUserIds !== undefined && input.participantUserIds !== null
  const hasHints =
    input.participantNameHints !== undefined &&
    input.participantNameHints !== null &&
    input.participantNameHints.filter(Boolean).length > 0

  let nextParticipants = existing.participantUserIds
  if (hasNewIds || hasHints) {
    const baseIds = hasNewIds ? input.participantUserIds! : existing.participantUserIds
    nextParticipants = await resolveParticipantUserIdsForOwner(
      userId,
      baseIds,
      hasHints ? input.participantNameHints : null,
    )
  }

  const prevDate = formatISODateLocal(existing.startAt)
  const prevStartTime = formatTime(existing.startAt)
  const prevEndTime = formatTime(existing.endAt)
  const scheduleChanged = nextDate !== prevDate || st !== prevStartTime || et !== prevEndTime

  const emailProvided = Object.prototype.hasOwnProperty.call(input, "emailRemindersEnabled")
  const nextEmailReminders = emailProvided ? Boolean(input.emailRemindersEnabled) : existing.emailRemindersEnabled

  const reminderProvided = Object.prototype.hasOwnProperty.call(input, "reminderMinutesBefore")
  let nextReminder = reminderProvided
    ? sanitizeReminderMinutes(input.reminderMinutesBefore)
    : existing.reminderMinutesBefore
  if (!nextEmailReminders) {
    nextReminder = null
  }
  const reminderChanged = nextReminder !== existing.reminderMinutesBefore
  const emailChanged = nextEmailReminders !== existing.emailRemindersEnabled

  const event = await prisma.event.update({
    where: { id: eventId },
    data: {
      title: input.title ?? existing.title,
      description: input.description ?? existing.description,
      location: input.location ?? existing.location,
      startAt,
      endAt,
      color: input.color ?? existing.color,
      attendees: input.attendees ?? existing.attendees,
      participantUserIds: nextParticipants,
      organizer: input.organizer ?? existing.organizer,
      emailRemindersEnabled: nextEmailReminders,
      reminderMinutesBefore: nextReminder,
      ...(scheduleChanged ? { reminderEmailSentAt: null } : {}),
      // Si cambia hora, tipo de aviso o activación de correos, resetea el aviso previo enviado.
      ...(scheduleChanged || reminderChanged || emailChanged ? { reminderUpcomingSentAt: null } : {}),
    },
  })

  return { event: await toEventDTO(event), conflicts: await Promise.all(conflicts.map(toEventDTO)), notFound: false as const }
}

/** Devuelve el DTO antes de borrar (para correos); null si no existe o no es del usuario. */
export async function deleteEventForUser(userId: string, eventId: string): Promise<EventDTO | null> {
  const existing = await prisma.event.findFirst({
    where: { id: eventId, userId },
  })

  if (!existing) return null

  const dto = await toEventDTO(existing)
  await prisma.event.delete({ where: { id: eventId } })
  return dto
}

export async function findConflictsForUser(
  userId: string,
  date: string,
  startTime: string,
  endTime: string,
  excludeEventId?: string,
) {
  const startAt = toDateTime(date, startTime)
  const endAt = toDateTime(date, endTime)
  const overlaps = await findOverlaps(userId, startAt, endAt, excludeEventId)
  return Promise.all(overlaps.map(toEventDTO))
}
