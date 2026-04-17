import bcrypt from "bcryptjs"

import { prisma } from "@/lib/prisma"

async function main() {
  const email = "demo@calendar.local"
  const passwordHash = await bcrypt.hash("demo1234", 10)

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      name: "Demo User",
    },
  })

  await prisma.event.createMany({
    data: [
      {
        userId: user.id,
        title: "Daily Standup",
        description: "Sync rápido de equipo",
        location: "Google Meet",
        startAt: new Date("2026-04-18T09:00:00"),
        endAt: new Date("2026-04-18T09:30:00"),
        organizer: "Demo User",
        attendees: ["Equipo Core"],
      },
      {
        userId: user.id,
        title: "Revisión con cliente",
        description: "Revisión semanal de avances",
        location: "Zoom",
        startAt: new Date("2026-04-18T11:00:00"),
        endAt: new Date("2026-04-18T12:00:00"),
        organizer: "Demo User",
        attendees: ["Cliente ACME"],
        color: "bg-violet-500",
      },
    ],
    skipDuplicates: true,
  })
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
