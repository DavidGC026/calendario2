import {
  consumeStream,
  convertToModelMessages,
  stepCountIs,
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
  CONTACT_CATEGORIES,
  categoryLabel,
  categoryToLane,
  createContact,
  isContactCategory,
  listContacts,
  searchContacts,
  type ContactCategory,
} from "@/lib/contacts"
import {
  EventDTO,
  createEventForUser,
  deleteEventForUser,
  findConflictsForUser,
  getEventsForDate,
  listEventsForUser,
  updateEventForUser,
} from "@/lib/events"
import {
  runNotifyEventCreated,
  runNotifyEventDeleted,
  runNotifyEventUpdated,
} from "@/lib/event-notifications"
import { listFriends, searchFriendsByHint } from "@/lib/friends"
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit"

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

  // 30 mensajes/min por usuario (incluye reintentos por tool steps).
  const rl = rateLimit(`chat:${userId}`, 30, 60_000)
  if (!rl.allowed) {
    return rateLimitResponse(rl, "Estás enviando demasiados mensajes a la IA. Espera unos segundos.")
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

  const friends = await listFriends(userId)
  const friendsContext = isEnglish
    ? friends.length > 0
      ? `\n\nFriends in the app (to invite someone you MUST pass their user id in participantUserIds in createEvent/updateEvent — copying only a name into "attendees" does NOT invite them or email them):\n${friends.map((f) => `- userId=${f.id} — ${f.name ?? "(no name)"} <${f.email}>`).join("\n")}`
      : `\n\nThe user has no friends in the app yet; you cannot set participantUserIds.`
    : friends.length > 0
      ? `\n\nAmigos en la app (para invitar a alguien DEBES poner su userId en participantUserIds en createEvent o updateEvent; poner solo el nombre en "attendees" o en el título NO lo añade como participante ni envía correos):\n${friends.map((f) => `- userId=${f.id} — ${f.name ?? "(sin nombre)"} <${f.email}>`).join("\n")}`
      : `\n\nEl usuario aún no tiene amigos en la app; no puedes usar participantUserIds.`

  const contacts = await listContacts(userId)
  const contactsContext = isEnglish
    ? contacts.length > 0
      ? `\n\nKnown contacts (use them to infer the calendar lane when an event mentions a person; categories: FAMILY → bg-purple-500, WORK → bg-green-500, FRIEND → bg-orange-500, OTHER → bg-blue-500):\n${contacts.map((c) => `- ${c.name} [${c.category}${c.relation ? `, ${c.relation}` : ""}]`).join("\n")}`
      : `\n\nThe user has no saved contacts yet.`
    : contacts.length > 0
      ? `\n\nContactos conocidos del usuario (úsalos para inferir el calendario cuando un evento mencione a una persona; categorías: FAMILY → bg-purple-500, WORK → bg-green-500, FRIEND → bg-orange-500, OTHER → bg-blue-500):\n${contacts.map((c) => `- ${c.name} [${c.category}${c.relation ? `, ${c.relation}` : ""}]`).join("\n")}`
      : `\n\nEl usuario aún no tiene contactos guardados.`

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
${isEnglish ? "Use event id from the list above for updateEvent/deleteEvent." : "Para updateEvent o deleteEvent usa el id=... de cada línea de evento."}
${isEnglish ? "When changing participants, participantUserIds must include every friend who should stay on the event (merge existing ids from the event line with new ones)." : "Si cambias participantes, participantUserIds debe incluir todos los amigos que deben quedar en el evento (mezcla los participantUserIds que ya aparecen en la línea del evento con los nuevos)."}
${isEnglish ? "You may use participantNameHints with a friend's name (e.g. \"Jose David\") instead of IDs; the server resolves names to user ids." : "Puedes usar participantNameHints con el nombre del amigo (p. ej. «José David») además o en lugar de participantUserIds; el servidor resuelve el nombre contra la lista de amigos."}
${isEnglish ? "Before inviting someone by name only, call searchFriends with that name: 0 matches → say no friend matched and ask them to paste the exact userId from the friends list above, or fix friendship; 2+ matches → list options and ask which one or for userId; 1 match → use that userId." : "Antes de invitar solo por nombre, llama a searchFriends con ese texto: 0 coincidencias → di que no hay amigo con ese nombre y pide el userId exacto de la lista de arriba o que compruebe la amistad; 2+ → enumera opciones (userId, nombre, email) y pide que aclare o el userId; 1 → usa ese userId en el evento."}

${isEnglish ? "PERSON-AWARE LANE INFERENCE (Contacts feature):" : "INFERENCIA DE CALENDARIO POR PERSONA (Contactos):"}
${isEnglish
  ? `When an event mentions a person by name (e.g. "birthday of Benjamin", "lunch with Pedro", "meeting with Ana"), follow this exact flow BEFORE calling createEvent/updateEvent:
1. Call the tool searchContact({ name: "<person>" }).
2. If a contact is found → use its categoryLane as the event "color" and proceed to createEvent. You can also briefly mention "lo guardo en <Family/Work/...> porque <Name> está en tus contactos como <CATEGORY>".
3. If NO contact is found and you cannot infer the lane confidently from the title alone → ask the user one short question: "Veo que mencionas a <Name>. ¿Quieres que lo guarde como contacto regular? Si sí, ¿en qué categoría: Familia, Amigo, Trabajo u Otro?". Wait for the reply.
4. Once the user answers:
   - If they say add it (e.g. "sí, familiar", "amigo", "trabajo"), call createContact({ name, category, relation? }) BEFORE createEvent. Use the returned categoryLane as the event color.
   - If they say no, just create the event with the lane you can best infer (or ask for the lane explicitly).
5. NEVER invent contacts; only persist via the createContact tool.`
  : `Cuando un evento mencione a una persona por nombre (p. ej. «cumpleaños de Benjamin», «comida con Pedro», «reunión con Ana»), sigue EXACTAMENTE este flujo ANTES de llamar a createEvent o updateEvent:
1. Llama a la tool searchContact({ name: "<persona>" }).
2. Si encuentra un contacto → usa su categoryLane como "color" del evento y continúa con createEvent. Puedes mencionar brevemente «lo guardo en <Familia/Trabajo/...> porque <Nombre> está en tus contactos como <CATEGORÍA>».
3. Si NO encuentra contacto y NO puedes inferir el lane con seguridad solo por el título → pregunta una sola línea corta al usuario: «Veo que mencionas a <Nombre>. ¿Quieres que lo guarde como contacto regular? Si sí, ¿en qué categoría: Familia, Amigo, Trabajo u Otro?». Espera la respuesta.
4. Cuando el usuario responda:
   - Si dice que sí (p. ej. «sí, familiar», «amigo», «trabajo»), llama a createContact({ name, category, relation? }) ANTES que createEvent. Usa el categoryLane devuelto como color del evento.
   - Si dice que no, crea el evento con el lane que mejor puedas inferir (o pregunta explícitamente por el lane).
5. NUNCA te inventes contactos; solo se guardan llamando a la tool createContact.`}

${isEnglish ? "EMAIL REMINDERS:" : "RECORDATORIOS POR CORREO:"}
${isEnglish
  ? `Use emailRemindersEnabled (boolean, default true). If false, NO reminder emails are sent for that event (neither the 8:00 AM same-day email nor the "X minutes before" email).
Every event with emailRemindersEnabled true gets an automatic email at 8:00 AM the day it happens, plus an optional extra reminder "X minutes before" the start.
Allowed values for reminderMinutesBefore: null (no extra reminder), 5, 15, 30, 60, 120, 1440 (= 1 day before).
Behaviour for createEvent / updateEvent:
1. If the user says they want NO emails ("sin recordatorios", "no me mandes correos", "desactiva avisos"), set emailRemindersEnabled: false and reminderMinutesBefore: null.
2. If the user explicitly says when to remind ("avísame 30 min antes", "recuérdamelo 1 día antes"), set reminderMinutesBefore accordingly, keep emailRemindersEnabled true, and DO NOT ask again.
3. Otherwise, after creating the event, ask ONE short question about extra advance reminder OR no emails. Then call updateEvent with reminderMinutesBefore and/or emailRemindersEnabled.
4. If the user just answers a duration ("media hora", "una hora antes"), translate to minutes and pick the closest allowed value.
5. For an event already in the past or starting in less than 5 minutes, do not ask and leave reminderMinutesBefore as null.`
  : `Usa emailRemindersEnabled (boolean, por defecto true). Si es false, NO se envían correos de recordatorio para ese evento (ni el de las 8:00 del día ni el de «X minutos antes»).
Con emailRemindersEnabled true, el usuario recibe un correo el día del evento (~8:00) y puede añadir un aviso extra «X minutos antes» del inicio.
Valores para reminderMinutesBefore: null (sin aviso extra), 5, 15, 30, 60, 120, 1440 (= 1 día antes).
Comportamiento al usar createEvent o updateEvent:
1. Si el usuario dice que NO quiere correos («sin recordatorios», «no me mandes correos», «quita los avisos»), pon emailRemindersEnabled: false y reminderMinutesBefore: null.
2. Si indica explícitamente cuándo avisar («avísame 30 min antes», «recuérdamelo 1 día antes»), pon reminderMinutesBefore, deja emailRemindersEnabled en true y NO vuelvas a preguntar.
3. Si no lo indica, después de crear el evento pregunta UNA línea corta sobre aviso extra o si prefiere sin correos. Luego llama a updateEvent con reminderMinutesBefore y/o emailRemindersEnabled.
4. Si responde solo con una duración («media hora», «una hora antes»), conviértela a minutos y usa el valor permitido más cercano.
5. Si el evento ya pasó o empieza en menos de 5 minutos, no preguntes y deja reminderMinutesBefore en null.`}

${isEnglish ? "Respond in English and keep answers concise." : "Responde siempre en español y de forma concisa."}${multimodalHint}${dateContext}${eventsContext}${friendsContext}${contactsContext}`,
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
      searchFriends: tool({
        description: isEnglish
          ? "Search accepted friends by name or email fragment. Use BEFORE inviting by name: 0 matches ask for userId; several matches ask which one."
          : "Buscar amigos aceptados por nombre o parte del email. Usar ANTES de invitar por nombre: 0 resultados pedir userId; varios pedir cuál.",
        inputSchema: z.object({
          nameOrEmailHint: z
            .string()
            .min(2)
            .describe(isEnglish ? "Name or email fragment to search" : "Nombre o fragmento de correo a buscar"),
        }),
        execute: async ({ nameOrEmailHint }) => {
          try {
            const matches = await searchFriendsByHint(userId, nameOrEmailHint)
            return {
              matchCount: matches.length,
              matches: matches.map((m) => ({
                userId: m.id,
                name: m.name,
                email: m.email,
              })),
            }
          } catch (e) {
            return toolErr(e)
          }
        },
      }),
      searchContact: tool({
        description: isEnglish
          ? "Look up a saved contact by name to infer the calendar lane (Family/Friend/Work/Other). Call this BEFORE createEvent whenever the user mentions a person by name."
          : "Buscar un contacto guardado por nombre para inferir el calendario (Familia/Amigo/Trabajo/Otro). Llama a esta tool ANTES de createEvent siempre que el usuario mencione a una persona por nombre.",
        inputSchema: z.object({
          name: z
            .string()
            .min(2)
            .describe(isEnglish ? "Person name to search (e.g. \"Benjamin\")" : "Nombre de la persona a buscar (p. ej. «Benjamin»)"),
        }),
        execute: async ({ name }) => {
          try {
            const matches = await searchContacts(userId, name)
            return {
              matchCount: matches.length,
              matches: matches.map((c) => ({
                id: c.id,
                name: c.name,
                category: c.category,
                categoryLabel: categoryLabel(c.category, isEnglish ? "en" : "es"),
                categoryLane: categoryToLane(c.category),
                relation: c.relation,
              })),
            }
          } catch (e) {
            return toolErr(e)
          }
        },
      }),
      createContact: tool({
        description: isEnglish
          ? "Save a new contact for this user with a category. Use it when the user agrees to add a mentioned person as a regular contact. Returns the contact and its categoryLane (use that as the event color)."
          : "Guardar un nuevo contacto del usuario con una categoría. Úsala cuando el usuario acepte añadir a una persona mencionada como contacto regular. Devuelve el contacto y su categoryLane (úsala como color del evento).",
        inputSchema: z.object({
          name: z.string().min(1).describe(isEnglish ? "Contact name" : "Nombre del contacto"),
          category: z
            .enum(CONTACT_CATEGORIES as unknown as [string, ...string[]])
            .describe(
              isEnglish
                ? "FAMILY (Family/purple), FRIEND (Friend/orange-Personal), WORK (Work/green), OTHER (default/blue)"
                : "FAMILY (Familia/morado), FRIEND (Amigo/naranja-Personal), WORK (Trabajo/verde), OTHER (Otro/azul)",
            ),
          relation: z
            .string()
            .optional()
            .describe(
              isEnglish
                ? "Optional free-text relation (e.g. \"brother\", \"colleague\", \"college friend\")"
                : "Relación opcional en texto libre (p. ej. «hermano», «compañero», «amiga de la uni»)",
            ),
        }),
        execute: async ({ name, category, relation }) => {
          try {
            if (!isContactCategory(category)) {
              return { success: false, error: "Categoría inválida" }
            }
            const result = await createContact(userId, {
              name,
              category: category as ContactCategory,
              relation: relation ?? null,
            })
            if (!result.ok) {
              return { success: false, error: result.error }
            }
            return {
              success: true,
              contact: {
                id: result.contact.id,
                name: result.contact.name,
                category: result.contact.category,
                categoryLabel: categoryLabel(result.contact.category, isEnglish ? "en" : "es"),
                categoryLane: categoryToLane(result.contact.category),
                relation: result.contact.relation,
              },
            }
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
          attendees: z.array(z.string()).optional().describe("Etiquetas de texto; no invita amigos"),
          participantUserIds: z
            .array(z.string())
            .optional()
            .describe(
              "IDs de la lista de amigos (userId=...). Si no los tienes claros, usa participantNameHints.",
            ),
          participantNameHints: z
            .array(z.string())
            .optional()
            .describe(
              "Nombres de amigos a invitar (p. ej. «José David»); se resuelven contra tu lista de amigos. Puedes usar esto en lugar de participantUserIds.",
            ),
          organizer: z.string().optional(),
          reminderMinutesBefore: z
            .union([z.literal(5), z.literal(15), z.literal(30), z.literal(60), z.literal(120), z.literal(1440)])
            .nullable()
            .optional()
            .describe(
              isEnglish
                ? "Extra email reminder in minutes before the start. Allowed: null (none), 5, 15, 30, 60, 120, 1440. Only set if the user explicitly asked for it."
                : "Aviso por correo X minutos antes del inicio. Valores: null (ninguno), 5, 15, 30, 60, 120, 1440. Pónlo solo si el usuario lo pidió explícitamente.",
            ),
          emailRemindersEnabled: z
            .boolean()
            .optional()
            .describe(
              isEnglish
                ? "If false, no reminder emails for this event. Default true."
                : "Si es false, no se envían recordatorios por correo para este evento. Por defecto true.",
            ),
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

            await runNotifyEventCreated(userId, created.event)

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
          attendees: z.array(z.string()).optional().describe("Etiquetas; no invita amigos"),
          participantUserIds: z
            .array(z.string())
            .optional()
            .describe("IDs de amigos que deben quedar en el evento al reemplazar la lista"),
          participantNameHints: z
            .array(z.string())
            .optional()
            .describe("Añade o resuelve amigos por nombre; se fusionan con la lista actual si no pasas participantUserIds"),
          organizer: z.string().optional(),
          reminderMinutesBefore: z
            .union([z.literal(5), z.literal(15), z.literal(30), z.literal(60), z.literal(120), z.literal(1440)])
            .nullable()
            .optional()
            .describe(
              isEnglish
                ? "Extra email reminder in minutes before the start. Allowed: null (none), 5, 15, 30, 60, 120, 1440."
                : "Aviso por correo X minutos antes del inicio. Valores: null (ninguno), 5, 15, 30, 60, 120, 1440.",
            ),
          emailRemindersEnabled: z
            .boolean()
            .optional()
            .describe(
              isEnglish
                ? "If false, no reminder emails for this event."
                : "Si es false, no se envían recordatorios por correo para este evento.",
            ),
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

            await runNotifyEventUpdated(userId, updated.event)

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
            const deletedDto = await deleteEventForUser(userId, eventId)
            if (!deletedDto) {
              return { success: false, message: copy.eventNotFound }
            }
            await runNotifyEventDeleted(userId, deletedDto)
            return { success: true }
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
    // Permitir varias iteraciones: searchContact → (createContact) → createEvent → respuesta final.
    // Sin esto, streamText se detiene tras 1 step y el modelo no responde nada después de la primera tool.
    stopWhen: stepCountIs(8),
  })

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    consumeSseStream: consumeStream,
  })
}
