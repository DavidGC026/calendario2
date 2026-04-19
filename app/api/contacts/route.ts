import { getCurrentUserId } from "@/lib/auth"
import {
  CONTACT_CATEGORIES,
  createContact,
  listContacts,
  type ContactCategory,
} from "@/lib/contacts"

export async function GET() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return Response.json({ error: "No autenticado" }, { status: 401 })
  }
  const contacts = await listContacts(userId)
  return Response.json({ contacts })
}

export async function POST(req: Request) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return Response.json({ error: "No autenticado" }, { status: 401 })
  }

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

  const name = typeof body.name === "string" ? body.name : ""
  const category = body.category as ContactCategory | undefined
  const relation = typeof body.relation === "string" ? body.relation : null
  const notes = typeof body.notes === "string" ? body.notes : null

  if (!name.trim()) {
    return Response.json({ error: "Nombre requerido" }, { status: 400 })
  }
  if (!category || !(CONTACT_CATEGORIES as readonly string[]).includes(category)) {
    return Response.json(
      { error: `Categoría inválida (esperado: ${CONTACT_CATEGORIES.join(", ")})` },
      { status: 400 },
    )
  }

  const result = await createContact(userId, { name, category, relation, notes })
  if (!result.ok) {
    if (result.error === "ALREADY_EXISTS") {
      return Response.json({ error: "Ya existe un contacto con ese nombre" }, { status: 409 })
    }
    return Response.json({ error: result.error }, { status: 400 })
  }
  return Response.json({ contact: result.contact }, { status: 201 })
}
