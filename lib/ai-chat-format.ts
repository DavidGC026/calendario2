import { laneLabel } from "@/lib/calendar-lanes"

export type Locale = "es" | "en"

/**
 * Cómo se lee en pantalla lo que hace el asistente.
 *
 * Antes salía el nombre de la herramienta tal cual —`createEvent`,
 * `searchContact`— en medio de la conversación. Eso es el nombre que le pusimos
 * los programadores, en inglés, y leerlo es como ver el registro del servidor
 * asomando por la interfaz. Aquí cada acción se dice en la voz de la aplicación
 * y en el tiempo verbal correcto: mientras pasa, en gerundio; cuando terminó, en
 * pasado, porque ya es un hecho en su agenda.
 */
const TOOL_COPY: Record<string, { es: [string, string]; en: [string, string] }> = {
  createEvent: { es: ["Creando el evento", "Evento creado"], en: ["Creating the event", "Event created"] },
  updateEvent: { es: ["Actualizando el evento", "Evento actualizado"], en: ["Updating the event", "Event updated"] },
  deleteEvent: { es: ["Eliminando el evento", "Evento eliminado"], en: ["Deleting the event", "Event deleted"] },
  getEventsForDate: { es: ["Consultando ese día", "Día consultado"], en: ["Checking that day", "Day checked"] },
  findConflicts: { es: ["Comprobando choques", "Horario comprobado"], en: ["Checking overlaps", "Schedule checked"] },
  searchContact: { es: ["Buscando en tus contactos", "Contactos revisados"], en: ["Searching your contacts", "Contacts searched"] },
  createContact: { es: ["Guardando el contacto", "Contacto guardado"], en: ["Saving the contact", "Contact saved"] },
  searchFriends: { es: ["Buscando entre tus amigos", "Amigos revisados"], en: ["Searching your friends", "Friends searched"] },
}

export function toolLabel(toolName: string, done: boolean, language: Locale): string {
  const copy = TOOL_COPY[toolName]
  if (!copy) return toolName
  return copy[language][done ? 1 : 0]
}

/** Las herramientas que cambian la agenda de verdad. Se muestran con más peso. */
export function toolMutates(toolName: string): boolean {
  return toolName === "createEvent" || toolName === "updateEvent" || toolName === "deleteEvent"
}

export type ChipEvent = {
  title: string
  eventDate: string
  startTime: string
  endTime: string
  color: string
}

/** El evento que dejó una herramienta, si dejó alguno, para pintarlo como ficha. */
export function eventFromToolOutput(output: unknown): ChipEvent | null {
  if (!output || typeof output !== "object") return null
  const o = output as Record<string, unknown>
  const ev = o.event
  if (!ev || typeof ev !== "object") return null
  const e = ev as Record<string, unknown>
  if (typeof e.title !== "string" || typeof e.eventDate !== "string") return null
  return {
    title: e.title,
    eventDate: e.eventDate,
    startTime: typeof e.startTime === "string" ? e.startTime : "",
    endTime: typeof e.endTime === "string" ? e.endTime : "",
    color: typeof e.color === "string" ? e.color : "bg-blue-500",
  }
}

/** "2026-08-26" → "mié 26 ago". El año solo cuando no es el corriente. */
export function readableDate(iso: string, language: Locale): string {
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return iso
  const date = new Date(y, m - 1, d)
  const sameYear = y === new Date().getFullYear()
  return date
    .toLocaleDateString(language === "es" ? "es-ES" : "en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      ...(sameYear ? {} : { year: "numeric" }),
    })
    .replace(/\.$/, "")
}

export function laneName(color: string, language: Locale): string {
  return laneLabel(language, color)
}

export function summarizeToolOutput(output: unknown, language: Locale): string {
  if (output === null || output === undefined) return ""
  if (typeof output !== "object") return String(output)
  const o = output as Record<string, unknown>
  if (o.success === false) {
    if (typeof o.error === "string") return o.error
    if (typeof o.message === "string") return o.message
    if (Array.isArray(o.conflicts) && o.conflicts.length > 0) {
      return language === "es" ? "Conflicto de horario con otros eventos." : "Schedule conflict with existing events."
    }
  }
  // Con evento no se resume en texto: se pinta la ficha, que dice lo mismo y
  // además enseña a qué calendario fue.
  if (o.success === true && o.event) return ""
  if (o.success === true && !o.event) {
    return language === "es" ? "Hecho." : "Done."
  }
  if ("message" in o && typeof o.message === "string") return o.message
  if ("hasConflicts" in o) {
    return language === "es"
      ? o.hasConflicts
        ? "Hay solapamientos en ese horario."
        : "Sin conflictos en ese horario."
      : o.hasConflicts
        ? "Overlaps found."
        : "No overlaps."
  }
  if ("matchCount" in o && typeof o.matchCount === "number") {
    const n = o.matchCount
    return language === "es"
      ? n === 0
        ? "Sin coincidencias."
        : `${n} coincidencia${n === 1 ? "" : "s"}.`
      : n === 0
        ? "No matches."
        : `${n} match${n === 1 ? "" : "es"}.`
  }
  if (Array.isArray(output)) {
    return language === "es" ? `${output.length} eventos.` : `${output.length} events.`
  }
  return ""
}
