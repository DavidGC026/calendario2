import type { EventDTO } from "@/lib/events"

/** Clases Tailwind usadas en la UI; la IA debe usar solo estos valores en `color`. */
export const ALLOWED_CALENDAR_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-orange-500",
  "bg-purple-500",
] as const

export type CalendarLaneId = (typeof ALLOWED_CALENDAR_COLORS)[number]

const LANE_BY_ID: Record<CalendarLaneId, { es: string; en: string; aiHintEs: string }> = {
  "bg-blue-500": {
    es: "Mi calendario",
    en: "My calendar",
    aiHintEs: "general / por defecto",
  },
  "bg-green-500": {
    es: "Trabajo",
    en: "Work",
    aiHintEs: "reuniones laborales, oficina, clientes",
  },
  "bg-orange-500": {
    es: "Personal",
    en: "Personal",
    aiHintEs: "vida personal, hobbies, citas personales (no laborales)",
  },
  "bg-purple-500": {
    es: "Familia",
    en: "Family",
    aiHintEs: "familia, hijos, casa",
  },
}

export const CALENDAR_LANE_COLORS = [
  { id: "bg-blue-500" as const, key: "calPersonal" as const },
  { id: "bg-green-500" as const, key: "calWork" as const },
  { id: "bg-orange-500" as const, key: "calPrivate" as const },
  { id: "bg-purple-500" as const, key: "calFamily" as const },
] as const

export function isCalendarLaneId(v: string): v is CalendarLaneId {
  return (ALLOWED_CALENDAR_COLORS as readonly string[]).includes(v)
}

/** Solo acepta clases de carril válidas; si no, devuelve undefined (y el modelo usará el default en DB). */
export function sanitizeCalendarColor(v: string | undefined | null): CalendarLaneId | undefined {
  if (!v || typeof v !== "string") return undefined
  const t = v.trim()
  return isCalendarLaneId(t) ? t : undefined
}

export function laneLabel(locale: "es" | "en", laneId: string): string {
  if (isCalendarLaneId(laneId)) {
    return locale === "en" ? LANE_BY_ID[laneId].en : LANE_BY_ID[laneId].es
  }
  return laneId
}

/** Bloque para el system prompt de la IA (idioma mezclado: instrucciones en EN si isEnglish). */
export function calendarLanePromptBlock(isEnglish: boolean): string {
  if (isEnglish) {
    return `
Calendar lanes — you MUST set "color" on every createEvent / updateEvent call to EXACTLY one of:
- bg-green-500 — Work: meetings, office, clients, projects, deliverables, sprint/scrum/demo, deadline, interviews, calls with manager/colleagues, "meeting about <product/app/project>", trainings related to the job.
- bg-purple-500 — Family: birthdays of family members (parents, siblings, kids, grandparents, in-laws, partner), family dinners/lunches, picking kids up, school meetings, doctor for a family member, Christmas/Thanksgiving/etc., taking care of mom/dad.
- bg-orange-500 — Personal (non-work, non-family): gym, your own doctor/dentist, haircut, hobbies, friends, dates, personal courses, personal travel, banking errands, friends' birthdays.
- bg-blue-500 — "My calendar" (generic / default). ONLY use it when the user explicitly says so or after asking and the user replies "default / none".

Decision rules:
1. If keywords or context clearly point to ONE lane (e.g. "brother", "mom", "kids", "mother-in-law" → Family; "client", "sprint", "deploy", "the app" → Work; "gym", "dentist", "haircut" → Personal), use that lane WITHOUT asking.
2. If the event is ambiguous (e.g. just "appointment Friday 4pm", or "Ana's birthday" with no relationship clue), DO NOT call createEvent yet. First ask the user a single short question: "¿En qué calendario lo guardo: Trabajo, Personal o Familia?" / "Which calendar should I use: Work, Personal or Family?". Only after their reply, create the event with the right color.
3. NEVER fall back silently to bg-blue-500. Either infer with confidence or ask.

Examples:
- "Cumpleaños de mi hermano Benjamin" → bg-purple-500 (Family)
- "Reunión sobre la app móvil con el equipo" → bg-green-500 (Work)
- "Dentista el martes a las 10" → bg-orange-500 (Personal)
- "Cena con los suegros el sábado" → bg-purple-500 (Family)
- "Demo del sprint el viernes 4pm" → bg-green-500 (Work)
- "Cumple de Ana el 12 de mayo" (no relationship known) → ASK first.
- "Cita el viernes a las 5" (zero context) → ASK first.`
  }
  return `
Calendarios / colores — DEBES poner "color" en cada llamada a createEvent / updateEvent con EXACTAMENTE una de estas clases:
- bg-green-500 — Trabajo: reuniones laborales, oficina, clientes, proyectos, entregas, sprint/scrum/demo, deadlines, entrevistas, llamadas con jefe/colegas, "reunión sobre <producto/app/proyecto>", formaciones del trabajo.
- bg-purple-500 — Familia: cumpleaños de familiares (padres, hermanos, hijos, abuelos, suegros, pareja), comidas/cenas familiares, recoger a los niños, reuniones del cole, médico de un familiar, Navidad/Reyes/etc., cuidar de papá/mamá.
- bg-orange-500 — Personal (ni trabajo ni familia): gimnasio, médico/dentista propio, peluquería, hobbies, amigos, citas/parejas, cursos personales, viajes personales, gestiones bancarias, cumpleaños de amigos no familiares.
- bg-blue-500 — "Mi calendario" (genérico / por defecto). SOLO úsalo si el usuario lo pide explícitamente o si tras preguntar te dice "ninguno / por defecto".

Reglas de decisión:
1. Si el contexto o palabras clave apuntan claramente a UN lane (p. ej. "hermano", "mamá", "hijos", "suegra" → Familia; "cliente", "sprint", "deploy", "la app", "el proyecto" → Trabajo; "gimnasio", "dentista", "peluquería" → Personal), úsalo SIN preguntar.
2. Si el evento es ambiguo (p. ej. solo "cita el viernes a las 4" o "cumpleaños de Ana" sin saber si es amiga o familiar), NO llames a createEvent todavía. Pregunta UNA sola línea corta antes: "¿En qué calendario lo guardo: Trabajo, Personal o Familia?". Después de la respuesta del usuario, crea el evento con el color correcto.
3. NUNCA caigas en bg-blue-500 por defecto en silencio. O infieres con seguridad o preguntas.

Ejemplos:
- "Cumpleaños de mi hermano Benjamin" → bg-purple-500 (Familia)
- "Reunión sobre la app móvil con el equipo" → bg-green-500 (Trabajo)
- "Dentista el martes a las 10" → bg-orange-500 (Personal)
- "Cena con los suegros el sábado" → bg-purple-500 (Familia)
- "Demo del sprint el viernes 4pm" → bg-green-500 (Trabajo)
- "Cumple de Ana el 12 de mayo" (no se sabe quién es Ana) → PREGUNTAR primero.
- "Cita el viernes a las 5" (sin contexto) → PREGUNTAR primero.`
}

export function formatEventLineForContext(e: EventDTO, isEnglish: boolean): string {
  const lane = isCalendarLaneId(e.color)
    ? isEnglish
      ? LANE_BY_ID[e.color].en
      : LANE_BY_ID[e.color].es
    : e.color
  const tail = e.description ? `: ${e.description}` : ""
  const people =
    e.participants?.length > 0
      ? isEnglish
        ? ` (with ${e.participants.map((p) => p.name ?? p.email).join(", ")})`
        : ` (con ${e.participants.map((p) => p.name ?? p.email).join(", ")})`
      : ""
  const pid =
    e.participantUserIds?.length > 0 ? ` participantUserIds=[${e.participantUserIds.join(", ")}]` : ""
  const rem =
    e.emailRemindersEnabled === false
      ? isEnglish
        ? " | email reminders OFF"
        : " | recordatorios por correo desactivados"
      : e.reminderMinutesBefore
        ? isEnglish
          ? ` | reminder ${e.reminderMinutesBefore} min before`
          : ` | aviso ${e.reminderMinutesBefore} min antes`
        : ""
  return isEnglish
    ? `- id=${e.id} | ${e.title} on ${e.eventDate} from ${e.startTime} to ${e.endTime} [${lane}]${people}${pid}${rem}${tail}`
    : `- id=${e.id} | ${e.title} el ${e.eventDate} de ${e.startTime} a ${e.endTime} [${lane}]${people}${pid}${rem}${tail}`
}
