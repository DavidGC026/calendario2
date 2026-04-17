import { prisma } from "@/lib/prisma"

export type FriendSummary = {
  id: string
  email: string
  name: string | null
}

export type FriendRequestSummary = {
  id: string
  fromUserId: string
  toUserId: string
  status: "PENDING" | "ACCEPTED" | "REJECTED"
  createdAt: string
  fromUser?: FriendSummary
  toUser?: FriendSummary
}

/** IDs de usuarios con los que hay amistad aceptada (excluye a `userId`). */
export async function getAcceptedFriendIds(userId: string): Promise<string[]> {
  const rows = await prisma.friendRequest.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ fromUserId: userId }, { toUserId: userId }],
    },
    select: { fromUserId: true, toUserId: true },
  })
  return rows.map((r) => (r.fromUserId === userId ? r.toUserId : r.fromUserId))
}

export async function areFriends(a: string, b: string): Promise<boolean> {
  if (a === b) return false
  const n = await prisma.friendRequest.count({
    where: {
      status: "ACCEPTED",
      OR: [
        { fromUserId: a, toUserId: b },
        { fromUserId: b, toUserId: a },
      ],
    },
  })
  return n > 0
}

/** Comprueba que todos los IDs son amigos aceptados del usuario. */
export async function validateParticipantIdsAreFriends(userId: string, ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true
  const unique = [...new Set(ids)].filter((id) => id !== userId)
  if (unique.length === 0) return true
  const friendSet = new Set(await getAcceptedFriendIds(userId))
  return unique.every((id) => friendSet.has(id))
}

export async function listFriends(userId: string): Promise<FriendSummary[]> {
  const ids = await getAcceptedFriendIds(userId)
  if (ids.length === 0) return []
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, email: true, name: true },
    orderBy: { name: "asc" },
  })
  return users
}

export async function listIncomingRequests(userId: string): Promise<FriendRequestSummary[]> {
  const rows = await prisma.friendRequest.findMany({
    where: { toUserId: userId, status: "PENDING" },
    include: {
      fromUser: { select: { id: true, email: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  })
  return rows.map(serializeRequest)
}

export async function listOutgoingRequests(userId: string): Promise<FriendRequestSummary[]> {
  const rows = await prisma.friendRequest.findMany({
    where: { fromUserId: userId, status: "PENDING" },
    include: {
      toUser: { select: { id: true, email: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  })
  return rows.map(serializeRequest)
}

function serializeRequest(r: {
  id: string
  fromUserId: string
  toUserId: string
  status: "PENDING" | "ACCEPTED" | "REJECTED"
  createdAt: Date
  fromUser?: { id: string; email: string; name: string | null }
  toUser?: { id: string; email: string; name: string | null }
}): FriendRequestSummary {
  return {
    id: r.id,
    fromUserId: r.fromUserId,
    toUserId: r.toUserId,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    ...(r.fromUser ? { fromUser: r.fromUser } : {}),
    ...(r.toUser ? { toUser: r.toUser } : {}),
  }
}

export async function sendFriendRequest(fromUserId: string, targetUserId: string) {
  const trimmed = targetUserId.trim()
  if (!trimmed) {
    return { ok: false as const, error: "EMPTY_ID" }
  }
  if (trimmed === fromUserId) {
    return { ok: false as const, error: "SELF" }
  }

  const target = await prisma.user.findUnique({
    where: { id: trimmed },
    select: { id: true },
  })
  if (!target) {
    return { ok: false as const, error: "USER_NOT_FOUND" }
  }

  if (await areFriends(fromUserId, trimmed)) {
    return { ok: false as const, error: "ALREADY_FRIENDS" }
  }

  const reverse = await prisma.friendRequest.findUnique({
    where: {
      fromUserId_toUserId: { fromUserId: trimmed, toUserId: fromUserId },
    },
  })

  if (reverse?.status === "PENDING") {
    const accepted = await prisma.friendRequest.update({
      where: { id: reverse.id },
      data: { status: "ACCEPTED" },
    })
    return { ok: true as const, autoAccepted: true, request: serializeRequest({ ...accepted, fromUser: undefined, toUser: undefined }) }
  }

  const existing = await prisma.friendRequest.findUnique({
    where: {
      fromUserId_toUserId: { fromUserId, toUserId: trimmed },
    },
  })

  if (existing?.status === "PENDING") {
    return { ok: false as const, error: "ALREADY_PENDING" }
  }
  if (existing?.status === "ACCEPTED") {
    return { ok: false as const, error: "ALREADY_FRIENDS" }
  }
  if (existing?.status === "REJECTED") {
    await prisma.friendRequest.delete({ where: { id: existing.id } })
  }

  const created = await prisma.friendRequest.create({
    data: {
      fromUserId,
      toUserId: trimmed,
      status: "PENDING",
    },
  })

  return { ok: true as const, autoAccepted: false, request: serializeRequest({ ...created }) }
}

export async function acceptFriendRequest(userId: string, requestId: string) {
  const req = await prisma.friendRequest.findFirst({
    where: { id: requestId, toUserId: userId, status: "PENDING" },
  })
  if (!req) {
    return { ok: false as const, error: "NOT_FOUND" }
  }
  await prisma.friendRequest.update({
    where: { id: requestId },
    data: { status: "ACCEPTED" },
  })
  return { ok: true as const }
}

export async function rejectFriendRequest(userId: string, requestId: string) {
  const req = await prisma.friendRequest.findFirst({
    where: { id: requestId, toUserId: userId, status: "PENDING" },
  })
  if (!req) {
    return { ok: false as const, error: "NOT_FOUND" }
  }
  await prisma.friendRequest.delete({ where: { id: requestId } })
  return { ok: true as const }
}
