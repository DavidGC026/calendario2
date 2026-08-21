import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface User {
    role?: "USER" | "ADMIN"
    aiEnabled?: boolean
    hasPassword?: boolean
  }
  interface Session {
    user: {
      id: string
      role: "USER" | "ADMIN"
      aiEnabled: boolean
      hasPassword: boolean
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "USER" | "ADMIN"
    aiEnabled?: boolean
    hasPassword?: boolean
  }
}
