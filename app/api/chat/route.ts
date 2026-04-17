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
  calendarLanePromptBlock,
  formatEventLineForContext,
  sanitizeCalendarColor,
} from "@/lib/calendar-lanes"
import { formatISODateLocal } from "@/lib/calendar-view-utils"
import {
  EventDTO,
  createEventForUser,
  deleteEventForUser,
  findConflictsForUser,
  getEventsForDate,
  listEventsForUser,
  updateEventForUser,
} from "@/lib/events"

function toolErr(err: unknown) {
  return { success: false as const, error: err instanceof Error ? err.message : String(err) }
}

export const maxDuration = 60

const calendarColorSchema = z
  .enum(["bg-blue-500", "bg-green-500", "bg-orange-500", "bg-purple-500"])
  .optional()
  .describe(
    "Calendario: bg-blue-500 Mi calendario, bg-green-500 Trabajo, bg-orange-500 Personal, bg-purple-500 Familia",
  )

async function messagesHaveImageParts(messages: UIMessage[]): Promise<boolean> {
  for (const m of messages) {
    if (m.role !== "user") continue
    for (const p of m.parts) {
      if (p.type === "file" && typeof p.mediaType === "string" && p.mediaType.startsWith("image/")) {
        return true
      }
    }
  }
  return false
}

export async function POST(req: Request) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return Response.json({ error: "No autenticado" }, { status: 401 })
  }

  const body = (await req.json()) as {
    messages: UIMessage[]
    locale?: "es" | "en"
    today?: string
  }
  const { messages, locale = "es", today: clientToday } = body
  const isEnglish = locale === "en"
  const todayIso =
    typeof clientToday === "string" && /^\d{4}-\d{2}-\d{2}$/.test(clientToday)
      ? clientToday
      : formatISODateLocal(new Date())
  const copy = {
    noEvents: isEnglish ? "The user has no scheduled events." : "El usuario no tiene eventos programados.",
    currentEvents: isEnglish ? "Current user events" : "Eventos actuales del usuario",
    conflictDetected: isEnglish ? "Schedule conflict detected" : "Conflicto de horario detectado",
    noEventsForDate: isEnglish ? "There are no events for this date" : "No hay eventos para esta fecha",
    noEventWithId: isEnglish ? "No event found with that id" : "No existe un evento con ese id",
    eventNotFound: isEnglish ? "Event not found" : "Evento no encontrado",
  }
  const [ty, tm, td] = todayIso.split("-").map(Number)
  const todayReadable = new Date(ty, (tm ?? 1) - 1, td ?? 1).toLocaleDateString(isEnglish ? "en-US" : "es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const userEvents: EventDTO[] = await listEventsForUser(userId)
  const eventsContext =
    userEvents.length > 0
      ? `\n\n${copy.currentEvents}:\n${userEvents.map((e) => formatEventLineForContext(e, isEnglish)).join("\n")}`
      : `\n\n${copy.noEvents}`

  const dateContext = isEnglish
    ? `\n\nToday's date is ${todayIso} (${todayReadable}). For tool calls, always use eventDate as YYYY-MM-DD. If the user gives a day and month without a year, choose the year that matches their intent relative to today (often the current year if that calendar date has not passed yet, or the upcoming occurrence they mean).`
    : `\n\nLa fecha de hoy es ${todayIso} (${todayReadable}). Para las tools usa siempre eventDate en formato YYYY-MM-DD. Si el usuario indica solo día y mes sin año, elige el año coherente con lo que pide respecto a hoy (por ejemplo el año actual si aún no pasó esa fecha este año, o el "próximo" 27 de abril que corresponda).`

  const hasImages = await messagesHaveImageParts(messages)
  const model = openai(hasImages ? "gpt-4o" : "gpt-4o-mini")

  const multimodalHint = isEnglish
    ? "\nThe user may send images (screenshots, photos, exported chat text). Read any text visible in images; extract dates/times/titles and use tools to create or update events. For pasted WhatsApp-style text, parse lines for day, time and title."
    : "\nEl usuario puede enviar imágenes (capturas, fotos, texto de chats exportado). Lee el texto visible en las imágenes; extrae fechas, horas y títulos y usa las tools para crear o editar eventos. Si pega texto tipo WhatsApp, interpreta líneas con día, hora y título."

  const result = streamText({
    model,
    system: `${isEnglish ? "You are a smart and friendly calendar assistant. You help users to:" : "Eres un asistente de calendario inteligente y amigable. Ayudas a los usuarios a:"}
${isEnglish ? "- Answer questions about their events and schedule" : "- Responder preguntas sobre sus eventos y agenda"}
${isEnglish ? "- Suggest better times for meetings" : "- Sugerir mejores horarios para reuniones"}
${isEnglish ? "- Remind upcoming events" : "- Recordar eventos próximos"}
${isEnglish ? "- Give productivity and time-management tips" : "- Dar consejos de productividad y gestión del tiempo"}

${isEnglish ? "Whenever it makes sense, use tools to read or modify real events." : "Siempre que haga sentido, usa tools para consultar o modificar eventos reales."}
${isEnglish ? "Never invent IDs or tool results." : "No inventes IDs ni resultados de tools."}
${isEnglish ? "When creating events, always pass endTime after startTime (HH:MM). If the user only gives a start time, set endTime to one hour later." : "Al crear eventos, pasa siempre endTime posterior a startTime (HH:MM). Si el usuario solo da hora de inicio (p. ej. «desde la 1 pm»), pon endTime una hora después de startTime."}
${calendarLanePromptBlock(isEnglish)}
${isEnglish ? "Respond in English and keep answers concise." : "Responde siempre en español y de forma concisa."}${multimodalHint}${dateContext}${eventsContext}`,
    messages: await convertToModelMessages(messages),
    tools: {
      getEventsForDate: tool({
        description: "Obtener eventos para una fecha específica",
        inputSchema: z.object({
          date: z.string().describe("Fecha en formato YYYY-MM-DD"),
        }),
        execute: async ({ date }) => {
          try {
            const eventsOnDate = await getEventsForDate(userId, date)
            return eventsOnDate.length > 0 ? eventsOnDate : { message: copy.noEventsForDate }
          } catch (e) {
            return toolErr(e)
          }
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
          color: calendarColorSchema,
          attendees: z.array(z.string()).optional(),
          organizer: z.string().optional(),
          allowConflict: z.boolean().optional(),
        }),
        execute: async ({ allowConflict, color, ...rest }) => {
          try {
            const input = { ...rest, color: sanitizeCalendarColor(color) }
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
          } catch (e) {
            return toolErr(e)
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
          color: calendarColorSchema,
          attendees: z.array(z.string()).optional(),
          organizer: z.string().optional(),
          allowConflict: z.boolean().optional(),
        }),
        execute: async ({ eventId, allowConflict, color, ...rest }) => {
          try {
            const changes = { ...rest, ...(color !== undefined ? { color: sanitizeCalendarColor(color) } : {}) }
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
          } catch (e) {
            return toolErr(e)
          }
        },
      }),
      deleteEvent: tool({
        description: "Eliminar un evento existente por id",
        inputSchema: z.object({
          eventId: z.string().describe("ID del evento"),
        }),
        execute: async ({ eventId }) => {
          try {
            const ok = await deleteEventForUser(userId, eventId)
            return ok ? { success: true } : { success: false, message: copy.eventNotFound }
          } catch (e) {
            return toolErr(e)
          }
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
          try {
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
          } catch (e) {
            return toolErr(e)
          }
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
