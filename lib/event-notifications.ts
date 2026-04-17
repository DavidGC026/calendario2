import {
  isEmailConfigured,
  sendEventCreatedEmail,
  sendEventDeletedEmail,
  sendEventUpdatedEmail,
} from "@/lib/email"
import type { EventDTO } from "@/lib/events"
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

/** Ejecutar con await en route handlers / tools para que el envío termine en la misma petición (serverless no corta el trabajo). */
export async function runNotifyEventCreated(ownerId: string, dto: EventDTO): Promise<void> {
  if (skipEmailWithLog("runNotifyEventCreated")) return
  try {
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { email: true, name: true },
    })
    if (!owner) return
    await sendEventCreatedEmail({
      to: owner.email,
      event: dto,
      role: "owner",
    })
    for (const p of dto.participants) {
      await sendEventCreatedEmail({
        to: p.email,
        event: dto,
        role: "participant",
        organizerName: owner.name,
      })
    }
  } catch (e) {
    console.error("[notifyEventCreated]", e)
  }
}

export async function runNotifyEventUpdated(ownerId: string, dto: EventDTO): Promise<void> {
  if (skipEmailWithLog("runNotifyEventUpdated")) return
  try {
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { email: true, name: true },
    })
    if (!owner) return
    await sendEventUpdatedEmail({ to: owner.email, event: dto, role: "owner" })
    for (const p of dto.participants) {
      await sendEventUpdatedEmail({ to: p.email, event: dto, role: "participant" })
    }
  } catch (e) {
    console.error("[notifyEventUpdated]", e)
  }
}

export async function runNotifyEventDeleted(ownerId: string, dto: EventDTO): Promise<void> {
  if (skipEmailWithLog("runNotifyEventDeleted")) return
  try {
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { email: true, name: true },
    })
    if (!owner) return
    await sendEventDeletedEmail({ to: owner.email, event: dto, role: "owner" })
    for (const p of dto.participants) {
      await sendEventDeletedEmail({
        to: p.email,
        event: dto,
        role: "participant",
        organizerName: owner.name,
      })
    }
  } catch (e) {
    console.error("[notifyEventDeleted]", e)
  }
}
