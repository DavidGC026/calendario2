import type { CSSProperties } from "react"

/** Local date helpers (avoid TZ drift using noon UTC-safe strings). */

export const DAY_START_MIN = 7 * 60
export const DAY_END_MIN = 22 * 60
export const DAY_TOTAL_MIN = DAY_END_MIN - DAY_START_MIN

export function parseTimeToMinutes(t: string): number {
  const [h, m = "0"] = t.split(":")
  return Number(h) * 60 + Number(m)
}

/** Fecha calendario local YYYY-MM-DD (no usar toISOString: es UTC y desalinea columnas vs eventDate del API). */
export function formatISODateLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function getWeekDates(anchorISO: string): string[] {
  const d = new Date(`${anchorISO}T12:00:00`)
  const day = d.getDay()
  const start = new Date(d)
  start.setDate(d.getDate() - day)
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(start)
    x.setDate(start.getDate() + i)
    return formatISODateLocal(x)
  })
}

export function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + delta)
  return formatISODateLocal(d)
}

export function formatWeekRangeLabel(
  weekDates: string[],
  locale: string,
): string {
  if (weekDates.length < 2) return ""
  const start = new Date(`${weekDates[0]}T12:00:00`)
  const end = new Date(`${weekDates[6]}T12:00:00`)
  const o: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
  const y: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }
  if (start.getFullYear() !== end.getFullYear()) {
    return `${start.toLocaleDateString(locale, y)} – ${end.toLocaleDateString(locale, y)}`
  }
  if (start.getMonth() !== end.getMonth()) {
    return `${start.toLocaleDateString(locale, o)} – ${end.toLocaleDateString(locale, y)}`
  }
  return `${start.toLocaleDateString(locale, o)} – ${end.toLocaleDateString(locale, { day: "numeric" })}, ${end.getFullYear()}`
}

/**
 * Minutos transcurridos en el día local (0-1439). Útil para colocar la
 * línea "ahora" en la timeline.
 */
export function getCurrentDayMinutes(now: Date = new Date()): number {
  return now.getHours() * 60 + now.getMinutes()
}

/**
 * Devuelve el % vertical de un instante dentro de la timeline visible
 * (DAY_START_MIN..DAY_END_MIN). Devuelve `null` si está fuera del rango,
 * para que el llamador pueda decidir no renderizar la línea.
 */
export function minutesToTimelinePercent(minutes: number): number | null {
  if (minutes < DAY_START_MIN || minutes > DAY_END_MIN) return null
  return ((minutes - DAY_START_MIN) / DAY_TOTAL_MIN) * 100
}

/** Etiqueta corta HH:MM en 24h, sin localización (siempre estable). */
export function formatHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/**
 * Primer intervalo libre de `durationMin` (por defecto 60) en el día, sin
 * solapar eventos existentes. Así se pueden añadir varios eventos el mismo día
 * sin chocar con el slot por defecto 9:00–10:00.
 */
export function suggestNextFreeSlot(
  date: string,
  events: Iterable<{ eventDate: string; startTime: string; endTime: string }>,
  options?: { durationMin?: number },
): { startTime: string; endTime: string } {
  const durationMin = options?.durationMin ?? 60
  const dayStart = DAY_START_MIN
  const dayEnd = DAY_END_MIN

  const intervals = [...events]
    .filter((e) => e.eventDate === date)
    .map((e) => {
      const rawS = e.startTime.length >= 5 ? e.startTime.slice(0, 5) : e.startTime
      const rawE = e.endTime.length >= 5 ? e.endTime.slice(0, 5) : e.endTime
      let s = parseTimeToMinutes(rawS)
      let end = parseTimeToMinutes(rawE)
      if (Number.isNaN(s)) s = 9 * 60
      if (Number.isNaN(end) || end <= s) end = s + durationMin
      return { s, e: end }
    })
    .sort((a, b) => a.s - b.s)

  const overlaps = (startMin: number, endMin: number) =>
    intervals.some((iv) => startMin < iv.e && endMin > iv.s)

  for (let start = dayStart; start + durationMin <= dayEnd; start += 30) {
    const end = start + durationMin
    if (!overlaps(start, end)) {
      return { startTime: formatHHMM(start), endTime: formatHHMM(end) }
    }
  }
  return { startTime: "09:00", endTime: "10:00" }
}

/**
 * Color sólido (hex) correspondiente a la clase Tailwind del lane.
 * Útil para usar como `borderLeftColor` o tintes con alpha en estilos inline.
 */
export function accentHexForColor(color: string): string {
  switch (color) {
    case "bg-green-500":
      return "#22c55e"
    case "bg-orange-500":
      return "#f97316"
    case "bg-purple-500":
      return "#a855f7"
    case "bg-pink-500":
      return "#ec4899"
    case "bg-yellow-500":
      return "#eab308"
    case "bg-cyan-500":
      return "#06b6d4"
    case "bg-red-500":
      return "#ef4444"
    case "bg-violet-500":
      return "#8b5cf6"
    case "bg-blue-500":
    default:
      return "#3b82f6"
  }
}

export function eventBlockStyle(color: string): CSSProperties {
  const map: Record<string, string> = {
    "bg-blue-500": "linear-gradient(145deg, #3b82f6 0%, #2563eb 100%)",
    "bg-green-500": "linear-gradient(145deg, #22c55e 0%, #16a34a 100%)",
    "bg-orange-500": "linear-gradient(145deg, #f97316 0%, #ea580c 100%)",
    "bg-purple-500": "linear-gradient(145deg, #a855f7 0%, #9333ea 100%)",
    "bg-pink-500": "linear-gradient(145deg, #ec4899 0%, #db2777 100%)",
    "bg-yellow-500": "linear-gradient(145deg, #eab308 0%, #ca8a04 100%)",
    "bg-cyan-500": "linear-gradient(145deg, #06b6d4 0%, #0891b2 100%)",
    "bg-red-500": "linear-gradient(145deg, #ef4444 0%, #dc2626 100%)",
    "bg-violet-500": "linear-gradient(145deg, #8b5cf6 0%, #7c3aed 100%)",
  }
  return {
    background: map[color] ?? "linear-gradient(145deg, #6366f1 0%, #4f46e5 100%)",
    boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
  }
}
