import {
  isEmailConfigured,
  sendEventCreatedEmail,
  sendEventUpdatedEmail,
} from "@/lib/email"
import type { EventDTO } from "@/lib/events"
import { prisma } from "@/lib/prisma"

/** No bloquea la petición HTTP; errores solo en consola. */
export function notifyEventCreatedAsync(ownerId: string, dto: EventDTO): void {
  if (!isEmailConfigured()) return
  void (async () => {
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
  })()
}

export function notifyEventUpdatedAsync(ownerId: string, dto: EventDTO): void {
  if (!isEmailConfigured()) return
  void (async () => {
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
  })()
}
