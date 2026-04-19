import { Resend } from "resend"

import type { EventDTO } from "@/lib/events"

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function layout(title: string, inner: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;padding:20px;margin:0;}
.wrap{max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);}
.hdr{background:linear-gradient(135deg,#6366f1,#3b82f6);color:#fff;padding:20px 24px;text-align:center;}
.hdr h1{margin:0;font-size:20px;font-weight:600;}
.body{padding:24px;color:#334155;font-size:15px;line-height:1.5;}
.card{background:#f8fafc;border-radius:10px;padding:16px;margin-top:12px;}
.row{margin:8px 0;color:#64748b;font-size:14px;}
.ft{text-align:center;padding:16px;color:#94a3b8;font-size:12px;}
a{color:#4f46e5;}
</style></head><body><div class="wrap">
<div class="hdr"><h1>${escHtml(title)}</h1></div>
<div class="body">${inner}</div>
<div class="ft">Calendario inteligente${process.env.PUBLIC_APP_URL ? ` · <a href="${escHtml(process.env.PUBLIC_APP_URL)}">Abrir app</a>` : ""}</div>
</div></body></html>`
}

function eventBlock(ev: Pick<EventDTO, "title" | "eventDate" | "startTime" | "endTime" | "location" | "description">): string {
  return `<div class="card">
<div style="font-weight:600;font-size:17px;color:#0f172a;margin-bottom:10px;">${escHtml(ev.title)}</div>
<div class="row">📅 ${escHtml(ev.eventDate)}</div>
<div class="row">🕐 ${escHtml(ev.startTime)} – ${escHtml(ev.endTime)}</div>
${ev.location ? `<div class="row">📍 ${escHtml(ev.location)}</div>` : ""}
${ev.description ? `<p style="margin:12px 0 0;color:#475569;">${escHtml(ev.description)}</p>` : ""}
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
      ? `Evento confirmado: ${event.title}`
      : `Te han añadido a un evento: ${event.title}`
  const intro =
    role === "owner"
      ? "<p>Tu evento se ha guardado correctamente.</p>"
      : `<p><strong>${organizerName ? escHtml(organizerName) : "Un usuario"}</strong> te ha incluido en este evento.</p>`
  const inner = `${intro}${eventBlock(event)}`
  await sendHtmlEmail(to, subj, layout(role === "owner" ? "Confirmación de evento" : "Invitación a evento", inner))
}

export async function sendEventUpdatedEmail(params: { to: string; event: EventDTO; role: "owner" | "participant" }): Promise<void> {
  const { to, event, role } = params
  const subj = `Evento actualizado: ${event.title}`
  const intro =
    role === "owner"
      ? "<p>Los cambios en tu evento se han guardado.</p>"
      : "<p>Un evento en el que participas ha sido modificado.</p>"
  const inner = `${intro}${eventBlock(event)}`
  await sendHtmlEmail(to, subj, layout("Evento actualizado", inner))
}

export async function sendEventDeletedEmail(params: {
  to: string
  event: EventDTO
  role: "owner" | "participant"
  organizerName?: string | null
}): Promise<void> {
  const { to, event, role, organizerName } = params
  const subj = role === "owner" ? `Evento eliminado: ${event.title}` : `Evento cancelado: ${event.title}`
  const intro =
    role === "owner"
      ? "<p>Has eliminado este evento de tu calendario.</p>"
      : `<p><strong>${organizerName ? escHtml(organizerName) : "El organizador"}</strong> ha eliminado un evento en el que participabas.</p>`
  const inner = `${intro}${eventBlock(event)}`
  await sendHtmlEmail(to, subj, layout(role === "owner" ? "Evento eliminado" : "Evento cancelado", inner))
}

export async function sendEventDayReminderEmail(params: {
  to: string
  event: EventDTO
}): Promise<{ ok: boolean; error?: string }> {
  const { to, event } = params
  const subj = `Hoy: ${event.title}`
  const inner = `<p><strong>Recordatorio:</strong> hoy tienes este evento.</p>${eventBlock(event)}`
  return sendHtmlEmail(to, subj, layout("Recordatorio del día", inner))
}

export async function sendFriendRequestEmail(params: {
  to: string
  fromName: string | null
  fromEmail: string
}): Promise<void> {
  const { to, fromName, fromEmail } = params
  const who = fromName || fromEmail
  const inner = `<p><strong>${escHtml(who)}</strong> te ha enviado una solicitud de amistad en la app.</p>
<p>Inicia sesión en el calendario para aceptarla o rechazarla.</p>`
  await sendHtmlEmail(to, `Solicitud de amistad de ${who}`, layout("Nueva solicitud de amistad", inner))
}

export async function sendFriendAcceptedEmail(params: { to: string; accepterName: string | null; accepterEmail: string }): Promise<void> {
  const { to, accepterName, accepterEmail } = params
  const who = accepterName || accepterEmail
  const inner = `<p><strong>${escHtml(who)}</strong> ha aceptado tu solicitud de amistad.</p>`
  await sendHtmlEmail(to, `${who} ha aceptado tu solicitud`, layout("Solicitud aceptada", inner))
}

export async function sendPasswordResetCodeEmail(params: {
  to: string
  code: string
  expiresInMinutes: number
}): Promise<{ ok: boolean; error?: string }> {
  const { to, code, expiresInMinutes } = params
  const inner = `<p>Has solicitado restablecer tu contraseña en <strong>Calendario inteligente</strong>.</p>
<p>Introduce el siguiente código en la pantalla de la app para confirmar que este correo es tuyo:</p>
<div class="card" style="text-align:center;">
  <div style="font-size:32px;letter-spacing:0.4em;font-weight:700;color:#0f172a;font-family:'SFMono-Regular','Menlo','Consolas',monospace;">${escHtml(code)}</div>
  <div class="row" style="margin-top:12px;">Caduca en ${expiresInMinutes} minutos.</div>
</div>
<p style="margin-top:16px;color:#64748b;font-size:13px;">Si no fuiste tú, puedes ignorar este correo: tu contraseña no cambiará. Solo cambia si alguien introduce el código.</p>`
  return sendHtmlEmail(to, `Código para restablecer tu contraseña: ${code}`, layout("Restablecer contraseña", inner))
}
