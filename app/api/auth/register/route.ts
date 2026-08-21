import bcrypt from "bcryptjs"
import { z } from "zod"

import { findUserByEmail, normalizeEmail } from "@/lib/google-users"
import { prisma } from "@/lib/prisma"

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().trim().min(2).max(100).optional(),
})

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const parsed = registerSchema.safeParse(json)
    if (!parsed.success) {
      return Response.json(
        { error: "Datos inválidos", issues: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const email = normalizeEmail(parsed.data.email)
    const { password, name } = parsed.data
    const existing = await findUserByEmail(email)
    if (existing) {
      return Response.json({ error: "Ese email ya está registrado" }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { email, passwordHash, name, aiEnabled: false },
      select: { id: true, email: true, name: true },
    })

    return Response.json({ user }, { status: 201 })
  } catch {
    return Response.json({ error: "No se pudo crear la cuenta" }, { status: 500 })
  }
}
