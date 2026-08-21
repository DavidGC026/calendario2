import { requireAdmin } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return Response.json({ error: "No autorizado" }, { status: 403 })
  }

  const url = new URL(req.url)
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 200)
  const email = url.searchParams.get("email")?.trim().toLowerCase()

  const logs = await prisma.authLog.findMany({
    where: email ? { email: { contains: email } } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  return Response.json({ logs })
}
