import { z } from "zod"

import { requireAdmin } from "@/lib/auth"
import {
  getOpenAiKeyPublicStatus,
  isPlausibleOpenAiKey,
  pingOpenAiApiKey,
  resetOpenAiApiKeyToEnv,
  saveOpenAiApiKey,
} from "@/lib/openai-settings"

export const dynamic = "force-dynamic"

const putSchema = z.object({
  apiKey: z.string().optional(),
  resetToEnv: z.boolean().optional(),
})

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) {
    return Response.json({ error: "No autorizado" }, { status: 403 })
  }
  const status = await getOpenAiKeyPublicStatus()
  return Response.json(status)
}

export async function PUT(req: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return Response.json({ error: "No autorizado" }, { status: 403 })
  }

  const json = await req.json().catch(() => null)
  const parsed = putSchema.safeParse(json)
  if (!parsed.success) {
    return Response.json({ error: "Payload inválido" }, { status: 400 })
  }

  if (parsed.data.resetToEnv) {
    await resetOpenAiApiKeyToEnv()
    return Response.json(await getOpenAiKeyPublicStatus())
  }

  const apiKey = parsed.data.apiKey?.trim() ?? ""
  if (!isPlausibleOpenAiKey(apiKey)) {
    return Response.json(
      { error: "La clave no parece de OpenAI (debe empezar por sk-)." },
      { status: 400 },
    )
  }

  const ping = await pingOpenAiApiKey(apiKey)
  if (!ping.ok) {
    return Response.json({ error: ping.error }, { status: 400 })
  }

  await saveOpenAiApiKey(apiKey)
  return Response.json(await getOpenAiKeyPublicStatus())
}
