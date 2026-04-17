import { type Event } from "@prisma/client"

import { formatISODateLocal } from "@/lib/calendar-view-utils"
import { validateParticipantIdsAreFriends } from "@/lib/friends"
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
  organizer?: string | null
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
  const participantUserIds = [...new Set(input.participantUserIds ?? [])].filter(Boolean)
  if (participantUserIds.length > 0) {
    const ok = await validateParticipantIdsAreFriends(userId, participantUserIds)
    if (!ok) {
      throw new Error("Solo puedes añadir como participantes a usuarios con los que tengas amistad aceptada")
    }
  }

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

  if (input.participantUserIds !== undefined && input.participantUserIds !== null) {
    const ids = [...new Set(input.participantUserIds)].filter(Boolean)
    if (ids.length > 0) {
      const ok = await validateParticipantIdsAreFriends(userId, ids)
      if (!ok) {
        throw new Error("Solo puedes añadir como participantes a usuarios con los que tengas amistad aceptada")
      }
    }
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

  const nextParticipants =
    input.participantUserIds !== undefined && input.participantUserIds !== null
      ? [...new Set(input.participantUserIds)].filter(Boolean)
      : existing.participantUserIds

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
    },
  })

  return { event: await toEventDTO(event), conflicts: await Promise.all(conflicts.map(toEventDTO)), notFound: false as const }
}

export async function deleteEventForUser(userId: string, eventId: string) {
  const existing = await prisma.event.findFirst({
    where: { id: eventId, userId },
    select: { id: true },
  })

  if (!existing) return false

  await prisma.event.delete({ where: { id: eventId } })
  return true
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
