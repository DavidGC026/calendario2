import { z } from "zod"

import { getCurrentUserId } from "@/lib/auth"
import { MAX_ACTIVE_KEYS, createApiKey, listApiKeys } from "@/lib/api-keys"

export const dynamic = "force-dynamic"

/**
 * Administrar llaves pide sesión de verdad, no una llave.
 *
 * Si una llave pudiera crear otras, revocar la que se filtró no serviría de
 * nada: ya habría hecho tres más. Aquí solo entra la web o la app, donde hay una
 * contraseña detrás.
 */
async function requireSessionUser() {
  return getCurrentUserId({ allowApiKey: false })
}

export async function GET() {
  const userId = await requireSessionUser()
  if (!userId) return Response.json({ error: "No autenticado" }, { status: 401 })

  return Response.json({ apiKeys: await listApiKeys(userId) })
}

const createSchema = z.object({
  name: z.string().min(1).max(80),
  /** Sin caducidad por omisión: un servicio que se apaga solo a los 90 días no es un servicio. */
  expiresInDays: z.number().int().positive().max(3650).nullable().optional(),
})

export async function POST(req: Request) {
  const userId = await requireSessionUser()
  if (!userId) return Response.json({ error: "No autenticado" }, { status: 401 })

  const json = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(json)
  if (!parsed.success) {
    return Response.json({ error: "Ponle un nombre a la llave" }, { status: 400 })
  }

  const result = await createApiKey(userId, parsed.data)
  if (!result.ok) {
    return Response.json(
      {
        error:
          result.error === "TOO_MANY_KEYS"
            ? `Ya tienes ${MAX_ACTIVE_KEYS} llaves activas; revoca alguna antes de crear otra.`
            : "Ponle un nombre a la llave",
      },
      { status: result.error === "TOO_MANY_KEYS" ? 409 : 400 },
    )
  }

  // `key` va aquí y en ningún otro sitio nunca más: no se guarda en claro, así
  // que si el usuario no la copia ahora, toca hacer otra.
  return Response.json({ key: result.key, apiKey: result.apiKey }, { status: 201 })
}
