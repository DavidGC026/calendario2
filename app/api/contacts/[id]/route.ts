import { getCurrentUserId } from "@/lib/auth"
import {
  CONTACT_CATEGORIES,
  deleteContact,
  updateContact,
  type ContactCategory,
} from "@/lib/contacts"

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return Response.json({ error: "No autenticado" }, { status: 401 })
  }
  const { id } = await params

  let body: {
    name?: unknown
    category?: unknown
    relation?: unknown
    notes?: unknown
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return Response.json({ error: "Body inválido" }, { status: 400 })
  }

  const changes: {
    name?: string
    category?: ContactCategory
    relation?: string | null
    notes?: string | null
  } = {}
  if (typeof body.name === "string") changes.name = body.name
  if (typeof body.category === "string" && (CONTACT_CATEGORIES as readonly string[]).includes(body.category)) {
    changes.category = body.category as ContactCategory
  }
  if (typeof body.relation === "string" || body.relation === null) {
    changes.relation = body.relation as string | null
  }
  if (typeof body.notes === "string" || body.notes === null) {
    changes.notes = body.notes as string | null
  }

  const result = await updateContact(userId, id, changes)
  if (!result.ok) {
    if (result.error === "NOT_FOUND") {
      return Response.json({ error: "Contacto no encontrado" }, { status: 404 })
    }
    if (result.error === "ALREADY_EXISTS") {
      return Response.json({ error: "Ya existe un contacto con ese nombre" }, { status: 409 })
    }
    return Response.json({ error: result.error }, { status: 400 })
  }
  return Response.json({ contact: result.contact })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return Response.json({ error: "No autenticado" }, { status: 401 })
  }
  const { id } = await params
  const result = await deleteContact(userId, id)
  if (!result.ok) {
    return Response.json({ error: "Contacto no encontrado" }, { status: 404 })
  }
  return Response.json({ ok: true })
}
