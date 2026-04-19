import type { EventDTO } from "@/lib/events"

/** Escapa según RFC 5545 (comas, puntos y comas, barras y saltos de línea). */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "")
}

/** Convierte "YYYY-MM-DD" + "HH:MM" en formato local floating "YYYYMMDDTHHMMSS". */
function toIcsLocal(date: string, time: string): string {
  const [y, m, d] = date.split("-")
  const [h, mi] = time.split(":")
  return `${y}${m}${d}T${h}${mi}00`
}

/** Líneas largas plegadas a 75 octetos como exige RFC 5545 ("line folding"). */
function foldLine(line: string): string {
  if (line.length <= 75) return line
  const parts: string[] = []
  let i = 0
  while (i < line.length) {
    const chunkLen = i === 0 ? 75 : 74
    parts.push((i === 0 ? "" : " ") + line.slice(i, i + chunkLen))
    i += chunkLen
  }
  return parts.join("\r\n")
}

/**
 * Genera un calendario .ics válido (RFC 5545) con los eventos del usuario.
 * Las horas se emiten como "floating local time" para no obligar al cliente
 * a interpretar zonas horarias. Apple Calendar y Google Calendar lo aceptan.
 */
export function buildIcsCalendar(events: EventDTO[], options: { calendarName: string; productId?: string }): string {
  const now = new Date()
  const dtstamp =
    now.getUTCFullYear().toString() +
    String(now.getUTCMonth() + 1).padStart(2, "0") +
    String(now.getUTCDate()).padStart(2, "0") +
    "T" +
    String(now.getUTCHours()).padStart(2, "0") +
    String(now.getUTCMinutes()).padStart(2, "0") +
    String(now.getUTCSeconds()).padStart(2, "0") +
    "Z"

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${options.productId ?? "Calendario inteligente"}//ES`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(options.calendarName)}`,
  ]

  for (const ev of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.id}@calendario.dvguzman.com`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${toIcsLocal(ev.eventDate, ev.startTime)}`,
      `DTEND:${toIcsLocal(ev.eventDate, ev.endTime)}`,
      `SUMMARY:${escapeIcsText(ev.title)}`,
    )
    if (ev.description) lines.push(`DESCRIPTION:${escapeIcsText(ev.description)}`)
    if (ev.location) lines.push(`LOCATION:${escapeIcsText(ev.location)}`)
    if (ev.organizer) lines.push(`ORGANIZER;CN=${escapeIcsText(ev.organizer)}:mailto:noreply@calendario.dvguzman.com`)
    for (const p of ev.participants) {
      const cn = p.name ?? p.email
      lines.push(`ATTENDEE;CN=${escapeIcsText(cn)}:mailto:${p.email}`)
    }
    lines.push("END:VEVENT")
  }

  lines.push("END:VCALENDAR")
  return lines.map(foldLine).join("\r\n") + "\r\n"
}
