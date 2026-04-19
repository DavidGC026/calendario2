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
      className="md:hidden pointer-events-auto fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-slate-950/90 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 pt-1.5 pb-1">
        {tabs.map(({ id, label, Icon }) => {
          const active = viewMode === id
          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                onClick={() => onChangeView(id)}
                aria-current={active ? "page" : undefined}
                className={`flex w-full flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition-colors ${
                  active
                    ? "bg-sky-500/20 text-sky-200"
                    : "text-white/55 hover:text-white/85"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "text-sky-300" : ""}`} />
                <span>{label}</span>
              </button>
            </li>
          )
        })}
        <li className="flex-1">
          <button
            type="button"
            onClick={onGoToday}
            className="flex w-full flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium text-white/55 transition-colors hover:text-white/85"
          >
            <Locate className="h-5 w-5" />
            <span>{labels.today}</span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
