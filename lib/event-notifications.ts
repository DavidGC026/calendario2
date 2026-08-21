import {
  isEmailConfigured,
  sendEventCreatedEmail,
  sendEventDeletedEmail,
  sendEventUpdatedEmail,
} from "@/lib/email"
import type { EventDTO } from "@/lib/events"
import { publishUserEvent } from "@/lib/events-bus"
import { prisma } from "@/lib/prisma"

let loggedMissingResendKey = false

function skipEmailWithLog(context: string): boolean {
  if (isEmailConfigured()) return false
  if (!loggedMissingResendKey) {
    loggedMissingResendKey = true
    console.warn(
      `[email] ${context}: RESEND_API_KEY no está definida; configura la variable en el servidor (p. ej. panel del hosting o .env).`,
    )
  }
  return true
}

/**
 * Avisos de calendario: solo el dueño del evento. No se publican SSE ni se
 * envían correos a participantes — cada cuenta mantiene su agenda privada.
 */
async function notifyOwner(
  ownerId: string,
  dto: EventDTO,
  type: "created" | "updated" | "deleted",
  send: (owner: { email: string; name: string | null }) => Promise<unknown>,
  logLabel: string,
): Promise<void> {
  publishUserEvent(ownerId, { type, eventId: dto.id })
  if (skipEmailWithLog(logLabel)) return
  try {
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { email: true, name: true },
    })
    if (!owner) return
    await send(owner)
  } catch (e) {
    console.error(`[${logLabel}]`, e)
  }
}

/** Ejecutar con await en route handlers / tools para que el envío termine en la misma petición (serverless no corta el trabajo). */
export async function runNotifyEventCreated(ownerId: string, dto: EventDTO): Promise<void> {
  await notifyOwner(ownerId, dto, "created", (owner) =>
    sendEventCreatedEmail({ to: owner.email, event: dto, role: "owner" }),
    "runNotifyEventCreated",
  )
}

export async function runNotifyEventUpdated(ownerId: string, dto: EventDTO): Promise<void> {
  await notifyOwner(ownerId, dto, "updated", (owner) =>
    sendEventUpdatedEmail({ to: owner.email, event: dto, role: "owner" }),
    "runNotifyEventUpdated",
  )
}

export async function runNotifyEventDeleted(ownerId: string, dto: EventDTO): Promise<void> {
  await notifyOwner(ownerId, dto, "deleted", (owner) =>
    sendEventDeletedEmail({ to: owner.email, event: dto, role: "owner" }),
    "runNotifyEventDeleted",
  )
}
