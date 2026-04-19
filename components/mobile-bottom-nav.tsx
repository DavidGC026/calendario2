"use client"

import { CalendarDays, CalendarRange, LayoutGrid, Locate } from "lucide-react"

export type MobileViewMode = "day" | "week" | "month"

interface MobileBottomNavProps {
  viewMode: MobileViewMode
  onChangeView: (mode: MobileViewMode) => void
  onGoToday: () => void
  labels: {
    day: string
    week: string
    month: string
    today: string
  }
}

export function MobileBottomNav({
  viewMode,
  onChangeView,
  onGoToday,
  labels,
}: MobileBottomNavProps) {
  const tabs: Array<{ id: MobileViewMode; label: string; Icon: typeof CalendarDays }> = [
    { id: "day", label: labels.day, Icon: CalendarDays },
    { id: "week", label: labels.week, Icon: CalendarRange },
    { id: "month", label: labels.month, Icon: LayoutGrid },
  ]

  return (
    <nav
      aria-label="Calendar navigation"
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-slate-950/90 backdrop-blur-xl md:inset-x-auto md:left-1/2 md:bottom-4 md:-translate-x-1/2 md:rounded-2xl md:border md:border-white/15 md:bg-slate-900/85 md:shadow-2xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around gap-1 px-2 pt-1.5 pb-1 md:gap-2 md:px-3 md:py-2">
        {tabs.map(({ id, label, Icon }) => {
          const active = viewMode === id
          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                onClick={() => onChangeView(id)}
                aria-current={active ? "page" : undefined}
                className={`flex w-full items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-medium transition-colors md:gap-1.5 md:px-3 md:text-sm flex-col md:flex-row ${
                  active
                    ? "bg-sky-500/20 text-sky-200"
                    : "text-white/55 hover:text-white/85"
                }`}
              >
                <Icon className={`h-5 w-5 md:h-4 md:w-4 ${active ? "text-sky-300" : ""}`} />
                <span>{label}</span>
              </button>
            </li>
          )
        })}
        <li className="flex-1">
          <button
            type="button"
            onClick={onGoToday}
            className="flex w-full items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-medium text-white/65 transition-colors hover:text-white/95 md:gap-1.5 md:px-3 md:text-sm flex-col md:flex-row"
          >
            <Locate className="h-5 w-5 md:h-4 md:w-4" />
            <span>{labels.today}</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
