import { getRequestMeta, logAuthAttempt } from "@/lib/auth-log"

export const dynamic = "force-dynamic"

type Body = {
  email?: string
  ok?: boolean
  error?: string | null
  url?: string | null
}

/** Registra el resultado que ve el navegador tras signIn (incluye fallos CSRF). */
export async function POST(req: Request) {
  const meta = getRequestMeta(req)
  const json = (await req.json().catch(() => null)) as Body | null
  const email = json?.email?.trim().toLowerCase() ?? null
  const url = json?.url ?? null
  const error = json?.error ?? null

  let reason: "success" | "csrf_failed" | "bad_password" | "server_error" = "server_error"
  let success = false
  let detail = error ?? url ?? null

  if (json?.ok) {
    reason = "success"
    success = true
  } else if (url?.includes("csrf=true")) {
    reason = "csrf_failed"
    detail = "csrf=true"
  } else if (error === "CredentialsSignin" || url?.includes("error=CredentialsSignin")) {
    reason = "bad_password"
    detail = "CredentialsSignin"
  }

  await logAuthAttempt({
    channel: "web",
    email,
    ip: meta.ip,
    userAgent: meta.userAgent,
    success,
    reason,
    detail,
  })

  return Response.json({ ok: true })
}
