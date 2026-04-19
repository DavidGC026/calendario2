import { openai } from "@ai-sdk/openai"
import { generateText, Output } from "ai"
import { z } from "zod"

import { getCurrentUserId } from "@/lib/auth"
import { calendarLanePromptBlock } from "@/lib/calendar-lanes"

export async function POST(req: Request) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return Response.json({ error: "No autenticado" }, { status: 401 })
  }

  const {
    text,
    currentDate,
    locale = "es",
  }: { text: string; currentDate: string; locale?: "es" | "en" } = await req.json()
  const isEnglish = locale === "en"

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
      ? `Extract the event information from this text: "${text}"`
      : `Extrae la información del siguiente texto para crear un evento de calendario: "${text}"`,
    output: Output.object({
      schema: z.object({
        title: z.string().describe('Título del evento'),
        date: z.string().describe('Fecha en formato YYYY-MM-DD'),
        startTime: z.string().describe('Hora de inicio en formato HH:MM (24h)'),
        endTime: z.string().describe('Hora de fin en formato HH:MM (24h)'),
        description: z.string().nullable().describe('Descripción opcional del evento'),
        location: z.string().nullable().describe('Ubicación opcional'),
        attendees: z.array(z.string()).nullable().describe('Lista de asistentes mencionados'),
        color: z
          .enum(["bg-blue-500", "bg-green-500", "bg-orange-500", "bg-purple-500"])
          .nullable()
          .describe(
            'Calendario inferido del contexto: bg-green-500 Trabajo, bg-purple-500 Familia, bg-orange-500 Personal, bg-blue-500 Mi calendario; null si es ambiguo',
          ),
      }),
    }),
  })

  return Response.json(result.output)
}
