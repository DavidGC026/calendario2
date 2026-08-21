import { SignJWT, jwtVerify } from "jose"

/**
 * El `state` de la vuelta de OAuth, firmado.
 *
 * Sin él, cualquiera puede mandarle a un usuario que ha iniciado sesión un
 * enlace a nuestra ruta de vuelta con un `code` suyo, y le engancharía a su
 * propia cuenta de Google —la agenda del atacante sincronizándose con el
 * calendario de la víctima, o al revés—. Firmar con el secreto de la aplicación
 * y comprobar que el usuario coincide cierra eso.
 *
 * Diez minutos de vida: es lo que tarda alguien en dar permiso, y deja poco
 * margen para reutilizarlo.
 */
const STATE_TTL = "10m"

function secretBytes(): Uint8Array {
  const s = process.env.NEXTAUTH_SECRET ?? "dev-only-secret-change-in-production"
  return new TextEncoder().encode(s)
}

export async function signOAuthState(userId: string): Promise<string> {
  return new SignJWT({ typ: "google-calendar-connect" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(STATE_TTL)
    .sign(secretBytes())
}

export async function verifyOAuthState(state: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(state, secretBytes(), { algorithms: ["HS256"] })
    if (payload.typ !== "google-calendar-connect") return null
    return typeof payload.sub === "string" ? payload.sub : null
  } catch {
    return null
  }
}

/** La dirección de vuelta, que tiene que estar registrada igual en Google Cloud. */
export function redirectUri(): string {
  const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/+$/, "")
  return `${base}/api/google-calendar/callback`
}
