import { type Event } from "@prisma/client"

import { prisma } from "@/lib/prisma"

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

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function toEventDTO(event: Event): EventDTO {
  return {
    id: event.id,
    title: event.title,
    description: event.description ?? "",
    location: event.location ?? "",
    eventDate: formatDate(event.startAt),
    startTime: formatTime(event.startAt),
    endTime: formatTime(event.endAt),
    color: event.color,
    attendees: event.attendees,
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

  return events.map(toEventDTO)
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

  return events.map(toEventDTO)
}

export async function createEventForUser(userId: string, input: CreateEventInput, allowConflict = false) {
  const startAt = toDateTime(input.eventDate, input.startTime)
  const endAt = toDateTime(input.eventDate, input.endTime)

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    throw new Error("Fecha u hora inválida")
  }

  if (startAt >= endAt) {
    throw new Error("La hora de fin debe ser mayor que la hora de inicio")
  }

  const conflicts = await findOverlaps(userId, startAt, endAt)
  if (!allowConflict && conflicts.length > 0) {
    return { event: null, conflicts: conflicts.map(toEventDTO) }
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
      organizer: input.organizer ?? "You",
    },
  })

  return { event: toEventDTO(event), conflicts: conflicts.map(toEventDTO) }
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

  const nextDate = input.eventDate ?? formatDate(existing.startAt)
  const nextStartTime = input.startTime ?? formatTime(existing.startAt)
  const nextEndTime = input.endTime ?? formatTime(existing.endAt)

  const startAt = toDateTime(nextDate, nextStartTime)
  const endAt = toDateTime(nextDate, nextEndTime)

  if (startAt >= endAt) {
    throw new Error("La hora de fin debe ser mayor que la hora de inicio")
  }

  const conflicts = await findOverlaps(userId, startAt, endAt, eventId)
  if (!allowConflict && conflicts.length > 0) {
    return { event: null, conflicts: conflicts.map(toEventDTO), notFound: false as const }
  }

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
      organizer: input.organizer ?? existing.organizer,
    },
  })

  return { event: toEventDTO(event), conflicts: conflicts.map(toEventDTO), notFound: false as const }
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
  return overlaps.map(toEventDTO)
}
