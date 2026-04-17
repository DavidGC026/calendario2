import type { CSSProperties } from "react"

/** Local date helpers (avoid TZ drift using noon UTC-safe strings). */

export const DAY_START_MIN = 7 * 60
export const DAY_END_MIN = 22 * 60
export const DAY_TOTAL_MIN = DAY_END_MIN - DAY_START_MIN

export function parseTimeToMinutes(t: string): number {
  const [h, m = "0"] = t.split(":")
  return Number(h) * 60 + Number(m)
}

export function getWeekDates(anchorISO: string): string[] {
  const d = new Date(`${anchorISO}T12:00:00`)
  const day = d.getDay()
  const start = new Date(d)
  start.setDate(d.getDate() - day)
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(start)
    x.setDate(start.getDate() + i)
    return x.toISOString().slice(0, 10)
  })
}

export function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + delta)
  return d.toISOString().slice(0, 10)
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
