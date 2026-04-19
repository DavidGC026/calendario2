import { getCurrentUserId } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/** Perfil del usuario autenticado (Bearer o sesión web). */
export async function GET() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return Response.json({ error: "No autenticado" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true },
  })
  if (!user) {
    return Response.json({ error: "Usuario no encontrado" }, { status: 404 })
  }

  return Response.json({ user })
}
