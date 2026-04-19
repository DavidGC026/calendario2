"use client"

import { useEffect, useRef, useState } from "react"

import {
  DAY_END_MIN,
  DAY_START_MIN,
  DAY_TOTAL_MIN,
  eventBlockStyle,
  formatHHMM,
  getCurrentDayMinutes,
  minutesToTimelinePercent,
  parseTimeToMinutes,
} from "@/lib/calendar-view-utils"

type CalEvent = {
  id: string
  title: string
  eventDate: string
  startTime: string
  endTime: string
  color: string
}

type CalendarWeekGridProps = {
  viewDates: string[]
  hourRows: number[]
  eventsByDate: Map<string, CalEvent[]>
  anchorDate: string
  today: string
  onEventClick: (e: CalEvent) => void
  formatHour: (h: number) => string
  /** Tap en una hora vacía. Solo se invoca en vista día (single day). */
  onCreateAtHour?: (date: string, hour: number) => void
  /** Swipe horizontal en vista día. delta = -1 (anterior) | +1 (siguiente). */
  onSwipeDay?: (delta: -1 | 1) => void
}

const SWIPE_THRESHOLD_PX = 50
const SWIPE_HORIZONTAL_RATIO = 1.5

export function CalendarWeekGrid({
  viewDates,
  hourRows,
  eventsByDate,
  anchorDate,
  today,
  onEventClick,
  formatHour,
  onCreateAtHour,
  onSwipeDay,
}: CalendarWeekGridProps) {
  const isSingleDay = viewDates.length === 1
  const isMobile = useIsMobile()
  const slotH = isSingleDay && isMobile ? 64 : 48
  const cols = isSingleDay ? "grid-cols-1" : "min-w-[640px] grid-cols-7"
  const overflowClass = isSingleDay
    ? "touch-pan-y overflow-x-hidden"
    : "touch-pan-x overflow-x-auto"

  const containerRef = useRef<HTMLDivElement | null>(null)
  const totalHeight = hourRows.length * slotH

  // --- Línea de "ahora" (solo si hoy está en viewDates) ---
  const showNow = viewDates.includes(today)
  const [nowMinutes, setNowMinutes] = useState(() => getCurrentDayMinutes())
  useEffect(() => {
    if (!showNow) return
    const tick = () => setNowMinutes(getCurrentDayMinutes())
    tick()
    const id = window.setInterval(tick, 60_000)
    return () => window.clearInterval(id)
  }, [showNow])
  const nowPct = minutesToTimelinePercent(nowMinutes)

  // --- Auto-scroll inicial en vista día ---
  useEffect(() => {
    if (!isSingleDay) return
    const node = containerRef.current
    if (!node) return
    const date = viewDates[0]
    let targetMinutes: number
    if (date === today) {
      targetMinutes = getCurrentDayMinutes()
    } else {
      const dayEvents = eventsByDate.get(date) ?? []
      const firstStart = dayEvents
        .map((e) => parseTimeToMinutes(e.startTime))
        .filter((m) => m >= DAY_START_MIN)
        .sort((a, b) => a - b)[0]
      targetMinutes = firstStart ?? 8 * 60
    }
    const clamped = Math.max(DAY_START_MIN, Math.min(DAY_END_MIN, targetMinutes))
    const ratio = (clamped - DAY_START_MIN) / DAY_TOTAL_MIN
    const targetTop = Math.max(0, ratio * totalHeight - node.clientHeight / 3)
    node.scrollTo({ top: targetTop, behavior: "auto" })
    // Solo cuando cambia el día visible o el dataset relevante
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSingleDay, viewDates[0], today, totalHeight])

  // --- Swipe horizontal en vista día ---
  const touchRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isSingleDay || !onSwipeDay) return
    const t = e.touches[0]
    touchRef.current = { x: t.clientX, y: t.clientY, time: Date.now() }
  }
  const onTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isSingleDay || !onSwipeDay) return
    const start = touchRef.current
    touchRef.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    const ax = Math.abs(dx)
    const ay = Math.abs(dy)
    if (ax < SWIPE_THRESHOLD_PX) return
    if (ax / Math.max(ay, 1) < SWIPE_HORIZONTAL_RATIO) return
    onSwipeDay(dx < 0 ? 1 : -1)
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className={`flex w-full rounded-2xl border border-white/15 bg-slate-950/60 md:bg-white/[0.07] [-webkit-overflow-scrolling:touch] md:backdrop-blur-xl md:min-h-[min(720px,85dvh)] ${overflowClass}`}
    >
      <div
        className="sticky left-0 z-20 w-12 shrink-0 border-r border-white/10 bg-slate-950/60 py-2 text-right text-[11px] font-medium tabular-nums text-white/55 sm:w-14 md:w-14"
        style={{ paddingTop: 40 }}
      >
        {hourRows.map((h) => (
          <div key={h} style={{ height: slotH }} className="pr-2 leading-none">
            {formatHour(h)}
          </div>
        ))}
      </div>
      <div className={`grid flex-1 gap-px ${cols}`}>
        {viewDates.map((date) => {
          const dayEvents = eventsByDate.get(date) ?? []
          const isToday = date === today
          const isAnchor = date === anchorDate
          const d = new Date(`${date}T12:00:00`)
          const wd = d.toLocaleDateString(undefined, { weekday: "short" })
          const dayNum = date.slice(8, 10)
          const allowTap = isSingleDay && Boolean(onCreateAtHour)
          return (
            <div
              key={date}
              className={`relative border-l border-white/10 first:border-l-0 ${
                isToday ? "bg-sky-500/10" : isAnchor ? "bg-white/[0.04]" : ""
              }`}
            >
              <div className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/70 px-1 py-2 text-center backdrop-blur-md">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">{wd}</p>
                <p
                  className={`text-lg font-semibold tabular-nums tracking-tight ${
                    isToday ? "text-sky-300" : "text-white/95"
                  }`}
                >
                  {Number(dayNum)}
                </p>
              </div>
              <div className="relative" style={{ height: totalHeight }}>
                {hourRows.map((h) => {
                  const baseClass = "block w-full border-b border-white/[0.06]"
                  if (allowTap) {
                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => onCreateAtHour?.(date, h)}
                        style={{ height: slotH }}
                        className={`${baseClass} text-left transition-colors active:bg-white/[0.06]`}
                        aria-label={`${formatHour(h)}`}
                      />
                    )
                  }
                  return (
                    <div
                      key={h}
                      style={{ height: slotH }}
                      className={baseClass}
                    />
                  )
                })}

                {isToday && nowPct !== null ? (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-30"
                    style={{ top: `${nowPct}%` }}
                  >
                    <div className="relative flex items-center">
                      <span className="absolute -left-1 h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,0.25)]" />
                      <span className="h-px w-full bg-rose-500/85" />
                      <span className="absolute -top-2 right-0.5 rounded-md bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white shadow">
                        {formatHHMM(nowMinutes)}
                      </span>
                    </div>
                  </div>
                ) : null}

                {dayEvents.map((ev) => {
                  const start = parseTimeToMinutes(ev.startTime)
                  const end = parseTimeToMinutes(ev.endTime)
                  const clampedStart = Math.max(start, DAY_START_MIN)
                  const clampedEnd = Math.min(Math.max(end, clampedStart + 15), DAY_END_MIN)
                  const top = ((clampedStart - DAY_START_MIN) / DAY_TOTAL_MIN) * 100
                  const height = ((clampedEnd - clampedStart) / DAY_TOTAL_MIN) * 100
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEventClick(ev)
                      }}
                      className="absolute left-1 right-1 z-20 overflow-hidden rounded-lg border-l-[4px] border-white/30 px-2 py-1 text-left text-[12px] font-semibold leading-tight text-white shadow-md transition hover:brightness-110"
                      style={{
                        top: `${top}%`,
                        height: `${Math.max(height, 3)}%`,
                        ...eventBlockStyle(ev.color),
                      }}
                    >
                      <span className="line-clamp-2 tracking-tight">{ev.title}</span>
                      <span className="mt-0.5 block text-[11px] font-normal tabular-nums text-white/90">
                        {ev.startTime} – {ev.endTime}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Hook simple para detectar viewport < md (768px), SSR-safe. */
function useIsMobile(breakpointPx: number = 768): boolean {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`)
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [breakpointPx])
  return isMobile
}
