import { z } from "zod"

import { getCurrentUserId } from "@/lib/auth"
import { sendFriendRequest } from "@/lib/friends"

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

  return Response.json({
    success: true,
    autoAccepted: result.autoAccepted,
    request: result.request,
  })
}
