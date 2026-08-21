import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import bcrypt from "bcryptjs"
import { getServerSession } from "next-auth/next"
import { headers } from "next/headers"
import { z } from "zod"

import { logAuthAttempt } from "@/lib/auth-log"
import { findUserByEmail, upsertGoogleUser } from "@/lib/google-users"
import { prisma } from "@/lib/prisma"
import { verifyMobileAccessToken } from "@/lib/mobile-jwt"

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

function googleProviderConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim())
}

async function getAuthRequestMeta() {
  try {
    const h = await headers()
    const forwarded = h.get("x-forwarded-for")
    const ip = forwarded?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null
    const userAgent = h.get("user-agent")
    return { ip, userAgent }
  } catch {
    return { ip: null, userAgent: null }
  }
}

const secureCookies = process.env.NEXTAUTH_URL?.startsWith("https://") ?? true

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET ?? "dev-only-secret-change-in-production",
  session: { strategy: "jwt" },
  useSecureCookies: secureCookies,
  cookies: {
    csrfToken: {
      name: secureCookies ? "__Secure-next-auth.csrf-token" : "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: secureCookies,
      },
    },
    sessionToken: {
      name: secureCookies ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: secureCookies,
      },
    },
    callbackUrl: {
      name: secureCookies ? "__Secure-next-auth.callback-url" : "next-auth.callback-url",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: secureCookies,
      },
    },
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const meta = await getAuthRequestMeta()
        const rawEmail = credentials?.email?.trim().toLowerCase() ?? null

        const parsed = credentialsSchema.safeParse({
          email: rawEmail,
          password: credentials?.password,
        })
        if (!parsed.success) {
          await logAuthAttempt({
            channel: "web",
            email: rawEmail,
            ip: meta.ip,
            userAgent: meta.userAgent,
            success: false,
            reason: "validation_failed",
            detail: parsed.error.issues.map((i) => i.message).join("; "),
          })
          return null
        }

        const user = await findUserByEmail(parsed.data.email)
        if (!user?.passwordHash) {
          await logAuthAttempt({
            channel: "web",
            email: parsed.data.email,
            ip: meta.ip,
            userAgent: meta.userAgent,
            success: false,
            reason: user ? "bad_password" : "user_not_found",
          })
          return null
        }

        const isValid = await bcrypt.compare(parsed.data.password, user.passwordHash)
        if (!isValid) {
          await logAuthAttempt({
            channel: "web",
            email: parsed.data.email,
            ip: meta.ip,
            userAgent: meta.userAgent,
            success: false,
            reason: "bad_password",
          })
          return null
        }

        await logAuthAttempt({
          channel: "web",
          email: parsed.data.email,
          ip: meta.ip,
          userAgent: meta.userAgent,
          success: true,
          reason: "success",
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email,
          role: user.role,
          aiEnabled: user.aiEnabled,
          hasPassword: true,
        }
      },
    }),
    ...(googleProviderConfigured()
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: true,
            authorization: { params: { prompt: "select_account" } },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true
      if (!user.email) return false
      await upsertGoogleUser({ email: user.email, name: user.name })
      return true
    },
    async jwt({ token, user, account }) {
      if (account?.provider === "google") {
        const email =
          typeof user?.email === "string"
            ? user.email
            : typeof token.email === "string"
              ? token.email
              : null
        if (email) {
          const dbUser = await findUserByEmail(email)
          if (dbUser) token.sub = dbUser.id
        }
      } else if (user?.id) {
        token.sub = user.id
      }

      if (token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { role: true, aiEnabled: true, passwordHash: true },
        })
        if (dbUser) {
          token.role = dbUser.role
          token.aiEnabled = dbUser.aiEnabled
          token.hasPassword = Boolean(dbUser.passwordHash)
        }
      }

      return token
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
        session.user.role = (token.role as "USER" | "ADMIN") ?? "USER"
        session.user.aiEnabled = Boolean(token.aiEnabled)
        session.user.hasPassword = Boolean(token.hasPassword)
      }
      return session
    },
  },
}

export async function getCurrentSession() {
  return getServerSession(authOptions)
}

export async function getCurrentUserId() {
  try {
    const h = await headers()
    const auth = h.get("authorization")
    if (auth?.toLowerCase().startsWith("bearer ")) {
      const raw = auth.slice(7).trim()
      if (raw) {
        const id = await verifyMobileAccessToken(raw)
        if (id) return id
      }
    }
  } catch {
    // Sin cabeceras (p. ej. contexto no HTTP)
  }
  const session = await getCurrentSession()
  return session?.user?.id
}

export async function getCurrentUser() {
  const id = await getCurrentUserId()
  if (!id) return null
  return prisma.user.findUnique({ where: { id } })
}

export async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user || user.role !== "ADMIN") return null
  return user
}

/** Usuario autenticado con permiso de IA; si no, respuesta HTTP lista para devolver. */
export async function requireAiAccess() {
  const user = await getCurrentUser()
  if (!user) {
    return { user: null, error: Response.json({ error: "No autenticado" }, { status: 401 }) }
  }
  if (!user.aiEnabled) {
    return {
      user: null,
      error: Response.json(
        { error: "La IA no está habilitada para esta cuenta" },
        { status: 403 },
      ),
    }
  }
  return { user, error: null }
}
