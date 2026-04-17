"use client"

import {
  DAY_END_MIN,
  DAY_START_MIN,
  DAY_TOTAL_MIN,
  eventBlockStyle,
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
}

export function CalendarWeekGrid({
  viewDates,
  hourRows,
  eventsByDate,
  anchorDate,
  today,
  onEventClick,
  formatHour,
}: CalendarWeekGridProps) {
  const slotH = 48
  const cols = viewDates.length === 1 ? "grid-cols-1" : "min-w-[640px] grid-cols-7"

  return (
    <div className="flex min-h-[720px] w-full overflow-x-auto rounded-2xl border border-white/15 bg-white/[0.07] backdrop-blur-xl">
      <div
        className="sticky left-0 z-20 w-14 shrink-0 border-r border-white/10 bg-slate-950/40 py-2 text-right text-[11px] text-white/45"
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
          return (
            <div
              key={date}
              className={`relative border-l border-white/10 first:border-l-0 ${
                isToday ? "bg-sky-500/10" : isAnchor ? "bg-white/[0.04]" : ""
              }`}
            >
              <div className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/50 px-1 py-2 text-center backdrop-blur-md">
                <p className="text-[10px] font-medium uppercase tracking-wide text-white/50">{wd}</p>
                <p
                  className={`text-lg font-semibold ${
                    isToday ? "text-sky-300" : "text-white/90"
                  }`}
                >
                  {Number(dayNum)}
                </p>
              </div>
              <div className="relative" style={{ height: hourRows.length * slotH }}>
                {hourRows.map((h) => (
                  <div
                    key={h}
                    style={{ height: slotH }}
                    className="border-b border-white/[0.06]"
                  />
                ))}
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
                      onClick={() => onEventClick(ev)}
                      className="absolute left-0.5 right-0.5 overflow-hidden rounded-lg border border-white/20 px-1.5 py-1 text-left text-[11px] font-medium leading-tight text-white shadow-md transition hover:brightness-110"
                      style={{
                        top: `${top}%`,
                        height: `${Math.max(height, 3)}%`,
                        ...eventBlockStyle(ev.color),
                      }}
                    >
                      <span className="line-clamp-2">{ev.title}</span>
                      <span className="block text-[10px] font-normal text-white/90">
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
