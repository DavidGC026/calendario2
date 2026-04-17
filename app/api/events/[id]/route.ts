import { z } from "zod"

import { getCurrentUserId } from "@/lib/auth"
import { notifyEventDeletedAsync, notifyEventUpdatedAsync } from "@/lib/event-notifications"
import { deleteEventForUser, updateEventForUser } from "@/lib/events"

const updateEventSchema = z
  .object({
    title: z.string().min(1).optional(),
    eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    description: z.string().optional().nullable(),
    location: z.string().optional().nullable(),
    color: z.string().optional().nullable(),
    attendees: z.array(z.string()).optional().nullable(),
    participantUserIds: z.array(z.string()).optional().nullable(),
    organizer: z.string().optional().nullable(),
    allowConflict: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "No hay campos para actualizar",
  })

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return Response.json({ error: "No autenticado" }, { status: 401 })
  }

  const { id } = await params
  const json = await req.json()
  const parsed = updateEventSchema.safeParse(json)
  if (!parsed.success) {
    return Response.json(
      { error: "Payload inválido", issues: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { allowConflict = false, ...input } = parsed.data
  let result
  try {
    result = await updateEventForUser(userId, id, input, allowConflict)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return Response.json({ error: msg }, { status: 400 })
  }
  if (result.notFound) {
    return Response.json({ error: "Evento no encontrado" }, { status: 404 })
  }

  if (!result.event) {
    return Response.json(
      { error: "Conflicto de horario", conflicts: result.conflicts },
      { status: 409 },
    )
  }

  notifyEventUpdatedAsync(userId, result.event)

  return Response.json(result)
}

export async function DELETE(_: Request, { params }: RouteParams) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return Response.json({ error: "No autenticado" }, { status: 401 })
  }

  const { id } = await params
  const deletedDto = await deleteEventForUser(userId, id)
  if (!deletedDto) {
    return Response.json({ error: "Evento no encontrado" }, { status: 404 })
  }

  notifyEventDeletedAsync(userId, deletedDto)

  return Response.json({ success: true })
}
