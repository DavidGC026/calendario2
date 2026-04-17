import { z } from "zod"

import { getCurrentUserId } from "@/lib/auth"
import { sendFriendAcceptedEmail, sendFriendRequestEmail } from "@/lib/email"
import { sendFriendRequest } from "@/lib/friends"
import { prisma } from "@/lib/prisma"

const bodySchema = z.object({
  targetUserId: z.string().min(1),
})

export async function POST(req: Request) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return Response.json({ error: "No autenticado" }, { status: 401 })
  }

  const json = await req.json().catch(() => null)
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return Response.json({ error: "Payload inválido" }, { status: 400 })
  }

  const result = await sendFriendRequest(userId, parsed.data.targetUserId)
  if (!result.ok) {
    const map: Record<string, { status: number; message: string }> = {
      EMPTY_ID: { status: 400, message: "Indica un ID de usuario" },
      SELF: { status: 400, message: "No puedes enviarte una solicitud a ti mismo" },
      USER_NOT_FOUND: { status: 404, message: "No existe ningún usuario con ese ID" },
      ALREADY_FRIENDS: { status: 409, message: "Ya sois amigos" },
      ALREADY_PENDING: { status: 409, message: "Ya hay una solicitud pendiente" },
    }
    const m = map[result.error] ?? { status: 400, message: "No se pudo enviar" }
    return Response.json({ error: m.message, code: result.error }, { status: m.status })
  }

  if (result.autoAccepted) {
    const [accepter, originalSender] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      }),
      prisma.user.findUnique({
        where: { id: parsed.data.targetUserId },
        select: { email: true, name: true },
      }),
    ])
    if (accepter?.email && originalSender?.email) {
      void sendFriendAcceptedEmail({
        to: originalSender.email,
        accepterName: accepter.name,
        accepterEmail: accepter.email,
      })
    }
  } else {
    const [from, to] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      }),
      prisma.user.findUnique({
        where: { id: parsed.data.targetUserId },
        select: { email: true },
      }),
    ])
    if (from?.email && to?.email) {
      void sendFriendRequestEmail({
        to: to.email,
        fromName: from.name,
        fromEmail: from.email,
      })
    }
  }

  return Response.json({
    success: true,
    autoAccepted: result.autoAccepted,
    request: result.request,
  })
}
