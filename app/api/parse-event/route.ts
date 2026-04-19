import { openai } from "@ai-sdk/openai"
import { generateText, Output } from "ai"
import { z } from "zod"

import { getCurrentUserId } from "@/lib/auth"
import { calendarLanePromptBlock } from "@/lib/calendar-lanes"
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit"

/**
 * Cache LRU mínima en memoria: misma frase + mismo "today" devuelve la misma
 * extracción sin llamar al LLM. Evita coste cuando el usuario duda y reenvía
 * el mismo prompt varias veces.
 */
const PARSE_CACHE_MAX = 200
const parseCache = new Map<string, unknown>()

function cacheGet(key: string): unknown | undefined {
  if (!parseCache.has(key)) return undefined
  const value = parseCache.get(key)
  // Reinserta para mover al final (LRU).
  parseCache.delete(key)
  parseCache.set(key, value)
  return value
}

function cacheSet(key: string, value: unknown) {
  if (parseCache.has(key)) parseCache.delete(key)
  parseCache.set(key, value)
  if (parseCache.size > PARSE_CACHE_MAX) {
    const oldest = parseCache.keys().next().value
    if (oldest) parseCache.delete(oldest)
  }
}

const outputSchema = z.object({
  title: z.string().describe("Título del evento"),
  date: z.string().describe("Fecha en formato YYYY-MM-DD"),
  startTime: z.string().describe("Hora de inicio en formato HH:MM (24h)"),
  endTime: z.string().describe("Hora de fin en formato HH:MM (24h)"),
  description: z.string().nullable().describe("Descripción opcional del evento"),
  location: z.string().nullable().describe("Ubicación opcional"),
  attendees: z.array(z.string()).nullable().describe("Lista de asistentes mencionados"),
  color: z
    .enum(["bg-blue-500", "bg-green-500", "bg-orange-500", "bg-purple-500"])
    .nullable()
    .describe(
      "Calendario inferido del contexto: bg-green-500 Trabajo, bg-purple-500 Familia, bg-orange-500 Personal, bg-blue-500 Mi calendario; null si es ambiguo",
    ),
})

export async function POST(req: Request) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return Response.json({ error: "No autenticado" }, { status: 401 })
  }

  // 20 análisis/min por usuario.
  const rl = rateLimit(`parse:${userId}`, 20, 60_000)
  if (!rl.allowed) {
    return rateLimitResponse(rl, "Demasiadas peticiones a la IA. Espera unos segundos.")
  }

  const {
    text,
    currentDate,
    locale = "es",
  }: { text: string; currentDate: string; locale?: "es" | "en" } = await req.json()
  const isEnglish = locale === "en"

  const trimmed = (text ?? "").trim()
  if (!trimmed) {
    return Response.json({ error: "Texto vacío" }, { status: 400 })
  }

  const cacheKey = `${locale}|${currentDate}|${trimmed}`
  const cached = cacheGet(cacheKey)
  if (cached !== undefined) {
    return Response.json(cached, { headers: { "X-Cache": "HIT" } })
  }

  const result = await generateText({
    model: openai("gpt-4o-mini"),
    system: isEnglish
      ? `You extract calendar event details from natural language.
Current date is ${currentDate}. Interpret relative dates like "tomorrow", "next monday", etc.
${calendarLanePromptBlock(true)}
For this single-shot extractor (no chat back-and-forth) you cannot ask the user, so:
- If context clearly suggests a lane, set "color" to that exact class.
- If truly ambiguous, leave "color" as null and the UI will fall back to the default.
Return values that fit the requested schema.`
      : `Eres un asistente que extrae información de eventos de texto en lenguaje natural.
La fecha actual es ${currentDate}. Interpreta fechas relativas como "mañana", "próximo lunes", etc.
${calendarLanePromptBlock(false)}
En este extractor de una sola pasada (sin diálogo) NO puedes preguntar al usuario, así que:
- Si el contexto sugiere claramente un lane, pon "color" con esa clase exacta.
- Si es realmente ambiguo, deja "color" en null y la UI usará el calendario por defecto.
Devuelve valores que encajen en el esquema solicitado.`,
    prompt: isEnglish
      ? `Extract the event information from this text: "${trimmed}"`
      : `Extrae la información del siguiente texto para crear un evento de calendario: "${trimmed}"`,
    output: Output.object({ schema: outputSchema }),
  })

  cacheSet(cacheKey, result.output)
  return Response.json(result.output, { headers: { "X-Cache": "MISS" } })
}
