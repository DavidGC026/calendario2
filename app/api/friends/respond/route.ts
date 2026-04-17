import { z } from "zod"

import { getCurrentUserId } from "@/lib/auth"
import { acceptFriendRequest, rejectFriendRequest } from "@/lib/friends"

const bodySchema = z.object({
  requestId: z.string().min(1),
  accept: z.boolean(),
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

  const { requestId, accept } = parsed.data
  const result = accept
    ? await acceptFriendRequest(userId, requestId)
    : await rejectFriendRequest(userId, requestId)

  if (!result.ok) {
    return Response.json({ error: "Solicitud no encontrada" }, { status: 404 })
  }

  return Response.json({ success: true })
}
