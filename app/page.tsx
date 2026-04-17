"use client"

import { useEffect, useMemo, useState } from "react"
import { DefaultChatTransport } from "ai"
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, LogOut, Pencil, Send, Trash2 } from "lucide-react"
import { signOut, useSession } from "next-auth/react"
import { useChat } from "@ai-sdk/react"

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
type CalendarCell = {
  date: string
  dayNumber: number
  inCurrentMonth: boolean
}

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
  },
} as const

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
  const [monthFilter, setMonthFilter] = useState(today.slice(0, 7))
  const [selectedDateFilter, setSelectedDateFilter] = useState("")

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

  const visibleEvents = useMemo(() => {
    if (selectedDateFilter) {
      return sortedEvents.filter((event) => event.eventDate === selectedDateFilter)
    }

    const [year, month] = monthFilter.split("-")
    if (!year || !month) return sortedEvents
    return sortedEvents.filter((event) => {
      const [eventYear, eventMonth] = event.eventDate.split("-")
      return eventYear === year && eventMonth === month
    })
  }, [monthFilter, selectedDateFilter, sortedEvents])

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
    const [year, month] = monthFilter.split("-")
    const baseDate = new Date(Number(year), Number(month) - 1 + delta, 1)
    const nextMonth = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, "0")}`
    const boundedMonth = nextMonth < today.slice(0, 7) ? today.slice(0, 7) : nextMonth > "2040-12" ? "2040-12" : nextMonth
    setMonthFilter(boundedMonth)
    if (selectedDateFilter && !selectedDateFilter.startsWith(boundedMonth)) {
      setSelectedDateFilter("")
    }
  }

  if (sessionStatus === "loading") {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </main>
    )
  }

  if (sessionStatus === "unauthenticated") {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 max-w-md text-center">
          <p className="mb-4">{t.authRequired}</p>
          <a href="/login" className="inline-block rounded-md bg-blue-600 px-4 py-2 font-medium">
            {t.goToLogin}
          </a>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl p-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{t.title}</h1>
            <p className="text-sm text-slate-300">{t.subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-md border border-white/20 px-3 py-2 text-sm">
              <label className="mr-2 text-slate-300">{t.language}</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Locale)}
                className="bg-transparent outline-none"
              >
                <option value="es" className="bg-slate-900">
                  Espanol
                </option>
                <option value="en" className="bg-slate-900">
                  English
                </option>
              </select>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-4 w-4" />
              {t.logout}
            </button>
          </div>
        </header>

        <section className="mb-6 rounded-xl border border-white/10 bg-white/5 p-4 space-y-6">
          <div>
            <h2 className="text-lg font-medium">{t.settings}</h2>
            <p className="mt-1 text-sm text-slate-300">
              {t.language}: {language === "es" ? "Espanol" : "English"}
            </p>
            {session?.user?.email ? (
              <p className="mt-1 text-sm text-slate-400">
                {session.user.email}
                {isAdmin ? (
                  <span className="ml-2 rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-200">
                    {t.roleAdmin}
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>

          <div className="border-t border-white/10 pt-4">
            <h3 className="font-medium">{t.changePassword}</h3>
            <form className="mt-3 grid max-w-md gap-2" onSubmit={handleChangePassword}>
              <input
                type="password"
                className="rounded-md border border-white/20 bg-slate-900 px-3 py-2"
                placeholder={t.currentPassword}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <input
                type="password"
                className="rounded-md border border-white/20 bg-slate-900 px-3 py-2"
                placeholder={t.newPassword}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
              <input
                type="password"
                className="rounded-md border border-white/20 bg-slate-900 px-3 py-2"
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
                className="w-fit rounded-md bg-slate-700 px-4 py-2 text-sm disabled:opacity-50"
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
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-lg font-medium">{editingEventId ? t.updateEvent : t.createEvent}</h2>
            <form
              className="mt-4 space-y-3"
              onSubmit={async (e) => {
                e.preventDefault()
                await saveEvent(eventForm)
              }}
            >
              <input
                className="w-full rounded-md border border-white/20 bg-slate-900 px-3 py-2"
                placeholder={t.titlePlaceholder}
                value={eventForm.title}
                onChange={(e) => setEventForm((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  className="rounded-md border border-white/20 bg-slate-900 px-3 py-2"
                  type="date"
                  value={eventForm.eventDate}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, eventDate: e.target.value }))}
                  min={today}
                  max={MAX_DATE}
                  required
                />
                <input
                  className="rounded-md border border-white/20 bg-slate-900 px-3 py-2"
                  type="time"
                  value={eventForm.startTime}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, startTime: e.target.value }))}
                  required
                />
                <input
                  className="rounded-md border border-white/20 bg-slate-900 px-3 py-2"
                  type="time"
                  value={eventForm.endTime}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, endTime: e.target.value }))}
                  required
                />
              </div>
              <input
                className="w-full rounded-md border border-white/20 bg-slate-900 px-3 py-2"
                placeholder={t.locationPlaceholder}
                value={eventForm.location}
                onChange={(e) => setEventForm((prev) => ({ ...prev, location: e.target.value }))}
              />
              <textarea
                className="w-full rounded-md border border-white/20 bg-slate-900 px-3 py-2"
                placeholder={t.descriptionPlaceholder}
                value={eventForm.description}
                onChange={(e) => setEventForm((prev) => ({ ...prev, description: e.target.value }))}
              />
              <button
                disabled={creatingEvent}
                className="rounded-md bg-blue-600 px-4 py-2 font-medium disabled:opacity-50"
                type="submit"
              >
                {creatingEvent ? t.saving : editingEventId ? t.updateEvent : t.saveEvent}
              </button>
              {editingEventId ? (
                <button
                  type="button"
                  className="ml-2 rounded-md border border-white/30 px-4 py-2 text-sm"
                  onClick={() => {
                    setEditingEventId(null)
                    setEventForm({ ...initialForm, eventDate: new Date().toISOString().slice(0, 10) })
                  }}
                >
                  {t.cancelEdit}
                </button>
              ) : null}
            </form>

            <div className="mt-4 border-t border-white/10 pt-4">
              <h3 className="font-medium">{t.naturalTitle}</h3>
              <div className="mt-2 flex gap-2">
                <input
                  className="flex-1 rounded-md border border-white/20 bg-slate-900 px-3 py-2"
                  placeholder={t.naturalPlaceholder}
                  value={naturalInput}
                  onChange={(e) => setNaturalInput(e.target.value)}
                />
                <button
                  className="rounded-md bg-violet-600 px-3 py-2 disabled:opacity-50"
                  onClick={handleNaturalInput}
                  disabled={parsing || !naturalInput.trim()}
                  type="button"
                >
                  {parsing ? "..." : t.parse}
                </button>
              </div>
            </div>

            {eventConflict.length > 0 && (
              <div className="mt-4 rounded-md border border-amber-400/40 bg-amber-400/10 p-3 text-sm">
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
          </section>

          <section className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-medium">{t.eventsTitle}</h2>
              <span className="inline-flex items-center gap-1 text-xs text-slate-300">
                <CalendarDays className="h-3.5 w-3.5" />
                {t.activeRange} {MAX_DATE}
              </span>
            </div>

            <div className="mt-4 rounded-md border border-white/10 bg-slate-900 p-3">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-medium capitalize">{monthLabel}</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => moveMonth(-1)}
                    disabled={!canGoPrevMonth}
                    className="rounded-md border border-white/20 p-1.5 disabled:opacity-40"
                    aria-label={t.prevMonth}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveMonth(1)}
                    disabled={!canGoNextMonth}
                    className="rounded-md border border-white/20 p-1.5 disabled:opacity-40"
                    aria-label={t.nextMonth}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400">
                {t.weekdays.map((dayName) => (
                  <div key={dayName} className="py-1">
                    {dayName}
                  </div>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {calendarCells.map((cell) => {
                  if (!cell.inCurrentMonth) {
                    return <div key={cell.date} className="min-h-20 rounded-md bg-white/5" />
                  }

                  const dayEvents = eventsByDate.get(cell.date) ?? []
                  const isSelected = selectedDateFilter === cell.date
                  return (
                    <button
                      type="button"
                      key={cell.date}
                      onClick={() => setSelectedDateFilter((prev) => (prev === cell.date ? "" : cell.date))}
                      className={`min-h-20 rounded-md border p-1.5 text-left transition-colors ${
                        isSelected
                          ? "border-blue-400 bg-blue-500/20"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <p className="text-xs text-slate-300">{cell.dayNumber}</p>
                      <div className="mt-1 space-y-1">
                        {dayEvents.slice(0, 2).map((event) => (
                          <p key={event.id} className="truncate rounded bg-blue-500/20 px-1 py-0.5 text-[10px]">
                            {event.startTime} {event.title}
                          </p>
                        ))}
                        {dayEvents.length > 2 ? (
                          <p className="text-[10px] text-slate-400">+{dayEvents.length - 2}</p>
                        ) : null}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {selectedDateFilter ? (
              <button
                type="button"
                onClick={() => setSelectedDateFilter("")}
                className="mt-3 rounded-md border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10"
              >
                {t.clearDayFilter}
              </button>
            ) : null}
            {loadingEvents ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.loadingEvents}
              </div>
            ) : visibleEvents.length === 0 ? (
              <p className="mt-4 text-sm text-slate-300">{t.noEvents}</p>
            ) : (
              <div className="mt-4 space-y-2">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  {selectedDateFilter ? t.selectedDay : t.selectedMonth}
                </p>
                {visibleEvents.map((event) => (
                  <article key={event.id} className="rounded-md border border-white/10 bg-slate-900 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-medium">{event.title}</h3>
                        <p className="text-sm text-slate-300">
                          {event.eventDate} • {event.startTime} - {event.endTime}
                        </p>
                        {event.location ? <p className="text-sm text-slate-400">{event.location}</p> : null}
                        {event.description ? <p className="mt-1 text-sm text-slate-200">{event.description}</p> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="rounded-md border border-blue-400/30 p-2 text-blue-300 hover:bg-blue-500/10"
                          onClick={() => startEditEvent(event)}
                          type="button"
                          aria-label={t.editEvent}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="rounded-md border border-red-400/30 p-2 text-red-300 hover:bg-red-500/10"
                          onClick={() => deleteEvent(event.id)}
                          type="button"
                          aria-label={t.deleteEvent}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-medium">{t.aiTitle}</h2>
          <p className="mt-1 text-sm text-slate-300">
            {t.aiHelp}
          </p>

          <div className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-md border border-white/10 bg-slate-900 p-3">
            {messages.length === 0 ? (
              <p className="text-sm text-slate-400">{t.noMessages}</p>
            ) : (
              messages.map((message) => {
                const text = message.parts
                  .filter((part) => part.type === "text")
                  .map((part) => ("text" in part ? part.text : ""))
                  .join("")
                return (
                  <div key={message.id} className="text-sm">
                    <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">
                      {message.role === "user"
                        ? t.roleUser
                        : message.role === "assistant"
                          ? t.roleAssistant
                          : message.role}
                    </p>
                    <p>{text || t.structuredResponse}</p>
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
              className="flex-1 rounded-md border border-white/20 bg-slate-900 px-3 py-2"
              placeholder={t.chatPlaceholder}
            />
            <button
              onClick={() => {
                if (!chatInput.trim() || status === "streaming") return
                sendMessage({ text: chatInput })
                setChatInput("")
              }}
              disabled={!chatInput.trim() || status === "streaming"}
              className="rounded-md bg-purple-600 px-4 py-2 disabled:opacity-50"
            >
              {status === "streaming" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          {chatError ? <p className="mt-2 text-sm text-red-400">{chatError}</p> : null}
        </section>
      </div>
    </main>
  )
}
