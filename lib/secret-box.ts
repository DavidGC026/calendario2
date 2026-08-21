import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto"

const PREFIX = "v1"

function derivedKey() {
  const secret = process.env.NEXTAUTH_SECRET?.trim()
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET es necesario para cifrar ajustes")
  }
  return scryptSync(secret, "calendario-app-setting", 32)
}

/** Cifra un secreto con AES-256-GCM. El resultado es texto seguro para guardar en Postgres. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", derivedKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [PREFIX, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(
    ":",
  )
}

export function decryptSecret(packed: string): string {
  const [version, ivB64, tagB64, dataB64] = packed.split(":")
  if (version !== PREFIX || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Formato de secreto inválido")
  }
  const decipher = createDecipheriv("aes-256-gcm", derivedKey(), Buffer.from(ivB64, "base64url"))
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"))
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64url")),
    decipher.final(),
  ]).toString("utf8")
}
