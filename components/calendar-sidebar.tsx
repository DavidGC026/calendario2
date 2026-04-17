"use client"

import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"

export type CalendarCell = {
  date: string
  dayNumber: number
  inCurrentMonth: boolean
}

type CalendarEvent = {
  id: string
  title: string
  location: string
  eventDate: string
  startTime: string
  endTime: string
  color?: string
  attendees?: string[]
  participants?: { id: string; name: string | null; email: string }[]
}

const CALENDAR_LANE_COLORS = [
  { id: "bg-blue-500", key: "calPersonal" as const },
  { id: "bg-green-500", key: "calWork" as const },
  { id: "bg-orange-500", key: "calPrivate" as const },
  { id: "bg-purple-500", key: "calFamily" as const },
] as const

type T = Record<string, string>

type CalendarSidebarProps = {
  t: T
  glassPanel: string
  glassInset: string
  today: string
  monthLabel: string
  calendarCells: CalendarCell[]
  eventsByDate: Map<string, CalendarEvent[]>
  anchorDate: string
  onSelectDay: (iso: string) => void
  onGoToday: () => void
  moveMonth: (delta: number) => void
  canGoPrevMonth: boolean
  canGoNextMonth: boolean
  laneOn: Record<string, boolean>
  setLaneOn: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  onCreate: () => void
  createLabel: string
  brandCalendar: string
  loadingEvents: boolean
  visibleEvents: CalendarEvent[]
  onEdit: (e: CalendarEvent) => void
  onDelete: (id: string) => void
  listScopeLabel: string
  /** En el drawer móvil el scroll va en el contenedor exterior; sin flex-1 para que la lista no quede con altura 0. */
  mobileDrawer?: boolean
}

export function CalendarSidebarContent({
  t,
  glassPanel,
  glassInset,
  today,
  monthLabel,
  calendarCells,
  eventsByDate,
  anchorDate,
  onSelectDay,
  onGoToday,
  moveMonth,
  canGoPrevMonth,
  canGoNextMonth,
  laneOn,
  setLaneOn,
  onCreate,
  createLabel,
  brandCalendar,
  loadingEvents,
  visibleEvents,
  onEdit,
  onDelete,
  listScopeLabel,
  mobileDrawer = false,
}: CalendarSidebarProps) {
  return (
    <div
      className={
        mobileDrawer
          ? "flex flex-col gap-4"
          : "flex h-full min-h-0 flex-col gap-4"
      }
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-sky-300" />
          <span className="text-lg font-semibold tracking-tight text-white">{brandCalendar}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onCreate}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-900/40 transition hover:opacity-95"
      >
        <Plus className="h-5 w-5" />
        {createLabel}
      </button>

      <div className={`${glassInset} min-h-0 shrink-0 p-3`}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-white/60">{t.miniCalendar}</h2>
          <button
            type="button"
            onClick={onGoToday}
            className="rounded-lg bg-sky-500/30 px-2 py-1 text-xs font-medium text-sky-100 ring-1 ring-sky-400/30 transition hover:bg-sky-500/40"
          >
            {t.goToday}
          </button>
        </div>
        <p className="mb-2 text-center text-sm font-medium capitalize text-white/90">{monthLabel}</p>
        <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] text-white/45">
          {t.weekdays.map((d) => (
            <span key={d}>{d.slice(0, 1)}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {calendarCells.map((cell) => {
            if (!cell.inCurrentMonth) {
              return <div key={cell.date} className="aspect-square min-h-[1.75rem]" />
            }
            const hasEvents = (eventsByDate.get(cell.date)?.length ?? 0) > 0
            const isSelected = anchorDate === cell.date
            const isTodayCell = cell.date === today
            return (
              <button
                type="button"
                key={cell.date}
                onClick={() => onSelectDay(cell.date)}
                className={`relative flex aspect-square min-h-[1.75rem] items-center justify-center rounded-lg text-[11px] font-medium transition ${
                  isSelected
                    ? "bg-sky-500/50 text-white ring-2 ring-sky-300/90"
                    : isTodayCell
                      ? "bg-white/20 text-white ring-2 ring-sky-400/70"
                      : "text-white/85 hover:bg-white/12"
                }`}
              >
                {cell.dayNumber}
                {hasEvents ? (
                  <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-sky-300 shadow-[0_0_6px_rgba(125,211,252,0.9)]" />
                ) : null}
              </button>
            )
          })}
        </div>
        <div className="mt-3 flex justify-center gap-2 border-t border-white/10 pt-3">
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            disabled={!canGoPrevMonth}
            className="rounded-lg border border-white/20 p-1.5 text-white/80 disabled:opacity-35"
            aria-label={t.prevMonth}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => moveMonth(1)}
            disabled={!canGoNextMonth}
            className="rounded-lg border border-white/20 p-1.5 text-white/80 disabled:opacity-35"
            aria-label={t.nextMonth}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/15 bg-white/[0.06] p-3 backdrop-blur-md">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/55">{t.myCalendars}</p>
        <ul className="space-y-2">
          {CALENDAR_LANE_COLORS.map(({ id, key }) => (
            <li key={id} className="flex items-center gap-2">
              <Checkbox
                id={id}
                checked={laneOn[id] ?? false}
                onCheckedChange={(c) => setLaneOn((prev) => ({ ...prev, [id]: c === true }))}
                className="border-white/40 data-[state=checked]:bg-sky-500 data-[state=checked]:border-sky-400"
              />
              <label htmlFor={id} className="flex flex-1 cursor-pointer items-center gap-2 text-sm text-white/85">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${id}`} />
                {t[key]}
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div
        className={`${glassPanel} flex flex-col p-3 ${
          mobileDrawer ? "" : "min-h-0 flex-1 overflow-hidden"
        }`}
      >
        <h2 className="shrink-0 text-sm font-semibold text-white">{t.eventsPanel}</h2>
        <p className="mb-2 shrink-0 text-[10px] uppercase tracking-wide text-white/40">{listScopeLabel}</p>
        <div
          className={
            mobileDrawer
              ? "mt-1 overflow-visible pr-1"
              : "min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1"
          }
        >
          {loadingEvents ? (
            <p className="py-6 text-sm text-white/50">{t.loadingEvents}</p>
          ) : visibleEvents.length === 0 ? (
            <p className="py-6 text-sm text-white/50">{t.noEvents}</p>
          ) : (
            <ul className="space-y-2">
              {visibleEvents.map((event) => (
                <li key={event.id} className={`${glassInset} group p-2.5`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{event.title}</p>
                      <p className="mt-0.5 text-[11px] text-white/55">
                        {event.eventDate} · {event.startTime} – {event.endTime}
                      </p>
                      {(event.participants?.length || event.attendees?.length) ? (
                        <p className="mt-1 line-clamp-2 text-[10px] text-sky-200/90">
                          {[
                            ...(event.participants?.map((p) => p.name ?? p.email) ?? []),
                            ...(event.attendees ?? []),
                          ].join(" · ")}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        className="rounded-md border border-white/15 p-1 text-sky-200 hover:bg-white/10"
                        onClick={() => onEdit(event)}
                        aria-label={t.editEvent}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-red-400/25 p-1 text-red-200 hover:bg-red-500/10"
                        onClick={() => onDelete(event.id)}
                        aria-label={t.deleteEvent}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
