import { requireAdmin } from "@/lib/auth"
import { listAdminUsers } from "@/lib/admin-users"

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) {
    return Response.json({ error: "No autorizado" }, { status: 403 })
  }

  const users = await listAdminUsers()
  return Response.json({ users })
}
