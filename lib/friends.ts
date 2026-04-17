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

function normalizeComparable(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** Heurística: IDs de usuario en BD (cuid, etc.) frente a nombres que la IA mete por error en participantUserIds. */
function looksLikeDatabaseUserId(s: string): boolean {
  const t = s.trim()
  return t.length >= 20 && t.length <= 36 && /^[a-z0-9_-]+$/i.test(t) && !/\s/.test(t)
}

function friendMatchesHint(f: FriendSummary, hint: string): boolean {
  const h = normalizeComparable(hint)
  if (h.length < 2) return false
  if (f.id === hint.trim()) return true
  const name = normalizeComparable(f.name ?? "")
  const email = f.email.toLowerCase()
  const local = email.split("@")[0] ?? ""

  if (name === h) return true
  if (name.includes(h) || (h.length >= 3 && h.includes(name) && name.length >= 2)) return true

  const hWords = h.split(" ").filter((w) => w.length > 0)
  if (hWords.length >= 2 && hWords.every((w) => name.includes(w))) return true

  const compact = h.replace(/\s/g, "")
  if (compact.length >= 3 && (local.includes(compact) || email.includes(h.replace(/\s/g, ".")))) return true
  return false
}

/**
 * Convierte IDs válidos + pistas de nombre (y "IDs" que en realidad son nombres) en userIds de amigos aceptados.
 */
export async function resolveParticipantUserIdsForOwner(
  ownerId: string,
  participantUserIds: string[] | null | undefined,
  participantNameHints: string[] | null | undefined,
): Promise<string[]> {
  const friends = await listFriends(ownerId)
  const friendById = new Map(friends.map((f) => [f.id, f]))
  const out = new Set<string>()
  const nameBuckets: string[] = [...(participantNameHints ?? [])].filter(Boolean).map((s) => s.trim())

  for (const raw of participantUserIds ?? []) {
    const t = raw.trim()
    if (!t) continue
    if (friendById.has(t)) {
      out.add(t)
      continue
    }
    if (!looksLikeDatabaseUserId(t)) {
      nameBuckets.push(t)
    }
  }

  const seenHints = new Set<string>()
  for (const hint of nameBuckets) {
    const key = normalizeComparable(hint)
    if (!key || seenHints.has(key)) continue
    seenHints.add(key)
    const matches = friends.filter((f) => friendMatchesHint(f, hint))
    if (matches.length === 1) {
      out.add(matches[0].id)
    } else if (matches.length > 1) {
      const exact = matches.find((f) => normalizeComparable(f.name ?? "") === normalizeComparable(hint))
      if (exact) out.add(exact.id)
    }
  }

  return [...out].filter((id) => id !== ownerId)
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
  return { ok: true as const, fromUserId: req.fromUserId }
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
