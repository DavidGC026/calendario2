import {
  consumeStream,
  convertToModelMessages,
  streamText,
  UIMessage,
  tool,
} from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"

import { getCurrentUserId } from "@/lib/auth"
import {
  EventDTO,
  createEventForUser,
  deleteEventForUser,
  findConflictsForUser,
  getEventsForDate,
  listEventsForUser,
  updateEventForUser,
} from "@/lib/events"

export const maxDuration = 30

export async function POST(req: Request) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return Response.json({ error: "No autenticado" }, { status: 401 })
  }

  const {
    messages,
    locale = "es",
  }: { messages: UIMessage[]; locale?: "es" | "en" } = await req.json()
  const isEnglish = locale === "en"
  const copy = {
    noEvents: isEnglish ? "The user has no scheduled events." : "El usuario no tiene eventos programados.",
    currentEvents: isEnglish ? "Current user events" : "Eventos actuales del usuario",
    conflictDetected: isEnglish ? "Schedule conflict detected" : "Conflicto de horario detectado",
    noEventsForDate: isEnglish ? "There are no events for this date" : "No hay eventos para esta fecha",
    noEventWithId: isEnglish ? "No event found with that id" : "No existe un evento con ese id",
    eventNotFound: isEnglish ? "Event not found" : "Evento no encontrado",
  }
  const userEvents: EventDTO[] = await listEventsForUser(userId)
  const eventsContext =
    userEvents.length > 0
      ? `\n\n${copy.currentEvents}:\n${userEvents
          .map((e) =>
            isEnglish
              ? `- ${e.title} on ${e.eventDate} from ${e.startTime} to ${e.endTime}${e.description ? `: ${e.description}` : ""}`
              : `- ${e.title} el ${e.eventDate} de ${e.startTime} a ${e.endTime}${e.description ? `: ${e.description}` : ""}`,
          )
          .join("\n")}`
      : `\n\n${copy.noEvents}`

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: `${isEnglish ? "You are a smart and friendly calendar assistant. You help users to:" : "Eres un asistente de calendario inteligente y amigable. Ayudas a los usuarios a:"}
${isEnglish ? "- Answer questions about their events and schedule" : "- Responder preguntas sobre sus eventos y agenda"}
${isEnglish ? "- Suggest better times for meetings" : "- Sugerir mejores horarios para reuniones"}
${isEnglish ? "- Remind upcoming events" : "- Recordar eventos próximos"}
${isEnglish ? "- Give productivity and time-management tips" : "- Dar consejos de productividad y gestión del tiempo"}

${isEnglish ? "Whenever it makes sense, use tools to read or modify real events." : "Siempre que haga sentido, usa tools para consultar o modificar eventos reales."}
${isEnglish ? "Never invent IDs or tool results." : "No inventes IDs ni resultados de tools."}
${isEnglish ? "Respond in English and keep answers concise." : "Responde siempre en español y de forma concisa."}${eventsContext}`,
    messages: await convertToModelMessages(messages),
    tools: {
      getEventsForDate: tool({
        description: "Obtener eventos para una fecha específica",
        inputSchema: z.object({
          date: z.string().describe("Fecha en formato YYYY-MM-DD"),
        }),
        execute: async ({ date }) => {
          const eventsOnDate = await getEventsForDate(userId, date)
          return eventsOnDate.length > 0 ? eventsOnDate : { message: copy.noEventsForDate }
        },
      }),
      createEvent: tool({
        description: "Crear un evento en el calendario del usuario",
        inputSchema: z.object({
          title: z.string().min(1),
          eventDate: z.string().describe("Fecha YYYY-MM-DD"),
          startTime: z.string().describe("Hora inicio HH:MM"),
          endTime: z.string().describe("Hora fin HH:MM"),
          description: z.string().optional(),
          location: z.string().optional(),
          color: z.string().optional(),
          attendees: z.array(z.string()).optional(),
          organizer: z.string().optional(),
          allowConflict: z.boolean().optional(),
        }),
        execute: async ({ allowConflict, ...input }) => {
          const created = await createEventForUser(userId, input, allowConflict)
          if (!created.event) {
            return {
              success: false,
              message: copy.conflictDetected,
              conflicts: created.conflicts,
            }
          }

          return {
            success: true,
            event: created.event,
            conflicts: created.conflicts,
          }
        },
      }),
      updateEvent: tool({
        description: "Actualizar un evento existente por id",
        inputSchema: z.object({
          eventId: z.string().describe("ID del evento a modificar"),
          title: z.string().optional(),
          eventDate: z.string().optional(),
          startTime: z.string().optional(),
          endTime: z.string().optional(),
          description: z.string().nullable().optional(),
          location: z.string().nullable().optional(),
          color: z.string().optional(),
          attendees: z.array(z.string()).optional(),
          organizer: z.string().optional(),
          allowConflict: z.boolean().optional(),
        }),
        execute: async ({ eventId, allowConflict, ...changes }) => {
          const updated = await updateEventForUser(userId, eventId, changes, allowConflict)
          if (updated.notFound) {
            return { success: false, message: copy.noEventWithId }
          }
          if (!updated.event) {
            return {
              success: false,
              message: copy.conflictDetected,
              conflicts: updated.conflicts,
            }
          }

          return { success: true, event: updated.event, conflicts: updated.conflicts }
        },
      }),
      deleteEvent: tool({
        description: "Eliminar un evento existente por id",
        inputSchema: z.object({
          eventId: z.string().describe("ID del evento"),
        }),
        execute: async ({ eventId }) => {
          const ok = await deleteEventForUser(userId, eventId)
          return ok ? { success: true } : { success: false, message: copy.eventNotFound }
        },
      }),
      findConflicts: tool({
        description: "Buscar conflictos en un horario concreto",
        inputSchema: z.object({
          eventDate: z.string().describe("Fecha YYYY-MM-DD"),
          startTime: z.string().describe("Hora inicio HH:MM"),
          endTime: z.string().describe("Hora fin HH:MM"),
          excludeEventId: z.string().optional(),
        }),
        execute: async ({ eventDate, startTime, endTime, excludeEventId }) => {
          const conflicts = await findConflictsForUser(
            userId,
            eventDate,
            startTime,
            endTime,
            excludeEventId,
          )
          if (conflicts.length === 0) {
            return { hasConflicts: false, conflicts: [] }
          }
          return { hasConflicts: true, conflicts }
        },
      }),
    },
    abortSignal: req.signal,
  })

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    consumeSseStream: consumeStream,
  })
}
