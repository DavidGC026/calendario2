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
Calendar lanes (you MUST set "color" to exactly one of these Tailwind class strings when creating or updating events):
- bg-blue-500 — "My calendar" (default / general)
- bg-green-500 — Work (job, meetings, office)
- bg-orange-500 — Personal (non-work personal life)
- bg-purple-500 — Family (family, kids, home)

Infer the best lane from context. If unclear, use bg-blue-500.`
  }
  return `
Calendarios / colores (debes rellenar "color" con EXACTAMENTE una de estas clases Tailwind al crear o editar eventos):
- bg-blue-500 — Mi calendario (general / por defecto)
- bg-green-500 — Trabajo (reuniones laborales, oficina, clientes)
- bg-orange-500 — Personal (vida personal, no laboral)
- bg-purple-500 — Familia (familia, hijos, casa)

Elige el calendario según el contexto. Si no está claro, usa bg-blue-500.`
}

export function formatEventLineForContext(e: EventDTO, isEnglish: boolean): string {
  const lane = isCalendarLaneId(e.color)
    ? isEnglish
      ? LANE_BY_ID[e.color].en
      : LANE_BY_ID[e.color].es
    : e.color
  const tail = e.description ? `: ${e.description}` : ""
  return isEnglish
    ? `- ${e.title} on ${e.eventDate} from ${e.startTime} to ${e.endTime} [${lane}]${tail}`
    : `- ${e.title} el ${e.eventDate} de ${e.startTime} a ${e.endTime} [${lane}]${tail}`
}
