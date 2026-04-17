import { after } from "next/server"

import {
  isEmailConfigured,
  sendEventCreatedEmail,
  sendEventDeletedEmail,
  sendEventUpdatedEmail,
} from "@/lib/email"
import type { EventDTO } from "@/lib/events"
import { prisma } from "@/lib/prisma"

export async function runNotifyEventCreated(ownerId: string, dto: EventDTO): Promise<void> {
  if (!isEmailConfigured()) return
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
  if (!isEmailConfigured()) return
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
  if (!isEmailConfigured()) return
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

/** Programa el envío tras la respuesta HTTP (REST); en serverless evita cancelar el trabajo. */
export function notifyEventCreatedAsync(ownerId: string, dto: EventDTO): void {
  after(() => {
    void runNotifyEventCreated(ownerId, dto)
  })
}

export function notifyEventUpdatedAsync(ownerId: string, dto: EventDTO): void {
  after(() => {
    void runNotifyEventUpdated(ownerId, dto)
  })
}

export function notifyEventDeletedAsync(ownerId: string, dto: EventDTO): void {
  after(() => {
    void runNotifyEventDeleted(ownerId, dto)
  })
}
