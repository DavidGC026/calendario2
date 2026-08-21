import type { User } from "@prisma/client"

export type PublicUser = {
  id: string
  email: string
  name: string | null
  role: User["role"]
  aiEnabled: boolean
  hasPassword: boolean
}

export function toPublicUser(user: Pick<User, "id" | "email" | "name" | "role" | "aiEnabled" | "passwordHash">): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    aiEnabled: user.aiEnabled,
    hasPassword: Boolean(user.passwordHash),
  }
}
