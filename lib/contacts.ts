import { prisma } from "@/lib/prisma"
import type { CalendarLaneId } from "@/lib/calendar-lanes"

export type ContactCategory = "FAMILY" | "FRIEND" | "WORK" | "OTHER"

export type ContactDTO = {
  id: string
  name: string
  category: ContactCategory
  relation: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export const CONTACT_CATEGORIES: ContactCategory[] = ["FAMILY", "FRIEND", "WORK", "OTHER"]

export function isContactCategory(v: unknown): v is ContactCategory {
  return typeof v === "string" && (CONTACT_CATEGORIES as readonly string[]).includes(v)
}

/**
 * Mapeo categoría → carril del calendario (color Tailwind):
 * - FAMILY  → Familia (morado)
 * - WORK    → Trabajo (verde)
 * - FRIEND  → Personal (naranja, los amigos viven en el carril Personal)
 * - OTHER   → Mi calendario (azul)
 */
export function categoryToLane(c: ContactCategory): CalendarLaneId {
  switch (c) {
    case "FAMILY":
      return "bg-purple-500"
    case "WORK":
      return "bg-green-500"
    case "FRIEND":
      return "bg-orange-500"
    case "OTHER":
    default:
      return "bg-blue-500"
  }
}

export function categoryLabel(c: ContactCategory, locale: "es" | "en" = "es"): string {
  if (locale === "en") {
    return { FAMILY: "Family", FRIEND: "Friend", WORK: "Work", OTHER: "Other" }[c]
  }
  return { FAMILY: "Familia", FRIEND: "Amigo", WORK: "Trabajo", OTHER: "Otro" }[c]
}

/** Normaliza un nombre para búsqueda (lowercase, sin acentos, espacios colapsados). */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
}

function serialize(c: {
  id: string
  name: string
  category: ContactCategory
  relation: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}): ContactDTO {
  return {
    id: c.id,
    name: c.name,
    category: c.category,
    relation: c.relation,
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }
}

export async function listContacts(userId: string): Promise<ContactDTO[]> {
  const rows = await prisma.contact.findMany({
    where: { userId },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  })
  return rows.map(serialize)
}

/** Busca contactos del usuario por coincidencia en `name` (parcial, case-insensitive). */
export async function searchContacts(userId: string, query: string): Promise<ContactDTO[]> {
  const norm = normalizeName(query)
  if (norm.length < 2) return []
  const rows = await prisma.contact.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  })
  const matches: ContactDTO[] = []
  const queryWords = norm.split(" ").filter(Boolean)
  for (const r of rows) {
    const name = r.normalizedName
    if (name === norm) {
      matches.unshift(serialize(r))
      continue
    }
    if (name.includes(norm)) {
      matches.push(serialize(r))
      continue
    }
    if (queryWords.length >= 2 && queryWords.every((w) => name.includes(w))) {
      matches.push(serialize(r))
      continue
    }
    const nameWords = name.split(" ").filter(Boolean)
    if (queryWords.length === 1 && nameWords.some((w) => w === norm)) {
      matches.push(serialize(r))
    }
  }
  return matches
}

export type CreateContactInput = {
  name: string
  category: ContactCategory
  relation?: string | null
  notes?: string | null
}

export async function createContact(
  userId: string,
  input: CreateContactInput,
): Promise<{ ok: true; contact: ContactDTO } | { ok: false; error: "EMPTY_NAME" | "INVALID_CATEGORY" | "ALREADY_EXISTS" }> {
  const trimmedName = input.name.trim()
  if (!trimmedName) return { ok: false, error: "EMPTY_NAME" }
  if (!isContactCategory(input.category)) return { ok: false, error: "INVALID_CATEGORY" }

  const normalized = normalizeName(trimmedName)
  const existing = await prisma.contact.findUnique({
    where: { userId_normalizedName: { userId, normalizedName: normalized } },
  })
  if (existing) return { ok: false, error: "ALREADY_EXISTS" }

  const created = await prisma.contact.create({
    data: {
      userId,
      name: trimmedName,
      normalizedName: normalized,
      category: input.category,
      relation: input.relation?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  })
  return { ok: true, contact: serialize(created) }
}

export type UpdateContactInput = Partial<CreateContactInput>

export async function updateContact(
  userId: string,
  contactId: string,
  changes: UpdateContactInput,
): Promise<{ ok: true; contact: ContactDTO } | { ok: false; error: "NOT_FOUND" | "INVALID_CATEGORY" | "EMPTY_NAME" | "ALREADY_EXISTS" }> {
  const owned = await prisma.contact.findFirst({ where: { id: contactId, userId } })
  if (!owned) return { ok: false, error: "NOT_FOUND" }

  const data: Record<string, unknown> = {}
  if (changes.name !== undefined) {
    const trimmed = changes.name.trim()
    if (!trimmed) return { ok: false, error: "EMPTY_NAME" }
    const normalized = normalizeName(trimmed)
    if (normalized !== owned.normalizedName) {
      const dup = await prisma.contact.findUnique({
        where: { userId_normalizedName: { userId, normalizedName: normalized } },
      })
      if (dup) return { ok: false, error: "ALREADY_EXISTS" }
    }
    data.name = trimmed
    data.normalizedName = normalized
  }
  if (changes.category !== undefined) {
    if (!isContactCategory(changes.category)) return { ok: false, error: "INVALID_CATEGORY" }
    data.category = changes.category
  }
  if (changes.relation !== undefined) data.relation = changes.relation?.trim() || null
  if (changes.notes !== undefined) data.notes = changes.notes?.trim() || null

  const updated = await prisma.contact.update({ where: { id: contactId }, data })
  return { ok: true, contact: serialize(updated) }
}

export async function deleteContact(
  userId: string,
  contactId: string,
): Promise<{ ok: boolean }> {
  const owned = await prisma.contact.findFirst({ where: { id: contactId, userId } })
  if (!owned) return { ok: false }
  await prisma.contact.delete({ where: { id: contactId } })
  return { ok: true }
}
