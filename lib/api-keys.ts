import { createHash, randomBytes } from "node:crypto"

import { prisma } from "@/lib/prisma"

/**
 * Llaves de API: dejar entrar a un programa sin darle la contraseña.
 *
 * Antes, para que Jarvis leyera la agenda había que ponerle el correo y la
 * contraseña en su `.env`. Eso significa que quitarle el acceso obliga a cambiar
 * la contraseña, y cambiarla echa fuera también al teléfono y a la web. Una
 * llave por programa se revoca sola y no arrastra a nadie.
 *
 * El secreto se guarda hasheado y se enseña una sola vez, al crearlo. No hay
 * manera de recuperarlo después: si se pierde, se revoca esa llave y se hace
 * otra, que cuesta un botón.
 */

/**
 * El prefijo sirve para dos cosas: distinguir de un vistazo una llave de un JWT
 * en la cabecera `Authorization` —sin ir a la base de datos a probar— y que los
 * buscadores de secretos filtrados sepan qué están mirando si alguna acaba en un
 * repositorio público.
 */
export const API_KEY_PREFIX = "cal_"

/** Cuántas llaves vivas puede tener una cuenta. Un tope evita listas infinitas. */
export const MAX_ACTIVE_KEYS = 20

/** Cada cuánto se refresca `lastUsedAt`: en cada petición sería escribir por escribir. */
const LAST_USED_REFRESH_MS = 5 * 60 * 1000

export type ApiKeyDTO = {
  id: string
  name: string
  /** Los últimos cuatro caracteres, para reconocerla sin poder usarla. */
  last4: string
  createdAt: string
  lastUsedAt: string | null
  expiresAt: string | null
}

/** Si esto parece una llave nuestra y no un JWT de la app móvil. */
export function looksLikeApiKey(value: string): boolean {
  return value.startsWith(API_KEY_PREFIX)
}

/**
 * SHA-256 y no bcrypt, a propósito.
 *
 * bcrypt existe para secretos que las personas eligen y un diccionario adivina;
 * esto son 32 bytes de `randomBytes`, que no se adivinan. Lo que sí importa es
 * que el hash se calcule en microsegundos: se hace en CADA petición de la API.
 */
function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex")
}

function serialize(row: {
  id: string
  name: string
  last4: string
  createdAt: Date
  lastUsedAt: Date | null
  expiresAt: Date | null
}): ApiKeyDTO {
  return {
    id: row.id,
    name: row.name,
    last4: row.last4,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
  }
}

export async function listApiKeys(userId: string): Promise<ApiKeyDTO[]> {
  const rows = await prisma.apiKey.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
  })
  return rows.map(serialize)
}

type CreateResult =
  | { ok: true; key: string; apiKey: ApiKeyDTO }
  | { ok: false; error: "NAME_REQUIRED" | "TOO_MANY_KEYS" }

/**
 * Crea una llave y devuelve el texto **una sola vez**.
 *
 * Quien llame a esto tiene que enseñárselo al usuario en ese momento: no se
 * puede volver a leer, ni desde la aplicación ni desde la base de datos.
 */
export async function createApiKey(
  userId: string,
  { name, expiresInDays }: { name: string; expiresInDays?: number | null },
): Promise<CreateResult> {
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: "NAME_REQUIRED" }

  const activas = await prisma.apiKey.count({ where: { userId, revokedAt: null } })
  if (activas >= MAX_ACTIVE_KEYS) return { ok: false, error: "TOO_MANY_KEYS" }

  // 32 bytes URL-safe: entra tal cual en una cabecera HTTP y en un `.env` sin
  // comillas ni escapes que se pierdan al copiar.
  const key = `${API_KEY_PREFIX}${randomBytes(32).toString("base64url")}`

  const row = await prisma.apiKey.create({
    data: {
      userId,
      name: trimmed.slice(0, 80),
      keyHash: hashKey(key),
      last4: key.slice(-4),
      expiresAt:
        typeof expiresInDays === "number" && expiresInDays > 0
          ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
          : null,
    },
  })

  return { ok: true, key, apiKey: serialize(row) }
}

/** Revoca una llave del usuario. False si no era suya o ya estaba revocada. */
export async function revokeApiKey(userId: string, id: string): Promise<boolean> {
  const { count } = await prisma.apiKey.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  return count > 0
}

/**
 * De quién es esta llave, o null si no vale.
 *
 * Se busca por el hash, que es único e indexado: una sola consulta y sin
 * comparar secretos en memoria. Una llave revocada o caducada no encuentra
 * dueño, que es exactamente lo mismo que una inventada.
 */
export async function resolveApiKey(raw: string): Promise<string | null> {
  const key = raw.trim()
  if (!looksLikeApiKey(key)) return null

  const row = await prisma.apiKey.findUnique({
    where: { keyHash: hashKey(key) },
    select: { id: true, userId: true, revokedAt: true, expiresAt: true, lastUsedAt: true },
  })

  if (!row || row.revokedAt) return null
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return null

  // Solo si la marca anterior ya es vieja: saber qué día dejó de usarse una
  // llave sirve para decidir revocarla; escribir en la base en cada petición no
  // sirve para nada.
  const stale = !row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > LAST_USED_REFRESH_MS
  if (stale) {
    await prisma.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
  }

  return row.userId
}
