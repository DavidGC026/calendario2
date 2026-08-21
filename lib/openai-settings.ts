import { createOpenAI } from "@ai-sdk/openai"

import { prisma } from "@/lib/prisma"
import { decryptSecret, encryptSecret } from "@/lib/secret-box"

export const OPENAI_SETTING_KEY = "openai_api_key"

export type OpenAiKeySource = "database" | "env" | "none"

export type OpenAiKeyPublicStatus = {
  configured: boolean
  source: OpenAiKeySource
  hint: string | null
}

const MIN_KEY_LENGTH = 20

let cache: { apiKey: string | null; at: number } | null = null
const CACHE_MS = 8_000

function envKey(): string | null {
  const raw = process.env.OPENAI_API_KEY?.trim()
  return raw ? raw : null
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) return "••••"
  return `${key.slice(0, 3)}…${key.slice(-4)}`
}

export function isPlausibleOpenAiKey(value: string): boolean {
  const t = value.trim()
  if (t.length < MIN_KEY_LENGTH) return false
  return /^sk-[A-Za-z0-9_\-]+$/.test(t)
}

function bustCache() {
  cache = null
}

async function readOverride(): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({
    where: { key: OPENAI_SETTING_KEY },
    select: { value: true },
  })
  if (!row?.value) return null
  try {
    const plain = decryptSecret(row.value).trim()
    return plain || null
  } catch (err) {
    console.error("[openai-settings] no se pudo descifrar la clave guardada:", err)
    return null
  }
}

/** Clave efectiva: override del admin, o `OPENAI_API_KEY` del entorno. */
export async function getOpenAiApiKey(): Promise<string | null> {
  const now = Date.now()
  if (cache && now - cache.at < CACHE_MS) return cache.apiKey
  const fromDb = await readOverride()
  const apiKey = fromDb ?? envKey()
  cache = { apiKey, at: now }
  return apiKey
}

export async function getOpenAiKeyPublicStatus(): Promise<OpenAiKeyPublicStatus> {
  const fromDb = await readOverride()
  if (fromDb) {
    return { configured: true, source: "database", hint: maskApiKey(fromDb) }
  }
  const fromEnv = envKey()
  if (fromEnv) {
    return { configured: true, source: "env", hint: maskApiKey(fromEnv) }
  }
  return { configured: false, source: "none", hint: null }
}

export async function getOpenAiProvider() {
  const apiKey = await getOpenAiApiKey()
  if (!apiKey) return null
  return createOpenAI({ apiKey })
}

export async function saveOpenAiApiKey(apiKey: string) {
  const trimmed = apiKey.trim()
  if (!isPlausibleOpenAiKey(trimmed)) {
    throw new Error("INVALID_KEY")
  }
  await prisma.appSetting.upsert({
    where: { key: OPENAI_SETTING_KEY },
    create: { key: OPENAI_SETTING_KEY, value: encryptSecret(trimmed) },
    update: { value: encryptSecret(trimmed) },
  })
  bustCache()
}

export async function resetOpenAiApiKeyToEnv() {
  await prisma.appSetting.deleteMany({ where: { key: OPENAI_SETTING_KEY } })
  bustCache()
}

/** Comprueba que OpenAI acepte la clave (sin gastar tokens de chat). */
export async function pingOpenAiApiKey(apiKey: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    })
    if (res.ok) return { ok: true }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "OpenAI rechazó la clave (401/403)." }
    }
    return { ok: false, error: `OpenAI respondió ${res.status}. Inténtalo de nuevo.` }
  } catch {
    return { ok: false, error: "No se pudo contactar con OpenAI para validar la clave." }
  }
}
