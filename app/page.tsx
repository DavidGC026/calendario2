"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  DefaultChatTransport,
  isFileUIPart,
  isReasoningUIPart,
  isTextUIPart,
  isToolUIPart,
  type UIMessage,
} from "ai"
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  ImagePlus,
  Loader2,
  LogOut,
  Menu,
  Plus,
  Search,
  Send,
  Settings,
  Sparkles,
  Trash2,
  UserPlus,
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
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { CalendarFeedCard } from "@/components/calendar-feed-card"
import { ContactsManager } from "@/components/contacts-manager"
import { CALENDAR_LANE_COLORS, laneLabel } from "@/lib/calendar-lanes"
import {
  addDays,
  eventBlockStyle,
  formatISODateLocal,
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
  participantUserIds: string[]
  participants: { id: string; name: string | null; email: string }[]
  organizer: string
  day: number
}

type FriendRow = { id: string; email: string; name: string | null }
type FriendRequestRow = {
  id: string
  fromUserId: string
  toUserId: string
  fromUser?: FriendRow
  toUser?: FriendRow
}

type EventPayload = {
  title: string
  eventDate: string
  startTime: string
  endTime: string
  description?: string
  location?: string
  color?: string
  /** Texto multilínea; al guardar se convierte en `attendees`. */
  attendeesText: string
  participantUserIds: string[]
}

function attendeesFromText(s: string): string[] {
  return s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
}

const initialForm: EventPayload = {
  title: "",
  eventDate: formatISODateLocal(new Date()),
  startTime: "09:00",
  endTime: "10:00",
  description: "",
  location: "",
  color: "bg-blue-500",
  attendeesText: "",
  participantUserIds: [],
}

const MAX_DATE = "2040-12-31"
const LANGUAGE_STORAGE_KEY = "calendar-app-language"
type Locale = "es" | "en"
type CalendarViewMode = "day" | "week" | "month"

const AI_WELCOME_KEY = "calendar-app-ai-welcome-dismissed"

const copy = {
  es: {
    title: "Calendario Inteligente",
    subtitle: "Eventos persistentes en PostgreSQL con acciones de IA.",
    logout: "Cerrar sesión",
    settings: "Configuración",
    notesPage: "Notas (Markdown)",
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
    aiHelp:
      "Puedes crear, editar o borrar eventos, revisar conflictos, asignar calendario (Trabajo, Personal, Familia…) y adjuntar capturas o fotos. El historial se guarda en este dispositivo.",
    noMessages: "Todavía no hay mensajes.",
    structuredResponse: "Respuesta estructurada recibida (tool result).",
    chatPlaceholder: "Texto, captura o pega un mensaje de WhatsApp…",
    chatAttachImage: "Adjuntar imagen",
    chatClearHistory: "Borrar historial del chat",
    chatDefaultImagePrompt: "Extrae fechas y horas de la imagen y agéndalas.",
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
    myUserId: "Tu ID de usuario",
    copyId: "Copiar",
    copied: "Copiado",
    friendIdPlaceholder: "ID del amigo",
    sendFriendRequest: "Enviar solicitud",
    friendRequestsIncoming: "Solicitudes de amistad",
    friendRequestsOutgoing: "Solicitudes enviadas (pendientes)",
    acceptFriend: "Aceptar",
    rejectFriend: "Rechazar",
    noIncomingFriends: "No hay solicitudes pendientes",
    friendsList: "Amigos",
    eventPeopleTitle: "Personas",
    eventFriendsHint: "Marca amigos para incluirlos en el evento",
    eventOtherNamesHint: "Otros nombres (opcional, uno por línea)",
    friendRequestSent: "Solicitud enviada",
    friendRequestError: "No se pudo enviar la solicitud",
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
    notesPage: "Notes (Markdown)",
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
    aiHelp:
      "You can create, edit or delete events, check conflicts, pick a calendar lane (Work, Personal, Family…), and attach screenshots or photos. Chat history is stored on this device.",
    noMessages: "No messages yet.",
    structuredResponse: "Structured response received (tool result).",
    chatPlaceholder: "Type, paste WhatsApp text, or attach a screenshot…",
    chatAttachImage: "Attach image",
    chatClearHistory: "Clear chat history",
    chatDefaultImagePrompt: "Extract dates and times from the image and add them to the calendar.",
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
    myUserId: "Your user ID",
    copyId: "Copy",
    copied: "Copied",
    friendIdPlaceholder: "Friend's user ID",
    sendFriendRequest: "Send request",
    friendRequestsIncoming: "Friend requests",
    friendRequestsOutgoing: "Outgoing (pending)",
    acceptFriend: "Accept",
    rejectFriend: "Decline",
    noIncomingFriends: "No pending requests",
    friendsList: "Friends",
    eventPeopleTitle: "People",
    eventFriendsHint: "Include accepted friends on this event",
    eventOtherNamesHint: "Other names (optional, one per line)",
    friendRequestSent: "Request sent",
    friendRequestError: "Could not send request",
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

function summarizeToolOutput(output: unknown, language: Locale): string {
  if (output === null || output === undefined) return ""
  if (typeof output !== "object") return String(output)
  const o = output as Record<string, unknown>
  if (o.success === false) {
    if (typeof o.error === "string") return o.error
    if (typeof o.message === "string") return o.message
    if (Array.isArray(o.conflicts) && o.conflicts.length > 0) {
      return language === "es" ? "Conflicto de horario con otros eventos." : "Schedule conflict with existing events."
    }
  }
  if (o.success === true && o.event && typeof o.event === "object") {
    const ev = o.event as {
      title?: string
      eventDate?: string
      startTime?: string
      endTime?: string
      color?: string
    }
    const lane = ev.color ? laneLabel(language, ev.color) : ""
    const laneBit = lane ? (language === "es" ? ` · ${lane}` : ` · ${lane}`) : ""
    return language === "es"
      ? `Listo: «${ev.title ?? "?"}» el ${ev.eventDate ?? ""} de ${ev.startTime ?? ""} a ${ev.endTime ?? ""}${laneBit}.`
      : `Done: "${ev.title ?? "?"}" on ${ev.eventDate ?? ""} ${ev.startTime ?? ""}–${ev.endTime ?? ""}${laneBit}.`
  }
  if (o.success === true && !o.event) {
    return language === "es" ? "Operación completada." : "Operation completed."
  }
  if ("message" in o && typeof o.message === "string") return o.message
  if ("hasConflicts" in o) {
    return language === "es"
      ? o.hasConflicts
        ? "Hay solapamientos en ese horario."
        : "Sin conflictos en ese horario."
      : o.hasConflicts
        ? "Overlaps found."
        : "No overlaps."
  }
  try {
    return JSON.stringify(output, null, 0)
  } catch {
    return String(output)
  }
}

const CHAT_STORAGE_PREFIX = "calendar-app-ai-chat-v1:"

function trimChatForStorage(messages: UIMessage[]): UIMessage[] {
  const MAX = 50
  const base = messages.length > MAX ? messages.slice(-MAX) : messages
  return base.map((m, mi) => {
    if (m.role !== "user") return m
    const keepHeavy = mi >= base.length - 3
    if (keepHeavy) return m
    return {
      ...m,
      parts: m.parts.map((p) => {
        if (
          p.type === "file" &&
          "url" in p &&
          typeof p.url === "string" &&
          p.url.startsWith("data:")
        ) {
          return { ...p, url: "[adjunto]" }
        }
        return p
      }),
    }
  })
}

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
  const today = formatISODateLocal(new Date())

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
  const [pendingChatFiles, setPendingChatFiles] = useState<File[]>([])
  const chatFileInputRef = useRef<HTMLInputElement>(null)
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
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)

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

  const [friends, setFriends] = useState<FriendRow[]>([])
  const [incomingRequests, setIncomingRequests] = useState<FriendRequestRow[]>([])
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequestRow[]>([])
  const [friendIdInput, setFriendIdInput] = useState("")
  const [friendActionMsg, setFriendActionMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)
  const [sendingFriendRequest, setSendingFriendRequest] = useState(false)
  const [copiedId, setCopiedId] = useState(false)

  const userId = session?.user?.id
  const chatId = userId ?? "calendar-ai-pending"
  const chatStorageKey = userId ? `${CHAT_STORAGE_PREFIX}${userId}` : null

  const { messages, sendMessage, setMessages, status } = useChat({
    id: chatId,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages }) => ({
        body: { messages, locale: language, today: formatISODateLocal(new Date()) },
      }),
    }),
    onError: (error) => setChatError(error.message),
    onFinish: ({ messages: ms }) => {
      void loadEvents()
      if (!chatStorageKey) return
      try {
        localStorage.setItem(chatStorageKey, JSON.stringify(trimChatForStorage(ms)))
      } catch {
        try {
          localStorage.setItem(chatStorageKey, JSON.stringify(ms.slice(-25)))
        } catch {
          /* quota */
        }
      }
    },
  })

  useEffect(() => {
    if (!chatStorageKey) return
    try {
      const raw = localStorage.getItem(chatStorageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as UIMessage[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        setMessages(parsed)
      }
    } catch {
      /* ignore */
    }
  }, [chatStorageKey, setMessages])

  async function loadFriendsData() {
    const res = await fetch("/api/friends")
    if (!res.ok) return
    const data = await res.json()
    setFriends(data.friends ?? [])
    setIncomingRequests(data.incoming ?? [])
    setOutgoingRequests(data.outgoing ?? [])
  }

  useEffect(() => {
    if (sessionStatus !== "authenticated") return
    void loadFriendsData()
  }, [sessionStatus])

  useEffect(() => {
    if (createOpen && sessionStatus === "authenticated") void loadFriendsData()
  }, [createOpen, sessionStatus])

  useEffect(() => {
    if (settingsOpen && sessionStatus === "authenticated") void loadFriendsData()
  }, [settingsOpen, sessionStatus])

  async function sendFriendRequestAction() {
    if (!friendIdInput.trim()) return
    setSendingFriendRequest(true)
    setFriendActionMsg(null)
    const res = await fetch("/api/friends/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: friendIdInput.trim() }),
    })
    const data = await res.json().catch(() => ({}))
    setSendingFriendRequest(false)
    if (!res.ok) {
      setFriendActionMsg({ type: "err", text: data.error ?? t.friendRequestError })
      return
    }
    setFriendIdInput("")
    setFriendActionMsg({
      type: "ok",
      text: data.autoAccepted ? (language === "es" ? "¡Ahora sois amigos!" : "You're now friends!") : t.friendRequestSent,
    })
    await loadFriendsData()
  }

  async function respondFriendRequest(requestId: string, accept: boolean) {
    const res = await fetch("/api/friends/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, accept }),
    })
    if (res.ok) await loadFriendsData()
  }

  const submitAiChat = () => {
    if (status === "streaming") return
    const text = chatInput.trim()
    if (!text && pendingChatFiles.length === 0) return
    const prompt =
      text || (pendingChatFiles.length > 0 ? t.chatDefaultImagePrompt : "")
    if (pendingChatFiles.length > 0) {
      const dt = new DataTransfer()
      pendingChatFiles.forEach((f) => dt.items.add(f))
      void sendMessage({ text: prompt, files: dt.files })
    } else {
      void sendMessage({ text: prompt })
    }
    setChatInput("")
    setPendingChatFiles([])
    if (chatFileInputRef.current) chatFileInputRef.current.value = ""
  }

  const clearAiChatHistory = () => {
    setMessages([])
    if (chatStorageKey) {
      try {
        localStorage.removeItem(chatStorageKey)
      } catch {
        /* ignore */
      }
    }
  }

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

  /**
   * Suscripción SSE: cuando otro dispositivo / la IA / WhatsApp (futuro)
   * crea, edita o borra un evento, refrescamos la lista en vivo. Si el
   * navegador está en background, también refresca al volver al primer
   * plano por si la conexión SSE se cortó.
   */
  useEffect(() => {
    if (sessionStatus !== "authenticated") return
    let es: EventSource | null = null
    let cancelled = false
    let pendingReload: ReturnType<typeof setTimeout> | null = null

    const scheduleReload = () => {
      if (pendingReload) return
      pendingReload = setTimeout(() => {
        pendingReload = null
        if (!cancelled) void loadEvents()
      }, 250)
    }

    try {
      es = new EventSource("/api/events/stream")
      es.addEventListener("change", scheduleReload)
      es.onerror = () => {
        if (es && es.readyState === EventSource.CLOSED && !cancelled) {
          setTimeout(() => {
            if (!cancelled) void loadEvents()
          }, 5_000)
        }
      }
    } catch {
      /* navegador sin EventSource */
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") void loadEvents()
    }
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      cancelled = true
      if (pendingReload) clearTimeout(pendingReload)
      document.removeEventListener("visibilitychange", onVisible)
      if (es) es.close()
    }
  }, [sessionStatus])

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

    const { attendeesText, ...rest } = payload
    const body = {
      ...rest,
      attendees: attendeesFromText(attendeesText),
      allowConflict,
    }

    const isEditing = Boolean(editingEventId)
    const response = await fetch(isEditing ? `/api/events/${editingEventId}` : "/api/events", {
      method: isEditing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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

    const allowedColors = ["bg-blue-500", "bg-green-500", "bg-orange-500", "bg-purple-500"] as const
    const inferredColor =
      typeof parsed.color === "string" && (allowedColors as readonly string[]).includes(parsed.color)
        ? parsed.color
        : "bg-blue-500"

    await saveEvent({
      title: parsed.title,
      eventDate: parsed.date ?? today,
      startTime: parsed.startTime ?? "09:00",
      endTime: parsed.endTime ?? "10:00",
      description: parsed.description ?? "",
      location: parsed.location ?? "",
      color: inferredColor,
      attendeesText: "",
      participantUserIds: [],
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
      attendeesText: event.attendees?.length ? event.attendees.join("\n") : "",
      participantUserIds: [...(event.participantUserIds ?? [])],
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

  function openCreateAtHour(date: string, hour: number) {
    const startTime = `${String(hour).padStart(2, "0")}:00`
    const endTime = `${String(Math.min(hour + 1, 23)).padStart(2, "0")}:00`
    setEditingEventId(null)
    setEventForm({
      ...initialForm,
      eventDate: date,
      startTime,
      endTime,
    })
    setCreateOpen(true)
  }

  function handleSwipeDay(direction: -1 | 1) {
    if (viewMode !== "day") return
    setAnchorDate(addDays(anchorDate, direction))
  }

  function openCreateBlank() {
    setEditingEventId(null)
    setEventForm({ ...initialForm, eventDate: anchorDate })
    setCreateOpen(true)
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
    <main className="relative min-h-[100dvh] text-white md:overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-0">
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

      <div className="relative z-10 flex w-full flex-col pb-safe md:h-[100dvh] md:min-h-[100dvh] md:flex-row md:overflow-hidden">
        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetContent
            side="left"
            className="flex max-h-[100dvh] w-[min(100vw-0.5rem,320px)] flex-col overflow-hidden border-white/15 bg-slate-950/98 p-0 text-white backdrop-blur-xl sm:max-w-[300px]"
          >
            <div className="box-border min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-4 pb-safe pt-safe [-webkit-overflow-scrolling:touch]">
              <CalendarSidebarContent
                mobileDrawer
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

        <div className="flex min-w-0 flex-1 flex-col md:min-h-0">
          <div className="sticky top-0 z-30 shrink-0 border-b border-white/10 bg-slate-950/80 px-safe py-2 backdrop-blur-xl md:static md:bg-slate-950/45 md:py-3 md:px-5">
            <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  className={`${glassInset} inline-flex h-11 w-11 shrink-0 items-center justify-center md:hidden`}
                  onClick={() => setMobileSidebarOpen(true)}
                  aria-label="Menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div className="flex min-w-0 flex-1 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => navigateCalendar(-1)}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white/85 transition active:bg-white/10 md:h-10 md:w-10"
                    aria-label={t.prevMonth}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <h2 className="min-w-0 flex-1 truncate text-center text-sm font-semibold capitalize leading-snug tracking-tight text-white sm:text-base md:text-left md:text-lg lg:text-xl">
                    {navTitle}
                  </h2>
                  <button
                    type="button"
                    onClick={() => navigateCalendar(1)}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white/85 transition active:bg-white/10 md:h-10 md:w-10"
                    aria-label={t.nextMonth}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileSearchOpen((v) => !v)}
                  className={`${glassInset} inline-flex h-11 w-11 shrink-0 items-center justify-center md:hidden`}
                  aria-label={t.searchPlaceholder}
                  aria-pressed={mobileSearchOpen}
                >
                  <Search className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className={`${glassInset} inline-flex h-11 w-11 shrink-0 items-center justify-center md:hidden`}
                  aria-label={t.settings}
                >
                  <Settings className="h-5 w-5" />
                </button>
              </div>

              {mobileSearchOpen ? (
                <div className={`${glassInset} flex items-center gap-2 px-3 py-2 md:hidden`}>
                  <Search className="h-4 w-4 shrink-0 text-white/45" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-white/35"
                    placeholder={t.searchPlaceholder}
                    enterKeyHint="search"
                    autoFocus
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="text-xs text-white/55"
                      aria-label="Clear"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="hidden flex-wrap items-center gap-2 md:flex md:flex-1">
                <button
                  type="button"
                  onClick={goToToday}
                  className="min-h-10 shrink-0 rounded-lg bg-sky-500/35 px-3 py-2 text-sm font-medium text-sky-100 ring-1 ring-sky-400/35 transition hover:bg-sky-500/45"
                >
                  {t.goToday}
                </button>
                <div
                  className={`${glassInset} flex min-w-0 max-w-xs flex-1 items-center gap-2 px-3 py-2`}
                >
                  <Search className="h-4 w-4 shrink-0 text-white/45" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/35"
                    placeholder={t.searchPlaceholder}
                    enterKeyHint="search"
                  />
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <div className={`${glassInset} flex min-h-10 items-center gap-1 px-2 py-1.5 text-sm`}>
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
                  {isAdmin ? (
                    <Link
                      href="/notas"
                      className={`${glassInset} inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg p-2 transition hover:bg-white/[0.08]`}
                      aria-label={t.notesPage}
                      title={t.notesPage}
                    >
                      <FileText className="h-4 w-4" />
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(true)}
                    className={`${glassInset} inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg p-2`}
                    aria-label={t.settings}
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-sky-500 text-sm font-bold text-white ring-2 ring-white/25"
                    title={session?.user?.email ?? ""}
                  >
                    {(session?.user?.email?.[0] ?? "U").toUpperCase()}
                  </div>
                  <div className="flex rounded-xl border border-white/15 bg-white/[0.06] p-1">
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
                        className={`min-h-10 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
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
            </div>
          </div>

          <div className="px-safe pb-[calc(env(safe-area-inset-bottom)+96px)] pt-3 md:pb-4 md:min-h-0 md:flex-1 md:overflow-auto md:overscroll-contain md:px-6 md:py-4">
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
                onCreateAtHour={openCreateAtHour}
                onSwipeDay={handleSwipeDay}
              />
            )}
          </div>
        </div>

        {!aiWelcomeDismissed ? (
          <div className="pointer-events-auto fixed left-4 right-4 z-[60] mx-auto max-w-sm rounded-2xl border border-white/20 bg-slate-950/90 p-4 shadow-[0_12px_48px_rgba(0,0,0,0.45)] backdrop-blur-xl bottom-[calc(env(safe-area-inset-bottom)+76px)] md:bottom-[max(1.25rem,env(safe-area-inset-bottom))] sm:left-auto sm:right-[max(1.5rem,env(safe-area-inset-right))] sm:mx-0 md:right-8">
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
          <div className="pointer-events-none fixed z-[60] flex flex-col items-end gap-2 right-[max(1rem,env(safe-area-inset-right))] md:right-8 bottom-[calc(env(safe-area-inset-bottom)+72px)] md:bottom-[max(1.25rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => setAiSheetOpen(true)}
              className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-sky-500 text-white shadow-xl ring-2 ring-white/25 transition active:scale-95"
              aria-label={t.openChat}
            >
              <Sparkles className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={openCreateBlank}
              className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-sky-500 text-white shadow-2xl ring-2 ring-sky-300/40 transition active:scale-95"
              aria-label={t.sheetCreate}
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>
        )}

        <MobileBottomNav
          viewMode={viewMode}
          onChangeView={setViewMode}
          onGoToday={goToToday}
          labels={{ day: t.viewDay, week: t.viewWeek, month: t.viewMonth, today: t.goToday }}
        />

        <Sheet open={createOpen} onOpenChange={setCreateOpen}>
          <SheetContent
            side="right"
            className="h-[100dvh] max-h-[100dvh] w-full max-w-lg overflow-y-auto border-white/15 bg-slate-950/98 px-4 pb-safe pt-safe text-white backdrop-blur-xl sm:px-6 sm:pb-6"
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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
              <div className="rounded-xl border border-white/15 bg-white/[0.04] p-3">
                <p className="mb-2 text-sm font-medium text-white/90">{t.eventPeopleTitle}</p>
                <p className="mb-3 text-xs text-white/50">{t.eventFriendsHint}</p>
                {friends.length === 0 ? (
                  <p className="text-xs text-white/40">
                    {language === "es"
                      ? "Añade amigos desde Configuración con su ID."
                      : "Add friends from Settings using their ID."}
                  </p>
                ) : (
                  <ul className="mb-3 max-h-40 space-y-2 overflow-y-auto">
                    {friends.map((f) => (
                      <li key={f.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`friend-${f.id}`}
                          checked={eventForm.participantUserIds.includes(f.id)}
                          onChange={() =>
                            setEventForm((prev) => ({
                              ...prev,
                              participantUserIds: prev.participantUserIds.includes(f.id)
                                ? prev.participantUserIds.filter((x) => x !== f.id)
                                : [...prev.participantUserIds, f.id],
                            }))
                          }
                          className="h-4 w-4 rounded border-white/30 bg-white/10"
                        />
                        <label htmlFor={`friend-${f.id}`} className="cursor-pointer text-sm text-white/85">
                          {f.name ?? f.email}
                          <span className="ml-1 text-[10px] text-white/35">{f.id.slice(0, 8)}…</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                <label className="mb-1 block text-xs text-white/55">{t.eventOtherNamesHint}</label>
                <textarea
                  className={`${inputGlass} min-h-[4rem] resize-y font-mono text-sm`}
                  value={eventForm.attendeesText}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, attendeesText: e.target.value }))}
                  placeholder={language === "es" ? "Ana\nEquipo ventas" : "Ana\nSales team"}
                />
              </div>
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
                      setEventForm({ ...initialForm, eventDate: formatISODateLocal(new Date()) })
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
            className="h-[100dvh] max-h-[100dvh] w-full max-w-md overflow-y-auto border-white/15 bg-slate-950/98 px-4 pb-safe pt-safe text-white backdrop-blur-xl sm:px-6 sm:pb-6"
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

              <div className="border-t border-white/10 pt-4">
                <h3 className="font-medium text-white/90">{t.myUserId}</h3>
                <p className="mt-1 text-xs text-white/45">
                  {language === "es"
                    ? "Comparte este ID para que otros te envíen una solicitud de amistad."
                    : "Share this ID so others can send you a friend request."}
                </p>
                <div className="mt-2 flex flex-wrap items-stretch gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs text-white/85">
                    {session?.user?.id ?? "—"}
                  </code>
                  <button
                    type="button"
                    className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm transition hover:bg-white/15"
                    onClick={async () => {
                      if (!session?.user?.id) return
                      await navigator.clipboard.writeText(session.user.id)
                      setCopiedId(true)
                      setTimeout(() => setCopiedId(false), 2000)
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copiedId ? t.copied : t.copyId}
                  </button>
                </div>
              </div>

              <div className="mt-4 border-t border-white/10 pt-4">
                <h3 className="flex items-center gap-2 font-medium text-white/90">
                  <UserPlus className="h-4 w-4 text-sky-300" />
                  {language === "es" ? "Añadir amigo" : "Add friend"}
                </h3>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    className={inputGlass}
                    placeholder={t.friendIdPlaceholder}
                    value={friendIdInput}
                    onChange={(e) => setFriendIdInput(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={sendingFriendRequest || !friendIdInput.trim()}
                    onClick={() => void sendFriendRequestAction()}
                    className="shrink-0 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2 text-sm font-medium shadow-lg disabled:opacity-50"
                  >
                    {sendingFriendRequest ? "…" : t.sendFriendRequest}
                  </button>
                </div>
                {friendActionMsg ? (
                  <p
                    className={`mt-2 text-sm ${friendActionMsg.type === "ok" ? "text-green-400" : "text-red-400"}`}
                  >
                    {friendActionMsg.text}
                  </p>
                ) : null}
              </div>

              <div className="mt-4 border-t border-white/10 pt-4">
                <h3 className="text-sm font-medium text-white/90">{t.friendRequestsIncoming}</h3>
                {incomingRequests.length === 0 ? (
                  <p className="mt-2 text-sm text-white/40">{t.noIncomingFriends}</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {incomingRequests.map((req) => (
                      <li
                        key={req.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm"
                      >
                        <span className="text-white/85">
                          {req.fromUser?.name ?? req.fromUser?.email ?? req.fromUserId}
                        </span>
                        <span className="flex gap-1">
                          <button
                            type="button"
                            className="rounded-md bg-emerald-500/30 px-2 py-1 text-xs text-emerald-100"
                            onClick={() => void respondFriendRequest(req.id, true)}
                          >
                            {t.acceptFriend}
                          </button>
                          <button
                            type="button"
                            className="rounded-md bg-white/10 px-2 py-1 text-xs text-white/80"
                            onClick={() => void respondFriendRequest(req.id, false)}
                          >
                            {t.rejectFriend}
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {outgoingRequests.length > 0 ? (
                <div className="mt-4 border-t border-white/10 pt-4">
                  <h3 className="text-sm font-medium text-white/90">{t.friendRequestsOutgoing}</h3>
                  <ul className="mt-2 space-y-1 text-sm text-white/55">
                    {outgoingRequests.map((req) => (
                      <li key={req.id}>
                        → {req.toUser?.name ?? req.toUser?.email ?? req.toUserId}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {friends.length > 0 ? (
                <div className="mt-4 border-t border-white/10 pt-4">
                  <h3 className="text-sm font-medium text-white/90">{t.friendsList}</h3>
                  <ul className="mt-2 space-y-1 text-sm text-white/75">
                    {friends.map((f) => (
                      <li key={f.id}>
                        {f.name ?? f.email}{" "}
                        <span className="text-[10px] text-white/35">({f.id.slice(0, 10)}…)</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <ContactsManager language={language} inputClassName={inputGlass} />

              <CalendarFeedCard language={language} />

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
            className="flex h-[100dvh] max-h-[100dvh] w-full max-w-md flex-col overflow-hidden border-white/15 bg-slate-950/98 px-4 pb-safe pt-safe text-white backdrop-blur-xl sm:px-6 sm:pb-6"
          >
            <SheetHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
              <SheetTitle>{t.sheetAi}</SheetTitle>
              <button
                type="button"
                onClick={clearAiChatHistory}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/15 px-2 py-1 text-xs text-white/70 transition hover:bg-white/10"
                title={t.chatClearHistory}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t.chatClearHistory}
              </button>
            </SheetHeader>
            <p className="mt-2 shrink-0 text-sm text-white/65">{t.aiHelp}</p>
            <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
            <div className={`${glassInset} min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3`}>
              {messages.length === 0 ? (
                <p className="text-sm text-white/45">{t.noMessages}</p>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className="text-sm text-white/90">
                    <p className="mb-1 text-xs uppercase tracking-wide text-white/45">
                      {message.role === "user"
                        ? t.roleUser
                        : message.role === "assistant"
                          ? t.roleAssistant
                          : message.role}
                    </p>
                    <div className="space-y-2">
                      {message.parts.map((part, pi) => {
                        if (isReasoningUIPart(part)) return null
                        if (isTextUIPart(part)) {
                          return part.text ? (
                            <p key={pi} className="whitespace-pre-wrap text-white/85">
                              {part.text}
                            </p>
                          ) : null
                        }
                        if (isFileUIPart(part)) {
                          if (part.mediaType?.startsWith("image/") && part.url && part.url !== "[adjunto]") {
                            return (
                              // eslint-disable-next-line @next/next/no-img-element -- data URLs del chat
                              <img
                                key={pi}
                                src={part.url}
                                alt=""
                                className="max-h-40 max-w-full rounded-lg border border-white/15 object-contain"
                              />
                            )
                          }
                          return (
                            <p key={pi} className="text-xs text-white/45">
                              {language === "es" ? "Archivo adjunto" : "Attachment"}
                            </p>
                          )
                        }
                        if (isToolUIPart(part)) {
                          const toolName = part.type.startsWith("tool-")
                            ? part.type.slice(5)
                            : part.type
                          const out =
                            part.state === "output-available" && "output" in part
                              ? (part as { output?: unknown }).output
                              : undefined
                          const pending =
                            part.state === "input-streaming" || part.state === "input-available"
                          return (
                            <div
                              key={pi}
                              className="rounded-lg border border-white/10 bg-white/[0.06] p-2 text-xs"
                            >
                              <p className="font-medium text-sky-200/90">{toolName}</p>
                              {pending ? (
                                <p className="text-white/50">
                                  {language === "es" ? "Ejecutando…" : "Running…"}
                                </p>
                              ) : (
                                <p className="text-white/85">
                                  {summarizeToolOutput(out, language) ||
                                    (language === "es" ? "(sin salida)" : "(no output)")}
                                </p>
                              )}
                            </div>
                          )
                        }
                        return null
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
            <input
              ref={chatFileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const list = e.target.files
                if (!list?.length) return
                setPendingChatFiles((prev) => [...prev, ...Array.from(list)])
              }}
            />
            {pendingChatFiles.length > 0 ? (
              <div className="flex flex-wrap gap-2 text-xs text-white/70">
                {pendingChatFiles.map((f, i) => (
                  <span
                    key={`${f.name}-${i}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/[0.06] px-2 py-1"
                  >
                    {f.name}
                    <button
                      type="button"
                      className="text-white/50 hover:text-white"
                      onClick={() =>
                        setPendingChatFiles((prev) => prev.filter((_, j) => j !== i))
                      }
                      aria-label={language === "es" ? "Quitar" : "Remove"}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => chatFileInputRef.current?.click()}
                disabled={status === "streaming"}
                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/[0.08] px-3 py-2 text-white/90 transition hover:bg-white/15 disabled:opacity-50"
                title={t.chatAttachImage}
              >
                <ImagePlus className="h-4 w-4" />
              </button>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    submitAiChat()
                  }
                }}
                className={`${inputGlass} min-h-11 min-w-0 flex-1 text-base sm:text-sm`}
                placeholder={t.chatPlaceholder}
              />
              <button
                type="button"
                onClick={() => submitAiChat()}
                disabled={
                  status === "streaming" || (!chatInput.trim() && pendingChatFiles.length === 0)
                }
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2 font-medium shadow-lg disabled:opacity-50"
              >
                {status === "streaming" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
            {chatError ? <p className="text-sm text-red-300">{chatError}</p> : null}
            </div>
          </SheetContent>
        </Sheet>
      </div>

    </main>
  )
}
