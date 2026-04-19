import { getCurrentUserId } from "@/lib/auth"
import { rateLimit, rateLimitResponse, clientIp } from "@/lib/rate-limit"

export const maxDuration = 60
export const dynamic = "force-dynamic"

const MAX_BYTES = 12 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/x-m4a",
])

/**
 * Transcribe un audio enviado como multipart/form-data (`file`) usando
 * Whisper (`gpt-4o-mini-transcribe`). Acepta el `locale` enviado en el form
 * para mejorar la precisión y los nombres de meses/personas.
 *
 * Auth: cookie de sesión web o cabecera `Authorization: Bearer <token>`
 * para la app móvil.
 */
export async function POST(req: Request) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return Response.json({ error: "No autenticado" }, { status: 401 })
  }

  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "OPENAI_API_KEY no configurada" }, { status: 503 })
  }

  const ip = clientIp(req)
  const rl = rateLimit(`transcribe:${userId}:${ip}`, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse(rl)

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return Response.json({ error: "Formulario inválido" }, { status: 400 })
  }

  const file = form.get("file")
  if (!(file instanceof File)) {
    return Response.json({ error: "Falta el campo 'file'" }, { status: 400 })
  }
  if (file.size === 0) {
    return Response.json({ error: "Archivo vacío" }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Archivo demasiado grande" }, { status: 413 })
  }
  // Algunos navegadores envían type vacío: lo dejamos pasar y lo deduce Whisper.
  if (file.type && !ALLOWED_TYPES.has(file.type)) {
    return Response.json({ error: `Tipo no soportado: ${file.type}` }, { status: 415 })
  }

  const localeRaw = (form.get("locale") || "").toString().toLowerCase()
  const locale = localeRaw === "en" ? "en" : "es"

  const upstream = new FormData()
  upstream.append("file", file, (file as File).name || "audio.webm")
  upstream.append("model", "gpt-4o-mini-transcribe")
  upstream.append("language", locale)
  upstream.append("response_format", "json")
  upstream.append(
    "prompt",
    locale === "es"
      ? "Calendario, recordatorios, eventos. Nombres en español."
      : "Calendar, reminders, events. English names.",
  )

  let res: Response
  try {
    res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: upstream,
    })
  } catch (err) {
    return Response.json({ error: "Fallo de red contra OpenAI", detail: String(err) }, { status: 502 })
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    return Response.json(
      { error: "Whisper no pudo transcribir", detail: text.slice(0, 500) },
      { status: 502 },
    )
  }

  const data = (await res.json()) as { text?: string }
  return Response.json({ text: (data.text ?? "").trim(), locale })
}
