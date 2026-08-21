import { getCurrentUserId } from "@/lib/auth"
import { revokeApiKey } from "@/lib/api-keys"

export const dynamic = "force-dynamic"

type RouteParams = {
  params: Promise<{ id: string }>
}

/** Revoca una llave. Desde ese momento deja de valer, sin tocar las demás. */
export async function DELETE(_: Request, { params }: RouteParams) {
  // Como al crearlas: una llave no puede revocar llaves, ni siquiera la suya.
  const userId = await getCurrentUserId({ allowApiKey: false })
  if (!userId) return Response.json({ error: "No autenticado" }, { status: 401 })

  const { id } = await params
  const revocada = await revokeApiKey(userId, id)
  if (!revocada) return Response.json({ error: "Llave no encontrada" }, { status: 404 })

  return Response.json({ success: true })
}
