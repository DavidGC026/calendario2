import { SignJWT, jwtVerify } from "jose"

function getSecretBytes(): Uint8Array {
  const s = process.env.NEXTAUTH_SECRET ?? "dev-only-secret-change-in-production"
  return new TextEncoder().encode(s)
}

/** JWT para apps nativas (Authorization: Bearer). Mismo secreto que NextAuth. */
export async function signMobileAccessToken(userId: string, email: string): Promise<string> {
  return new SignJWT({ typ: "calendario-mobile", email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("60d")
    .sign(getSecretBytes())
}

export async function verifyMobileAccessToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretBytes(), { algorithms: ["HS256"] })
    if (payload.typ !== "calendario-mobile") return null
    return typeof payload.sub === "string" ? payload.sub : null
  } catch {
    return null
  }
}
