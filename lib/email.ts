import { Resend } from "resend"

import type { EventDTO } from "@/lib/events"

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * Devuelve el accent color hex correspondiente a la clase Tailwind del evento.
 * Coincide con `eventBlockStyle` del frontend para mantener coherencia visual.
 */
function accentForColor(color: string | undefined | null): { solid: string; soft: string } {
  switch (color) {
    case "bg-green-500":
      return { solid: "#22c55e", soft: "#16a34a" }
    case "bg-orange-500":
      return { solid: "#f97316", soft: "#ea580c" }
    case "bg-purple-500":
      return { solid: "#a855f7", soft: "#9333ea" }
    case "bg-pink-500":
      return { solid: "#ec4899", soft: "#db2777" }
    case "bg-yellow-500":
      return { solid: "#eab308", soft: "#ca8a04" }
    case "bg-cyan-500":
      return { solid: "#06b6d4", soft: "#0891b2" }
    case "bg-red-500":
      return { solid: "#ef4444", soft: "#dc2626" }
    case "bg-violet-500":
      return { solid: "#8b5cf6", soft: "#7c3aed" }
    case "bg-blue-500":
    default:
      return { solid: "#3b82f6", soft: "#2563eb" }
  }
}

/**
 * Formatea YYYY-MM-DD a un texto legible largo en español.
 * Ej: "Sábado, 18 de abril de 2026".
 */
function formatLongDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  try {
    const d = new Date(`${iso}T12:00:00`)
    const s = d.toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    return s.charAt(0).toUpperCase() + s.slice(1)
  } catch {
    return iso
  }
}

interface LayoutOptions {
  /** Etiqueta corta encima del título (ej: "Recordatorio", "Confirmación"). */
  eyebrow?: string
  /** Color de acento para el header (override del azul por defecto). */
  accent?: { solid: string; soft: string }
  /** Texto del CTA principal (por defecto "Abrir en la app"). */
  ctaLabel?: string
  /** URL del CTA. Si no se pasa usa PUBLIC_APP_URL. */
  ctaUrl?: string
}

function layout(title: string, inner: string, options: LayoutOptions = {}): string {
  const accent = options.accent ?? { solid: "#0ea5e9", soft: "#7c3aed" } // sky → violet
  const ctaUrl = options.ctaUrl ?? process.env.PUBLIC_APP_URL ?? ""
  const ctaLabel = options.ctaLabel ?? "Abrir Calendario"
  const showCta = Boolean(ctaUrl)
  const eyebrow = options.eyebrow ?? "Calendario inteligente"

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="light dark"/>
<meta name="supported-color-schemes" content="light dark"/>
<title>${escHtml(title)}</title>
<style>
  body { margin:0; padding:0; background:#0f172a; }
  .preview { display:none; opacity:0; visibility:hidden; height:0; width:0; overflow:hidden; mso-hide:all; }
  .container { width:100%; max-width:560px; }
  .card { background:#ffffff; border-radius:18px; overflow:hidden; box-shadow:0 12px 40px rgba(15,23,42,0.18); }
  .hero { background:linear-gradient(135deg, ${accent.solid} 0%, ${accent.soft} 100%); padding:28px 28px 22px; color:#ffffff; }
  .eyebrow { font-size:11px; letter-spacing:1.6px; text-transform:uppercase; opacity:.85; font-weight:600; }
  .h1 { margin:8px 0 0; font-size:22px; line-height:1.25; font-weight:700; letter-spacing:-0.01em; }
  .body { padding:24px 28px 8px; color:#0f172a; font-size:15px; line-height:1.55; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif; }
  .body p { margin:0 0 14px; color:#334155; }
  .muted { color:#64748b; font-size:13px; }
  .cta-wrap { padding:8px 28px 28px; text-align:center; }
  .cta { display:inline-block; padding:13px 26px; border-radius:12px; font-weight:600; font-size:14px; color:#ffffff !important; text-decoration:none; background:linear-gradient(135deg, ${accent.solid} 0%, ${accent.soft} 100%); box-shadow:0 6px 18px rgba(14,165,233,0.35); }
  .footer { padding:18px 24px 24px; text-align:center; color:#94a3b8; font-size:12px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
  .footer a { color:#cbd5e1; text-decoration:none; }
  .ev { margin:0 0 4px; border-radius:14px; background:#f8fafc; border:1px solid #e2e8f0; overflow:hidden; }
  .ev-accent { height:4px; background:${accent.solid}; }
  .ev-inner { padding:18px 18px 14px; }
  .ev-title { font-size:17px; font-weight:700; color:#0f172a; line-height:1.3; margin:0 0 12px; letter-spacing:-0.01em; }
  .ev-row { display:flex; align-items:center; gap:10px; padding:6px 0; color:#334155; font-size:14px; }
  .ev-icon { width:18px; text-align:center; color:${accent.solid}; }
  .ev-desc { margin:12px 0 0; padding-top:12px; border-top:1px solid #e2e8f0; color:#475569; font-size:14px; line-height:1.55; white-space:pre-wrap; }
  .code { font-family:'SF Mono','Menlo','Consolas','Roboto Mono',monospace; font-size:34px; font-weight:700; letter-spacing:0.5em; color:#0f172a; padding:12px 0 4px; }
  .code-wrap { background:#f1f5f9; border:1px dashed #cbd5e1; border-radius:14px; padding:18px 8px 14px; text-align:center; }

  @media (prefers-color-scheme: dark) {
    .card { background:#1e293b !important; box-shadow:0 12px 40px rgba(0,0,0,0.5) !important; }
    .body { color:#e2e8f0 !important; }
    .body p { color:#cbd5e1 !important; }
    .muted { color:#94a3b8 !important; }
    .ev { background:#0f172a !important; border-color:#334155 !important; }
    .ev-title { color:#f8fafc !important; }
    .ev-row { color:#cbd5e1 !important; }
    .ev-desc { color:#cbd5e1 !important; border-top-color:#334155 !important; }
    .code-wrap { background:#0f172a !important; border-color:#334155 !important; }
    .code { color:#f1f5f9 !important; }
    .footer { color:#64748b !important; }
  }
</style>
</head>
<body>
<span class="preview">${escHtml(title)} · Calendario inteligente</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f172a;padding:24px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" class="container" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;">
        <tr>
          <td class="card">
            <div class="hero">
              <div class="eyebrow">${escHtml(eyebrow)}</div>
              <h1 class="h1">${escHtml(title)}</h1>
            </div>
            <div class="body">${inner}</div>
            ${
              showCta
                ? `<div class="cta-wrap"><a class="cta" href="${escHtml(ctaUrl)}">${escHtml(ctaLabel)}</a></div>`
                : `<div style="height:8px"></div>`
            }
          </td>
        </tr>
        <tr>
          <td class="footer">
            Calendario inteligente${process.env.PUBLIC_APP_URL ? ` · <a href="${escHtml(process.env.PUBLIC_APP_URL)}">${escHtml(process.env.PUBLIC_APP_URL.replace(/^https?:\/\//, ""))}</a>` : ""}
            <br/><span style="opacity:.7">Si este correo te llegó por error, puedes ignorarlo.</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

function eventBlock(
  ev: Pick<EventDTO, "title" | "eventDate" | "startTime" | "endTime" | "location" | "description"> & {
    color?: string
    organizer?: string
  },
): string {
  const accent = accentForColor(ev.color)
  const dateLabel = formatLongDate(ev.eventDate)
  return `<div class="ev">
  <div class="ev-accent" style="background:${accent.solid};"></div>
  <div class="ev-inner">
    <div class="ev-title">${escHtml(ev.title)}</div>
    <div class="ev-row"><span class="ev-icon" style="color:${accent.solid};">●</span><span>${escHtml(dateLabel)}</span></div>
    <div class="ev-row"><span class="ev-icon" style="color:${accent.solid};">◷</span><span>${escHtml(ev.startTime)} – ${escHtml(ev.endTime)}</span></div>
    ${ev.location ? `<div class="ev-row"><span class="ev-icon" style="color:${accent.solid};">⌖</span><span>${escHtml(ev.location)}</span></div>` : ""}
    ${ev.description ? `<div class="ev-desc">${escHtml(ev.description)}</div>` : ""}
  </div>
</div>`
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim())
}

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) return null
  return new Resend(key)
}

/** Remitente Resend: "Nombre visible <correo@dominio>". En producción usa tu dominio verificado (p. ej. calendar@dvguzman.com). */
function fromAddress(): string {
  return process.env.RESEND_FROM_EMAIL?.trim() || "Calendario <onboarding@resend.dev>"
}

export async function sendHtmlEmail(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const resend = getResend()
  if (!resend) {
    console.warn("[email] RESEND_API_KEY no configurada; no se envía:", subject)
    return { ok: false, error: "no_api_key" }
  }
  try {
    const { error } = await resend.emails.send({
      from: fromAddress(),
      to: [to],
      subject,
      html,
    })
    if (error) {
      console.error("[email] Resend:", error)
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch (e) {
    console.error("[email]", e)
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function sendEventCreatedEmail(params: {
  to: string
  event: EventDTO
  role: "owner" | "participant"
  organizerName?: string | null
}): Promise<void> {
  const { to, event, role, organizerName } = params
  const subj =
    role === "owner"
      ? `Evento confirmado · ${event.title}`
      : `Te han añadido a un evento · ${event.title}`
  const intro =
    role === "owner"
      ? "<p>Tu evento se ha guardado en el calendario. Aquí tienes el resumen:</p>"
      : `<p><strong>${organizerName ? escHtml(organizerName) : "Un usuario"}</strong> te ha incluido en este evento:</p>`
  const inner = `${intro}${eventBlock(event)}`
  const accent = accentForColor(event.color)
  await sendHtmlEmail(
    to,
    subj,
    layout(role === "owner" ? "Evento confirmado" : "Nueva invitación", inner, {
      eyebrow: role === "owner" ? "Confirmación" : "Invitación",
      accent,
    }),
  )
}

export async function sendEventUpdatedEmail(params: { to: string; event: EventDTO; role: "owner" | "participant" }): Promise<void> {
  const { to, event, role } = params
  const subj = `Evento actualizado · ${event.title}`
  const intro =
    role === "owner"
      ? "<p>Has actualizado los detalles de este evento. Estos son los nuevos datos:</p>"
      : "<p>Un evento en el que participas ha sido modificado. Estos son los nuevos detalles:</p>"
  const inner = `${intro}${eventBlock(event)}`
  await sendHtmlEmail(
    to,
    subj,
    layout("Evento actualizado", inner, {
      eyebrow: "Cambios guardados",
      accent: accentForColor(event.color),
    }),
  )
}

export async function sendEventDeletedEmail(params: {
  to: string
  event: EventDTO
  role: "owner" | "participant"
  organizerName?: string | null
}): Promise<void> {
  const { to, event, role, organizerName } = params
  const subj = role === "owner" ? `Evento eliminado · ${event.title}` : `Evento cancelado · ${event.title}`
  const intro =
    role === "owner"
      ? "<p>Has eliminado este evento de tu calendario:</p>"
      : `<p><strong>${organizerName ? escHtml(organizerName) : "El organizador"}</strong> ha eliminado un evento en el que participabas:</p>`
  const inner = `${intro}${eventBlock(event)}`
  await sendHtmlEmail(
    to,
    subj,
    layout(role === "owner" ? "Evento eliminado" : "Evento cancelado", inner, {
      eyebrow: "Cancelación",
      // Acento rojo para indicar baja
      accent: { solid: "#ef4444", soft: "#b91c1c" },
    }),
  )
}

export async function sendEventDayReminderEmail(params: {
  to: string
  event: EventDTO
}): Promise<{ ok: boolean; error?: string }> {
  const { to, event } = params
  const subj = `Hoy · ${event.title}`
  const inner = `<p>Pequeño recordatorio: <strong>hoy</strong> tienes este evento en tu calendario.</p>${eventBlock(event)}`
  return sendHtmlEmail(
    to,
    subj,
    layout("Recordatorio del día", inner, {
      eyebrow: "Hoy en tu agenda",
      accent: accentForColor(event.color),
    }),
  )
}

/**
 * Recordatorio "X minutos antes" del inicio. Usado por el cron que corre
 * cada pocos minutos cuando el usuario configura el campo
 * `reminderMinutesBefore` en el evento.
 */
export async function sendEventUpcomingReminderEmail(params: {
  to: string
  event: EventDTO
  minutesBefore: number
}): Promise<{ ok: boolean; error?: string }> {
  const { to, event, minutesBefore } = params

  // Texto humano: "5 minutos", "1 hora", "1 día", etc.
  let when: string
  if (minutesBefore >= 1440) {
    const days = Math.round(minutesBefore / 1440)
    when = days === 1 ? "1 día" : `${days} días`
  } else if (minutesBefore >= 60) {
    const hours = Math.round(minutesBefore / 60)
    when = hours === 1 ? "1 hora" : `${hours} horas`
  } else {
    when = `${minutesBefore} minutos`
  }

  const subj = `En ${when} · ${event.title}`
  const intro = `<p>Tu evento <strong>${escHtml(event.title)}</strong> empieza en <strong>${when}</strong>.</p>`
  return sendHtmlEmail(
    to,
    subj,
    layout(`Empieza en ${when}`, `${intro}${eventBlock(event)}`, {
      eyebrow: "Recordatorio",
      accent: accentForColor(event.color),
    }),
  )
}

export async function sendFriendRequestEmail(params: {
  to: string
  fromName: string | null
  fromEmail: string
}): Promise<void> {
  const { to, fromName, fromEmail } = params
  const who = fromName || fromEmail
  const inner = `<p><strong>${escHtml(who)}</strong> te ha enviado una solicitud de amistad en Calendario inteligente.</p>
<p class="muted">Acepta para empezar a coordinar eventos y ver disponibilidad mutua. Inicia sesión para responder.</p>`
  await sendHtmlEmail(
    to,
    `Solicitud de amistad de ${who}`,
    layout("Nueva solicitud de amistad", inner, {
      eyebrow: "Conexión pendiente",
      ctaLabel: "Responder en la app",
    }),
  )
}

export async function sendFriendAcceptedEmail(params: { to: string; accepterName: string | null; accepterEmail: string }): Promise<void> {
  const { to, accepterName, accepterEmail } = params
  const who = accepterName || accepterEmail
  const inner = `<p><strong>${escHtml(who)}</strong> ha aceptado tu solicitud de amistad. Ya pueden coordinar eventos juntos.</p>`
  await sendHtmlEmail(
    to,
    `${who} ha aceptado tu solicitud`,
    layout("Solicitud aceptada", inner, {
      eyebrow: "Nueva conexión",
      accent: { solid: "#22c55e", soft: "#16a34a" },
    }),
  )
}

export async function sendPasswordResetCodeEmail(params: {
  to: string
  code: string
  expiresInMinutes: number
}): Promise<{ ok: boolean; error?: string }> {
  const { to, code, expiresInMinutes } = params
  const inner = `<p>Has solicitado restablecer tu contraseña en <strong>Calendario inteligente</strong>.</p>
<p>Introduce el siguiente código en la pantalla de la app para confirmar que este correo es tuyo:</p>
<div class="code-wrap">
  <div class="code">${escHtml(code)}</div>
  <div class="muted" style="margin-top:6px;">Caduca en ${expiresInMinutes} minutos</div>
</div>
<p class="muted" style="margin-top:18px;">Si no fuiste tú, puedes ignorar este correo: tu contraseña no cambiará. Solo cambia si alguien introduce el código.</p>`
  return sendHtmlEmail(
    to,
    `Código para restablecer tu contraseña: ${code}`,
    layout("Restablecer contraseña", inner, {
      eyebrow: "Verificación",
      accent: { solid: "#0ea5e9", soft: "#7c3aed" },
      ctaLabel: "Volver a la app",
    }),
  )
}
