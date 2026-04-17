"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { DefaultChatTransport } from "ai"
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  LogOut,
  Menu,
  Search,
  Send,
  Settings,
  Sparkles,
} from "lucide-react"
import { signOut, useSession } from "next-auth/react"
import { useChat } from "@ai-sdk/react"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { CalendarSidebarContent, type CalendarCell } from "@/components/calendar-sidebar"
import { CalendarWeekGrid } from "@/components/calendar-week-grid"
import {
  addDays,
  eventBlockStyle,
  formatWeekRangeLabel,
  getWeekDates,
} from "@/lib/calendar-view-utils"

type CalendarEvent = {
  id: string
  title: string
  description: string
  location: string
  eventDate: string
  startTime: string
  endTime: string
  color: string
  attendees: string[]
  organizer: string
  day: number
}

type EventPayload = {
  title: string
  eventDate: string
  startTime: string
  endTime: string
  description?: string
  location?: string
  color?: string
}

const initialForm: EventPayload = {
  title: "",
  eventDate: new Date().toISOString().slice(0, 10),
  startTime: "09:00",
  endTime: "10:00",
  description: "",
  location: "",
  color: "bg-blue-500",
}

const MAX_DATE = "2040-12-31"
const LANGUAGE_STORAGE_KEY = "calendar-app-language"
type Locale = "es" | "en"
type CalendarViewMode = "day" | "week" | "month"

const AI_WELCOME_KEY = "calendar-app-ai-welcome-dismissed"

const CALENDAR_LANE_COLORS = [
  { id: "bg-blue-500", key: "calPersonal" as const },
  { id: "bg-green-500", key: "calWork" as const },
  { id: "bg-orange-500", key: "calPrivate" as const },
  { id: "bg-purple-500", key: "calFamily" as const },
] as const

const copy = {
  es: {
    title: "Calendario Inteligente",
    subtitle: "Eventos persistentes en PostgreSQL con acciones de IA.",
    logout: "Cerrar sesión",
    settings: "Configuración",
    language: "Idioma",
    createEvent: "Crear evento",
    updateEvent: "Actualizar evento",
    saveEvent: "Guardar evento",
    saving: "Guardando...",
    cancelEdit: "Cancelar edición",
    titlePlaceholder: "Título",
    locationPlaceholder: "Ubicación",
    descriptionPlaceholder: "Descripción",
    naturalTitle: "Crear con lenguaje natural",
    naturalPlaceholder: "Ej: Reunión con Ana mañana a las 10 por 1 hora",
    parse: "Parsear",
    conflictDetected: "Conflicto detectado:",
    createAnyway: "Crear de todos modos",
    updateAnyway: "Actualizar de todos modos",
    eventsTitle: "Tus eventos",
    monthView: "Vista mensual",
    activeRange: "Rango activo hasta",
    loadingEvents: "Cargando eventos...",
    noEvents: "Aún no tienes eventos.",
    selectedDay: "Eventos del día seleccionado",
    selectedMonth: "Eventos del mes",
    clearDayFilter: "Ver todo el mes",
    prevMonth: "Mes anterior",
    nextMonth: "Mes siguiente",
    weekdays: ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"],
    editEvent: "Editar evento",
    deleteEvent: "Eliminar evento",
    aiTitle: "Asistente IA",
    aiHelp: "Puedes pedir: crear, editar, eliminar eventos y revisar conflictos de horario.",
    noMessages: "Todavía no hay mensajes.",
    structuredResponse: "Respuesta estructurada recibida (tool result).",
    chatPlaceholder: "Ej: agenda una reunión con Carlos el lunes a las 15:00",
    authRequired: "Debes iniciar sesión para acceder a tu calendario.",
    goToLogin: "Ir a login",
    loadEventsError: "No se pudieron cargar tus eventos",
    updateError: "No se pudo actualizar el evento",
    createError: "No se pudo crear el evento",
    parseError: "No pude interpretar ese evento. Intenta con más detalle.",
    roleUser: "Usuario",
    roleAssistant: "Asistente",
    changePassword: "Cambiar contraseña",
    currentPassword: "Contraseña actual",
    newPassword: "Nueva contraseña",
    confirmPassword: "Confirmar nueva contraseña",
    savePassword: "Actualizar contraseña",
    passwordMismatch: "Las contraseñas nuevas no coinciden",
    passwordSuccess: "Contraseña actualizada. Vuelve a iniciar sesión si es necesario.",
    passwordError: "No se pudo actualizar la contraseña",
    adminPanel: "Administración",
    adminUsers: "Usuarios",
    adminRole: "Rol",
    adminEmail: "Correo",
    adminMakeAdmin: "Hacer administrador",
    adminMakeUser: "Quitar administrador",
    adminLoading: "Cargando usuarios...",
    adminForbidden: "Solo administradores",
    roleAdmin: "Administrador",
    roleUserLabel: "Usuario",
    miniCalendar: "Mini calendario",
    mainCalendar: "Calendario",
    eventsPanel: "Eventos",
    goToday: "Hoy",
    quickNav: "Navegación",
    brandCalendar: "Calendar",
    create: "Crear",
    myCalendars: "Mis calendarios",
    calPersonal: "Mi calendario",
    calWork: "Trabajo",
    calPrivate: "Personal",
    calFamily: "Familia",
    viewDay: "Día",
    viewWeek: "Semana",
    viewMonth: "Mes",
    searchPlaceholder: "Buscar eventos…",
    navTitleDay: "Vista diaria",
    navTitleWeek: "Vista semanal",
    navTitleMonth: "Vista mensual",
    aiWelcomeTitle: "¡Hola! Soy tu asistente de calendario.",
    aiWelcomeBody: "Puedo crear, editar o revisar conflictos. ¿Quieres abrir el chat?",
    aiWelcomeYes: "Sí, necesito ayuda",
    aiWelcomeNo: "No, gracias",
    openChat: "Abrir chat IA",
    sheetCreate: "Nuevo evento",
    sheetSettings: "Ajustes",
    sheetAi: "Asistente IA",
    colorLabel: "Color / calendario",
  },
  en: {
    title: "Smart Calendar",
    subtitle: "Persistent events in PostgreSQL with AI actions.",
    logout: "Log out",
    settings: "Settings",
    language: "Language",
    createEvent: "Create event",
    updateEvent: "Update event",
    saveEvent: "Save event",
    saving: "Saving...",
    cancelEdit: "Cancel edit",
    titlePlaceholder: "Title",
    locationPlaceholder: "Location",
    descriptionPlaceholder: "Description",
    naturalTitle: "Create with natural language",
    naturalPlaceholder: "Ex: Meeting with Ana tomorrow at 10 for 1 hour",
    parse: "Parse",
    conflictDetected: "Conflict detected:",
    createAnyway: "Create anyway",
    updateAnyway: "Update anyway",
    eventsTitle: "Your events",
    monthView: "Month view",
    activeRange: "Active range up to",
    loadingEvents: "Loading events...",
    noEvents: "You don't have events yet.",
    selectedDay: "Selected day events",
    selectedMonth: "Month events",
    clearDayFilter: "Show full month",
    prevMonth: "Previous month",
    nextMonth: "Next month",
    weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    editEvent: "Edit event",
    deleteEvent: "Delete event",
    aiTitle: "AI Assistant",
    aiHelp: "You can ask to create, edit, delete events and check schedule conflicts.",
    noMessages: "No messages yet.",
    structuredResponse: "Structured response received (tool result).",
    chatPlaceholder: "Ex: schedule a meeting with Carlos on Monday at 3:00 PM",
    authRequired: "You must sign in to access your calendar.",
    goToLogin: "Go to login",
    loadEventsError: "Could not load your events",
    updateError: "Could not update event",
    createError: "Could not create event",
    parseError: "I could not understand that event. Try with more details.",
    roleUser: "User",
    roleAssistant: "Assistant",
    changePassword: "Change password",
    currentPassword: "Current password",
    newPassword: "New password",
    confirmPassword: "Confirm new password",
    savePassword: "Update password",
    passwordMismatch: "New passwords do not match",
    passwordSuccess: "Password updated.",
    passwordError: "Could not update password",
    adminPanel: "Administration",
    adminUsers: "Users",
    adminRole: "Role",
    adminEmail: "Email",
    adminMakeAdmin: "Make admin",
    adminMakeUser: "Remove admin",
    adminLoading: "Loading users...",
    adminForbidden: "Admins only",
    roleAdmin: "Admin",
    roleUserLabel: "User",
    miniCalendar: "Mini calendar",
    mainCalendar: "Calendar",
    eventsPanel: "Events",
    goToday: "Today",
    quickNav: "Quick nav",
    brandCalendar: "Calendar",
    create: "Create",
    myCalendars: "My calendars",
    calPersonal: "My calendar",
    calWork: "Work",
    calPrivate: "Personal",
    calFamily: "Family",
    viewDay: "Day",
    viewWeek: "Week",
    viewMonth: "Month",
    searchPlaceholder: "Search events…",
    navTitleDay: "Day view",
    navTitleWeek: "Week view",
    navTitleMonth: "Month view",
    aiWelcomeTitle: "Hi! I'm your calendar assistant.",
    aiWelcomeBody: "I can create, edit, or check conflicts. Open the chat?",
    aiWelcomeYes: "Yes, I need help",
    aiWelcomeNo: "No, thanks",
    openChat: "Open AI chat",
    sheetCreate: "New event",
    sheetSettings: "Settings",
    sheetAi: "AI assistant",
    colorLabel: "Color / calendar",
  },
} as const

const glassPanel =
  "rounded-2xl border border-white/20 bg-gradient-to-br from-white/15 via-white/8 to-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl"
const glassInset = "rounded-xl border border-white/15 bg-white/5 backdrop-blur-md"
const inputGlass =
  "w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-white placeholder:text-white/45 outline-none transition focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/30"

export default function HomePage() {
  const { data: session, status: sessionStatus } = useSession()
  const isAdmin = session?.user?.role === "ADMIN"
  const [language, setLanguage] = useState<Locale>("es")
  const t = copy[language]
  const today = new Date().toISOString().slice(0, 10)

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [eventsError, setEventsError] = useState("")
  const [eventForm, setEventForm] = useState<EventPayload>(initialForm)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [eventConflict, setEventConflict] = useState<CalendarEvent[]>([])
  const [creatingEvent, setCreatingEvent] = useState(false)

  const [naturalInput, setNaturalInput] = useState("")
  const [parsing, setParsing] = useState(false)
  const [chatInput, setChatInput] = useState("")
  const [chatError, setChatError] = useState("")
  const [anchorDate, setAnchorDate] = useState(today)
  const [viewMode, setViewMode] = useState<CalendarViewMode>("week")
  const [searchQuery, setSearchQuery] = useState("")
  const [laneOn, setLaneOn] = useState<Record<string, boolean>>({
    "bg-blue-500": true,
    "bg-green-500": true,
    "bg-orange-500": true,
    "bg-purple-500": true,
  })
  const [createOpen, setCreateOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aiSheetOpen, setAiSheetOpen] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [aiWelcomeDismissed, setAiWelcomeDismissed] = useState(false)

  const monthFilter = anchorDate.slice(0, 7)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordMsg, setPasswordMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [savingPassword, setSavingPassword] = useState(false)

  const [adminUsers, setAdminUsers] = useState<
    { id: string; email: string; name: string | null; role: "USER" | "ADMIN" }[]
  >([])
  const [loadingAdmin, setLoadingAdmin] = useState(false)

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages }) => ({
        body: { messages, locale: language },
      }),
    }),
    onError: (error) => setChatError(error.message),
    onFinish: () => {
      void loadEvents()
    },
  })

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const aDate = `${a.eventDate}T${a.startTime}`
      const bDate = `${b.eventDate}T${b.startTime}`
      return aDate.localeCompare(bDate)
    })
  }, [events])

  const searchedEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return sortedEvents
    return sortedEvents.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.location && e.location.toLowerCase().includes(q)),
    )
  }, [sortedEvents, searchQuery])

  const laneFiltered = useMemo(() => {
    return searchedEvents.filter((e) => {
      if (laneOn[e.color]) return true
      return laneOn["bg-blue-500"]
    })
  }, [searchedEvents, laneOn])

  const visibleEvents = useMemo(() => {
    if (viewMode === "day") return laneFiltered.filter((e) => e.eventDate === anchorDate)
    if (viewMode === "week") {
      const w = getWeekDates(anchorDate)
      return laneFiltered.filter((e) => w.includes(e.eventDate))
    }
    const prefix = anchorDate.slice(0, 7)
    return laneFiltered.filter((e) => e.eventDate.startsWith(prefix))
  }, [anchorDate, viewMode, laneFiltered])

  const eventsByDate = useMemo(() => {
    const mapped = new Map<string, CalendarEvent[]>()
    for (const event of sortedEvents) {
      const current = mapped.get(event.eventDate) ?? []
      current.push(event)
      mapped.set(event.eventDate, current)
    }
    return mapped
  }, [sortedEvents])

  const monthLabel = useMemo(() => {
    const [year, month] = monthFilter.split("-")
    const monthDate = new Date(Number(year), Number(month) - 1, 1)
    return monthDate.toLocaleDateString(language === "es" ? "es-ES" : "en-US", {
      month: "long",
      year: "numeric",
    })
  }, [language, monthFilter])

  const calendarCells = useMemo(() => {
    const [year, month] = monthFilter.split("-")
    const yearNumber = Number(year)
    const monthNumber = Number(month) - 1
    const firstDayIndex = new Date(yearNumber, monthNumber, 1).getDay()
    const daysInMonth = new Date(yearNumber, monthNumber + 1, 0).getDate()

    const cells: CalendarCell[] = []
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({
        date: `empty-${i}`,
        dayNumber: 0,
        inCurrentMonth: false,
      })
    }

    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({
        date: `${year}-${month}-${String(day).padStart(2, "0")}`,
        dayNumber: day,
        inCurrentMonth: true,
      })
    }

    while (cells.length % 7 !== 0) {
      cells.push({
        date: `empty-tail-${cells.length}`,
        dayNumber: 0,
        inCurrentMonth: false,
      })
    }

    return cells
  }, [monthFilter])

  const canGoPrevMonth = monthFilter > today.slice(0, 7)
  const canGoNextMonth = monthFilter < "2040-12"

  async function loadEvents() {
    setLoadingEvents(true)
    setEventsError("")
    const response = await fetch("/api/events")

    if (!response.ok) {
      setLoadingEvents(false)
      setEventsError(t.loadEventsError)
      return
    }

    const data = await response.json()
    setEvents(data.events ?? [])
    setLoadingEvents(false)
  }

  useEffect(() => {
    if (sessionStatus === "authenticated") {
      void loadEvents()
    }
  }, [sessionStatus, language])

  useEffect(() => {
    const storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (storedLanguage === "es" || storedLanguage === "en") {
      setLanguage(storedLanguage)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    document.documentElement.lang = language
  }, [language])

  useEffect(() => {
    setAiWelcomeDismissed(localStorage.getItem(AI_WELCOME_KEY) === "1")
  }, [])

  async function loadAdminUsers() {
    if (!isAdmin) return
    setLoadingAdmin(true)
    const res = await fetch("/api/admin/users")
    setLoadingAdmin(false)
    if (res.ok) {
      const data = await res.json()
      setAdminUsers(data.users ?? [])
    }
  }

  useEffect(() => {
    if (sessionStatus === "authenticated" && isAdmin) {
      void loadAdminUsers()
    }
  }, [sessionStatus, isAdmin])

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordMsg(null)
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "err", text: t.passwordMismatch })
      return
    }
    setSavingPassword(true)
    const res = await fetch("/api/user/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    const data = await res.json()
    setSavingPassword(false)
    if (!res.ok) {
      setPasswordMsg({ type: "err", text: data.error ?? t.passwordError })
      return
    }
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setPasswordMsg({ type: "ok", text: t.passwordSuccess })
  }

  async function toggleUserRole(userId: string, currentRole: "USER" | "ADMIN") {
    const next = currentRole === "ADMIN" ? "USER" : "ADMIN"
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: next }),
    })
    if (res.ok) {
      await loadAdminUsers()
    }
  }

  async function saveEvent(payload: EventPayload, allowConflict = false) {
    setCreatingEvent(true)
    setEventConflict([])

    const isEditing = Boolean(editingEventId)
    const response = await fetch(isEditing ? `/api/events/${editingEventId}` : "/api/events", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, allowConflict }),
    })

    const data = await response.json()
    setCreatingEvent(false)

    if (response.status === 409) {
      setEventConflict(data.conflicts ?? [])
      return false
    }

    if (!response.ok) {
      setEventsError(data.error ?? (isEditing ? t.updateError : t.createError))
      return false
    }

    setEventForm({ ...initialForm, eventDate: payload.eventDate })
    setEditingEventId(null)
    setCreateOpen(false)
    await loadEvents()
    return true
  }

  async function handleNaturalInput() {
    if (!naturalInput.trim()) return
    setParsing(true)

    const parseResponse = await fetch("/api/parse-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: naturalInput, currentDate: today, locale: language }),
    })

    const parsed = await parseResponse.json()
    setParsing(false)

    if (!parseResponse.ok || !parsed?.title) {
      setEventsError(t.parseError)
      return
    }

    await saveEvent({
      title: parsed.title,
      eventDate: parsed.date ?? today,
      startTime: parsed.startTime ?? "09:00",
      endTime: parsed.endTime ?? "10:00",
      description: parsed.description ?? "",
      location: parsed.location ?? "",
      color: "bg-blue-500",
    })
    setNaturalInput("")
  }

  async function deleteEvent(id: string) {
    const response = await fetch(`/api/events/${id}`, { method: "DELETE" })
    if (response.ok) {
      await loadEvents()
    }
  }

  function startEditEvent(event: CalendarEvent) {
    setCreateOpen(true)
    setEditingEventId(event.id)
    setEventForm({
      title: event.title,
      eventDate: event.eventDate,
      startTime: event.startTime,
      endTime: event.endTime,
      description: event.description,
      location: event.location,
      color: event.color,
    })
    setEventConflict([])
    setEventsError("")
  }

  function moveMonth(delta: number) {
    const [year, month] = monthFilter.split("-").map(Number)
    const baseDate = new Date(year, month - 1 + delta, 1)
    const nextMonth = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, "0")}`
    const boundedMonth =
      nextMonth < today.slice(0, 7) ? today.slice(0, 7) : nextMonth > "2040-12" ? "2040-12" : nextMonth
    setAnchorDate(`${boundedMonth}-01`)
  }

  function goToToday() {
    setAnchorDate(today)
  }

  function navigateCalendar(delta: number) {
    if (viewMode === "week") setAnchorDate(addDays(anchorDate, delta * 7))
    else if (viewMode === "day") setAnchorDate(addDays(anchorDate, delta))
    else moveMonth(delta)
  }

  const weekDates = useMemo(() => getWeekDates(anchorDate), [anchorDate])

  const navTitle = useMemo(() => {
    const loc = language === "es" ? "es-ES" : "en-US"
    if (viewMode === "day") {
      return new Date(`${anchorDate}T12:00:00`).toLocaleDateString(loc, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    }
    if (viewMode === "week") {
      return formatWeekRangeLabel(weekDates, loc)
    }
    return new Date(`${anchorDate}T12:00:00`).toLocaleDateString(loc, { month: "long", year: "numeric" })
  }, [anchorDate, language, viewMode, weekDates])

  const hourRows = useMemo(() => Array.from({ length: 16 }, (_, i) => i + 7), [])

  const eventsByDateVisible = useMemo(() => {
    const mapped = new Map<string, CalendarEvent[]>()
    for (const event of laneFiltered) {
      const cur = mapped.get(event.eventDate) ?? []
      cur.push(event)
      mapped.set(event.eventDate, cur)
    }
    return mapped
  }, [laneFiltered])

  const viewDates = useMemo(
    () => (viewMode === "day" ? [anchorDate] : weekDates),
    [viewMode, anchorDate, weekDates],
  )

  function formatHourLabel(h: number) {
    const d = new Date()
    d.setHours(h, 0, 0, 0)
    return d.toLocaleTimeString(language === "es" ? "es-ES" : "en-US", {
      hour: "numeric",
      minute: "2-digit",
    })
  }

  function dismissAiWelcome() {
    localStorage.setItem(AI_WELCOME_KEY, "1")
    setAiWelcomeDismissed(true)
  }

  const listScopeLabel =
    viewMode === "day" ? t.selectedDay : viewMode === "week" ? t.navTitleWeek : t.selectedMonth

  if (sessionStatus === "loading") {
    return (
      <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-950/90 via-slate-950 to-blue-950/90" />
        <div className="relative flex min-h-screen items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-violet-300" />
        </div>
      </main>
    )
  }

  if (sessionStatus === "unauthenticated") {
    return (
      <main className="relative min-h-screen overflow-hidden text-white">
        <div className="absolute inset-0">
          <Image
            src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=2070&auto=format&fit=crop"
            alt=""
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-[2px]" />
        </div>
        <div className="relative flex min-h-screen items-center justify-center px-4">
          <div className={`${glassPanel} max-w-md p-8 text-center`}>
            <Sparkles className="mx-auto mb-3 h-10 w-10 text-violet-300" />
            <p className="mb-4 text-lg text-white/90">{t.authRequired}</p>
            <a
              href="/login"
              className="inline-block rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-6 py-3 font-medium shadow-lg transition hover:opacity-90"
            >
              {t.goToLogin}
            </a>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden text-white">
      <div className="pointer-events-none absolute inset-0">
        <Image
          src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=2070&auto=format&fit=crop"
          alt=""
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/55 to-slate-950/85" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(139,92,246,0.25),transparent)]" />
      </div>

      <div className="relative z-10 flex min-h-[100dvh] w-full flex-col md:flex-row">
        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetContent
            side="left"
            className="w-[300px] border-white/15 bg-slate-950/98 p-0 text-white backdrop-blur-xl sm:max-w-[300px]"
          >
            <div className="h-[100dvh] overflow-y-auto p-4">
              <CalendarSidebarContent
                t={t}
                glassPanel={glassPanel}
                glassInset={glassInset}
                today={today}
                monthLabel={monthLabel}
                calendarCells={calendarCells}
                eventsByDate={eventsByDate}
                anchorDate={anchorDate}
                onSelectDay={(d) => {
                  setAnchorDate(d)
                  setMobileSidebarOpen(false)
                }}
                onGoToday={goToToday}
                moveMonth={moveMonth}
                canGoPrevMonth={canGoPrevMonth}
                canGoNextMonth={canGoNextMonth}
                laneOn={laneOn}
                setLaneOn={setLaneOn}
                onCreate={() => {
                  setCreateOpen(true)
                  setMobileSidebarOpen(false)
                }}
                createLabel={t.create}
                brandCalendar={t.brandCalendar}
                loadingEvents={loadingEvents}
                visibleEvents={visibleEvents}
                onEdit={startEditEvent}
                onDelete={deleteEvent}
                listScopeLabel={listScopeLabel}
              />
            </div>
          </SheetContent>
        </Sheet>

        <aside className="hidden h-[100dvh] w-[300px] shrink-0 flex-col overflow-hidden border-r border-white/10 bg-slate-950/35 p-4 backdrop-blur-2xl md:flex">
          <CalendarSidebarContent
            t={t}
            glassPanel={glassPanel}
            glassInset={glassInset}
            today={today}
            monthLabel={monthLabel}
            calendarCells={calendarCells}
            eventsByDate={eventsByDate}
            anchorDate={anchorDate}
            onSelectDay={setAnchorDate}
            onGoToday={goToToday}
            moveMonth={moveMonth}
            canGoPrevMonth={canGoPrevMonth}
            canGoNextMonth={canGoNextMonth}
            laneOn={laneOn}
            setLaneOn={setLaneOn}
            onCreate={() => setCreateOpen(true)}
            createLabel={t.create}
            brandCalendar={t.brandCalendar}
            loadingEvents={loadingEvents}
            visibleEvents={visibleEvents}
            onEdit={startEditEvent}
            onDelete={deleteEvent}
            listScopeLabel={listScopeLabel}
          />
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-white/10 bg-slate-950/45 px-3 py-3 backdrop-blur-xl md:px-5">
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <button
                type="button"
                className={`${glassInset} inline-flex md:hidden`}
                onClick={() => setMobileSidebarOpen(true)}
                aria-label="Menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={goToToday}
                className="rounded-lg bg-sky-500/35 px-3 py-1.5 text-sm font-medium text-sky-100 ring-1 ring-sky-400/35 transition hover:bg-sky-500/45"
              >
                {t.goToday}
              </button>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => navigateCalendar(-1)}
                  className={`${glassInset} rounded-lg p-2`}
                  aria-label={t.prevMonth}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => navigateCalendar(1)}
                  className={`${glassInset} rounded-lg p-2`}
                  aria-label={t.nextMonth}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <h2 className="min-w-0 flex-1 text-lg font-semibold capitalize tracking-tight text-white md:text-xl">
                {navTitle}
              </h2>
              <div className={`${glassInset} flex min-w-[140px] flex-1 items-center gap-2 px-2 py-1.5 md:max-w-xs md:flex-initial`}>
                <Search className="h-4 w-4 shrink-0 text-white/45" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/35"
                  placeholder={t.searchPlaceholder}
                />
              </div>
              <div className={`${glassInset} flex items-center gap-1 px-2 py-1.5 text-sm`}>
                <label className="text-white/50">{t.language}</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as Locale)}
                  className="cursor-pointer bg-transparent font-medium outline-none"
                >
                  <option value="es" className="bg-slate-900">
                    ES
                  </option>
                  <option value="en" className="bg-slate-900">
                    EN
                  </option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className={`${glassInset} rounded-lg p-2`}
                aria-label={t.settings}
              >
                <Settings className="h-4 w-4" />
              </button>
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-sky-500 text-sm font-bold text-white ring-2 ring-white/25"
                title={session?.user?.email ?? ""}
              >
                {(session?.user?.email?.[0] ?? "U").toUpperCase()}
              </div>
              <div className="flex w-full justify-center rounded-xl border border-white/15 bg-white/[0.06] p-1 md:ml-auto md:w-auto">
                {(
                  [
                    ["day", t.viewDay],
                    ["week", t.viewWeek],
                    ["month", t.viewMonth],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setViewMode(mode)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      viewMode === mode
                        ? "bg-sky-500/45 text-white shadow-md ring-1 ring-sky-400/40"
                        : "text-white/55 hover:text-white/90"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-3 py-4 md:px-6">
            {loadingEvents && events.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-24 text-white/60">
                <Loader2 className="h-8 w-8 animate-spin text-sky-300" />
                {t.loadingEvents}
              </div>
            ) : viewMode === "month" ? (
              <div className={`${glassPanel} p-4 md:p-5`}>
                <div className={`${glassInset} p-3 md:p-4`}>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-base font-medium capitalize text-white md:text-lg">{monthLabel}</h3>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveMonth(-1)}
                        disabled={!canGoPrevMonth}
                        className="rounded-xl border border-white/20 p-2 transition hover:bg-white/10 disabled:opacity-40"
                        aria-label={t.prevMonth}
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveMonth(1)}
                        disabled={!canGoNextMonth}
                        className="rounded-xl border border-white/20 p-2 transition hover:bg-white/10 disabled:opacity-40"
                        aria-label={t.nextMonth}
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-white/50 md:text-sm">
                    {t.weekdays.map((dayName) => (
                      <div key={dayName} className="py-2">
                        {dayName}
                      </div>
                    ))}
                  </div>
                  <div className="mt-1 grid grid-cols-7 gap-1.5">
                    {calendarCells.map((cell) => {
                      if (!cell.inCurrentMonth) {
                        return (
                          <div key={cell.date} className="min-h-[5.5rem] rounded-xl bg-white/[0.03] md:min-h-24" />
                        )
                      }
                      const dayEvents = eventsByDateVisible.get(cell.date) ?? []
                      const isSelected = anchorDate === cell.date
                      const isTodayCell = cell.date === today
                      return (
                        <button
                          type="button"
                          key={cell.date}
                          onClick={() => setAnchorDate(cell.date)}
                          className={`min-h-[5.5rem] rounded-xl border p-2 text-left transition md:min-h-24 ${
                            isSelected
                              ? "border-sky-400/80 bg-sky-500/20 shadow-[0_0_20px_rgba(56,189,248,0.25)]"
                              : isTodayCell
                                ? "border-white/35 bg-white/10 ring-1 ring-sky-400/40"
                                : "border-white/10 bg-white/[0.06] hover:bg-white/12"
                          }`}
                        >
                          <p className="text-xs font-semibold text-white/90 md:text-sm">{cell.dayNumber}</p>
                          <div className="mt-1 space-y-0.5">
                            {dayEvents.slice(0, 2).map((event) => (
                              <p
                                key={event.id}
                                className="truncate rounded-md px-1 py-0.5 text-[10px] text-white/95 md:text-xs"
                                style={eventBlockStyle(event.color)}
                              >
                                {event.startTime} {event.title}
                              </p>
                            ))}
                            {dayEvents.length > 2 ? (
                              <p className="text-[10px] text-white/50">+{dayEvents.length - 2}</p>
                            ) : null}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <CalendarWeekGrid
                viewDates={viewDates}
                hourRows={hourRows}
                eventsByDate={eventsByDateVisible}
                anchorDate={anchorDate}
                today={today}
                onEventClick={startEditEvent}
                formatHour={formatHourLabel}
              />
            )}
          </div>
        </div>

        {!aiWelcomeDismissed ? (
          <div className="pointer-events-auto fixed bottom-6 right-4 z-[60] max-w-sm rounded-2xl border border-white/20 bg-slate-950/90 p-4 shadow-[0_12px_48px_rgba(0,0,0,0.45)] backdrop-blur-xl md:right-8">
            <Sparkles className="mb-2 h-6 w-6 text-sky-300" />
            <p className="font-semibold text-white">{t.aiWelcomeTitle}</p>
            <p className="mt-1 text-sm text-white/70">{t.aiWelcomeBody}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  dismissAiWelcome()
                  setAiSheetOpen(true)
                }}
                className="rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-medium shadow-lg"
              >
                {t.aiWelcomeYes}
              </button>
              <button
                type="button"
                onClick={dismissAiWelcome}
                className={`${glassInset} px-4 py-2 text-sm text-white/85`}
              >
                {t.aiWelcomeNo}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAiSheetOpen(true)}
            className="pointer-events-auto fixed bottom-6 right-4 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-sky-500 text-white shadow-xl ring-2 ring-white/30 md:right-8"
            aria-label={t.openChat}
          >
            <Sparkles className="h-6 w-6" />
          </button>
        )}

        <Sheet open={createOpen} onOpenChange={setCreateOpen}>
          <SheetContent
            side="right"
            className="w-full max-w-lg overflow-y-auto border-white/15 bg-slate-950/98 text-white backdrop-blur-xl"
          >
            <SheetHeader>
              <SheetTitle>{editingEventId ? t.updateEvent : t.sheetCreate}</SheetTitle>
            </SheetHeader>
            <form
              className="mt-6 space-y-3"
              onSubmit={async (e) => {
                e.preventDefault()
                await saveEvent(eventForm)
              }}
            >
              <input
                className={inputGlass}
                placeholder={t.titlePlaceholder}
                value={eventForm.title}
                onChange={(e) => setEventForm((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  className={inputGlass}
                  type="date"
                  value={eventForm.eventDate}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, eventDate: e.target.value }))}
                  min={today}
                  max={MAX_DATE}
                  required
                />
                <input
                  className={inputGlass}
                  type="time"
                  value={eventForm.startTime}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, startTime: e.target.value }))}
                  required
                />
                <input
                  className={inputGlass}
                  type="time"
                  value={eventForm.endTime}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, endTime: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/55">{t.colorLabel}</label>
                <select
                  className={inputGlass}
                  value={eventForm.color}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, color: e.target.value }))}
                >
                  {CALENDAR_LANE_COLORS.map(({ id, key }) => (
                    <option key={id} value={id}>
                      {t[key]}
                    </option>
                  ))}
                </select>
              </div>
              <input
                className={inputGlass}
                placeholder={t.locationPlaceholder}
                value={eventForm.location}
                onChange={(e) => setEventForm((prev) => ({ ...prev, location: e.target.value }))}
              />
              <textarea
                className={`${inputGlass} min-h-[4.5rem] resize-y`}
                placeholder={t.descriptionPlaceholder}
                value={eventForm.description}
                onChange={(e) => setEventForm((prev) => ({ ...prev, description: e.target.value }))}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={creatingEvent}
                  className="rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-medium shadow-lg disabled:opacity-50"
                  type="submit"
                >
                  {creatingEvent ? t.saving : editingEventId ? t.updateEvent : t.saveEvent}
                </button>
                {editingEventId ? (
                  <button
                    type="button"
                    className={`${glassInset} px-4 py-2 text-sm text-white/90 transition hover:bg-white/10`}
                    onClick={() => {
                      setEditingEventId(null)
                      setEventForm({ ...initialForm, eventDate: new Date().toISOString().slice(0, 10) })
                    }}
                  >
                    {t.cancelEdit}
                  </button>
                ) : null}
              </div>
            </form>
            <div className={`${glassInset} mt-4 p-4`}>
              <h3 className="font-medium text-white/95">{t.naturalTitle}</h3>
              <div className="mt-2 flex gap-2">
                <input
                  className={`${inputGlass} min-w-0 flex-1`}
                  placeholder={t.naturalPlaceholder}
                  value={naturalInput}
                  onChange={(e) => setNaturalInput(e.target.value)}
                />
                <button
                  type="button"
                  className="shrink-0 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-2 text-sm font-medium shadow-lg disabled:opacity-50"
                  onClick={handleNaturalInput}
                  disabled={parsing || !naturalInput.trim()}
                >
                  {parsing ? "..." : t.parse}
                </button>
              </div>
            </div>
            {eventConflict.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-400/35 bg-amber-500/10 p-3 text-sm text-amber-50 backdrop-blur-sm">
                <p className="font-medium">{t.conflictDetected}</p>
                {eventConflict.map((event) => (
                  <p key={event.id}>
                    - {event.title} ({event.eventDate} {event.startTime}-{event.endTime})
                  </p>
                ))}
                <button
                  className="mt-2 rounded bg-amber-500/30 px-3 py-1"
                  onClick={() => saveEvent(eventForm, true)}
                  type="button"
                >
                  {editingEventId ? t.updateAnyway : t.createAnyway}
                </button>
              </div>
            )}
            {eventsError ? <p className="mt-3 text-sm text-red-400">{eventsError}</p> : null}
          </SheetContent>
        </Sheet>

        <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
          <SheetContent
            side="right"
            className="w-full max-w-md overflow-y-auto border-white/15 bg-slate-950/98 text-white backdrop-blur-xl"
          >
            <SheetHeader>
              <SheetTitle>{t.sheetSettings}</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-6">
              <div className="flex flex-wrap items-center gap-2 text-sm text-white/75">
                {session?.user?.email ? (
                  <>
                    <span>{session.user.email}</span>
                    {isAdmin ? (
                      <span className="rounded-lg bg-amber-500/25 px-2 py-0.5 text-xs text-amber-100 ring-1 ring-amber-400/30">
                        {t.roleAdmin}
                      </span>
                    ) : null}
                  </>
                ) : null}
              </div>
              <div>
                <h3 className="font-medium text-white/90">{t.changePassword}</h3>
                <form className="mt-3 grid gap-2" onSubmit={handleChangePassword}>
                  <input
                    type="password"
                    className={inputGlass}
                    placeholder={t.currentPassword}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <input
                    type="password"
                    className={inputGlass}
                    placeholder={t.newPassword}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                  <input
                    type="password"
                    className={inputGlass}
                    placeholder={t.confirmPassword}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                  <button
                    type="submit"
                    disabled={savingPassword}
                    className="w-fit rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 text-sm font-medium shadow-lg disabled:opacity-50"
                  >
                    {savingPassword ? "..." : t.savePassword}
                  </button>
                </form>
                {passwordMsg ? (
                  <p
                    className={`mt-2 text-sm ${passwordMsg.type === "ok" ? "text-green-400" : "text-red-400"}`}
                  >
                    {passwordMsg.text}
                  </p>
                ) : null}
              </div>
              {isAdmin ? (
                <div className="border-t border-white/10 pt-4">
                  <h3 className="font-medium">{t.adminPanel}</h3>
                  <p className="mt-1 text-sm text-slate-400">{t.adminUsers}</p>
                  {loadingAdmin ? (
                    <p className="mt-2 text-sm text-slate-400">{t.adminLoading}</p>
                  ) : (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-white/10 text-slate-400">
                            <th className="py-2 pr-4">{t.adminEmail}</th>
                            <th className="py-2 pr-4">{t.adminRole}</th>
                            <th className="py-2">{t.settings}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {adminUsers.map((u) => (
                            <tr key={u.id} className="border-b border-white/5">
                              <td className="py-2 pr-4">{u.email}</td>
                              <td className="py-2 pr-4">
                                {u.role === "ADMIN" ? t.roleAdmin : t.roleUserLabel}
                              </td>
                              <td className="py-2">
                                <button
                                  type="button"
                                  className="rounded-md border border-white/20 px-2 py-1 text-xs hover:bg-white/10"
                                  onClick={() => toggleUserRole(u.id, u.role)}
                                  disabled={u.id === session?.user?.id && u.role === "ADMIN"}
                                >
                                  {u.role === "ADMIN" ? t.adminMakeUser : t.adminMakeAdmin}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}
              <button
                type="button"
                className={`${glassInset} inline-flex w-full items-center justify-center gap-2 px-4 py-3 text-sm transition hover:bg-white/10`}
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="h-4 w-4" />
                {t.logout}
              </button>
            </div>
          </SheetContent>
        </Sheet>

        <Sheet open={aiSheetOpen} onOpenChange={setAiSheetOpen}>
          <SheetContent
            side="right"
            className="w-full max-w-md overflow-y-auto border-white/15 bg-slate-950/98 text-white backdrop-blur-xl"
          >
            <SheetHeader>
              <SheetTitle>{t.sheetAi}</SheetTitle>
            </SheetHeader>
            <p className="mt-2 text-sm text-white/65">{t.aiHelp}</p>
            <div className={`${glassInset} mt-4 max-h-[50vh] space-y-3 overflow-y-auto p-3`}>
              {messages.length === 0 ? (
                <p className="text-sm text-white/45">{t.noMessages}</p>
              ) : (
                messages.map((message) => {
                  const text = message.parts
                    .filter((part) => part.type === "text")
                    .map((part) => ("text" in part ? part.text : ""))
                    .join("")
                  return (
                    <div key={message.id} className="text-sm text-white/90">
                      <p className="mb-1 text-xs uppercase tracking-wide text-white/45">
                        {message.role === "user"
                          ? t.roleUser
                          : message.role === "assistant"
                            ? t.roleAssistant
                            : message.role}
                      </p>
                      <p className="text-white/85">{text || t.structuredResponse}</p>
                    </div>
                  )
                })
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && chatInput.trim() && status !== "streaming") {
                    sendMessage({ text: chatInput })
                    setChatInput("")
                  }
                }}
                className={`${inputGlass} min-w-0 flex-1`}
                placeholder={t.chatPlaceholder}
              />
              <button
                type="button"
                onClick={() => {
                  if (!chatInput.trim() || status === "streaming") return
                  sendMessage({ text: chatInput })
                  setChatInput("")
                }}
                disabled={!chatInput.trim() || status === "streaming"}
                className="inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 font-medium shadow-lg disabled:opacity-50"
              >
                {status === "streaming" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            {chatError ? <p className="mt-2 text-sm text-red-300">{chatError}</p> : null}
          </SheetContent>
        </Sheet>
      </div>

    </main>
  )
}
