/**
 * Rate limiter de "ventana fija" guardado en memoria del proceso.
 *
 * - Es local al worker: si tienes varias instancias detrás de un balanceador
 *   no comparten contadores. Para esta app (un único contenedor en `completa`)
 *   es suficiente y evita meter Redis para algo tan simple.
 * - Las claves se limpian de forma perezosa al consultarse (no hay timer).
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export type RateLimitResult = {
  allowed: boolean
  /** Llamadas restantes en la ventana actual (>= 0). */
  remaining: number
  /** Segundos hasta que se reinicia la ventana. */
  retryAfterSeconds: number
}

/**
 * @param key       Identificador único (p. ej. `chat:${userId}` o `reset:${ip}`).
 * @param limit     Máximo de llamadas permitidas en la ventana.
 * @param windowMs  Tamaño de la ventana en milisegundos.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    const next: Bucket = { count: 1, resetAt: now + windowMs }
    buckets.set(key, next)
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: Math.ceil(windowMs / 1000) }
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }

  existing.count += 1
  return {
    allowed: true,
    remaining: limit - existing.count,
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  }
}

/** Devuelve una respuesta 429 estándar con `Retry-After`. */
export function rateLimitResponse(result: RateLimitResult, message = "Demasiadas peticiones, prueba en unos segundos.") {
  return new Response(JSON.stringify({ error: message, retryAfter: result.retryAfterSeconds }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(result.retryAfterSeconds),
    },
  })
}

/**
 * Devuelve una IP "razonable" del request mirando los headers que pone el proxy.
 * Útil cuando la clave debe basarse en el cliente y no en el usuario logueado.
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0]?.trim() || "unknown"
  return req.headers.get("x-real-ip")?.trim() || "unknown"
}
