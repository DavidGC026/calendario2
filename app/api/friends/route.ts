import { getCurrentUserId } from "@/lib/auth"
import {
  listFriends,
  listIncomingRequests,
  listOutgoingRequests,
} from "@/lib/friends"

export async function GET() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return Response.json({ error: "No autenticado" }, { status: 401 })
  }

  const [friends, incoming, outgoing] = await Promise.all([
    listFriends(userId),
    listIncomingRequests(userId),
    listOutgoingRequests(userId),
  ])

  return Response.json({ friends, incoming, outgoing })
}
