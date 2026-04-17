/** Zona horaria para recordatorios y fecha “calendario” del día (variable de entorno). */
const TZ = process.env.EVENT_TIMEZONE || "Europe/Madrid"

export function eventDateInAppTimezone(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d)
}

export function todayInAppTimezone(): string {
  return eventDateInAppTimezone(new Date())
}
