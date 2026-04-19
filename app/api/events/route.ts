import { z } from "zod"

import { getCurrentUserId } from "@/lib/auth"

/** Tiempo suficiente para Resend + varios destinatarios en serverless. */
export const maxDuration = 60
import { runNotifyEventCreated } from "@/lib/event-notifications"
import { createEventForUser, listEventsForUser } from "@/lib/events"

const createEventSchema = z.object({
  title: z.string().min(1),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  description: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  attendees: z.array(z.string()).optional().nullable(),
  participantUserIds: z.array(z.string()).optional().nullable(),
  participantNameHints: z.array(z.string()).optional().nullable(),
  organizer: z.string().optional().nullable(),
  reminderMinutesBefore: z.number().int().nullable().optional(),
  emailRemindersEnabled: z.boolean().optional(),
  allowConflict: z.boolean().optional(),
})

export async function GET() {
  const userId = await getCurrentUserId()
  if (!userId) {
    return Response.json({ error: "No autenticado" }, { status: 401 })
  }

  const events = await listEventsForUser(userId)
  return Response.json({ events })
}

export async function POST(req: Request) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return Response.json({ error: "No autenticado" }, { status: 401 })
  }

  const json = await req.json()
  const parsed = createEventSchema.safeParse(json)
  if (!parsed.success) {
    return Response.json(
      { error: "Payload inválido", issues: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { allowConflict = false, ...input } = parsed.data
  let result
  try {
    result = await createEventForUser(userId, input, allowConflict)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return Response.json({ error: msg }, { status: 400 })
  }
  if (!result.event) {
    return Response.json(
      { error: "Conflicto de horario", conflicts: result.conflicts },
      { status: 409 },
    )
  }

  await runNotifyEventCreated(userId, result.event)

  return Response.json(result, { status: 201 })
}
