/**
 * Comprobación del motor de sincronización, con una Google de mentira.
 *
 * Lo que se vigila aquí no es que las peticiones salgan bien —eso lo dirá la
 * primera cuenta de verdad— sino las dos cosas que se rompen en silencio y no se
 * ven hasta semanas después:
 *
 * 1. EL ECO. Al subir un evento, Google lo devuelve en la bajada siguiente. Si
 *    se aplicara sin mirar, `updatedAt` se movería, el evento volvería a parecer
 *    modificado y se subiría otra vez, a doce vueltas por hora y para siempre.
 *
 * 2. LA ZONA HORARIA. El servidor corre en UTC y el calendario vive en
 *    `EVENT_TIMEZONE`. Una conversión de más o de menos y las citas aparecen en
 *    el teléfono con seis horas de desfase.
 *
 * Se ejecuta contra una base de datos de usar y tirar:
 *   DATABASE_URL=… npx tsx scripts/test-google-sync.ts
 */

process.env.EVENT_TIMEZONE ??= "America/Mexico_City"
process.env.NEXTAUTH_SECRET ??= "prueba-solo-local"
process.env.GOOGLE_CLIENT_ID ??= "cliente-de-mentira"
process.env.GOOGLE_CLIENT_SECRET ??= "secreto-de-mentira"

import assert from "node:assert/strict"

/**
 * Los módulos se cargan a mano y no con `import` de arriba.
 *
 * `import` se evalúa antes que cualquier asignación del archivo, así que el
 * motor de sincronización leía `EVENT_TIMEZONE` antes de que estas líneas la
 * pusieran y se quedaba con Europe/Madrid. La prueba lo cazó a la primera, que
 * es exactamente para lo que está.
 */
async function cargarModulos() {
  return {
    ...(await import("@/lib/secret-box")),
    ...(await import("@/lib/events")),
    ...(await import("@/lib/prisma")),
    ...(await import("@/lib/google-calendar-sync")),
  }
}

type Prisma = Awaited<ReturnType<typeof cargarModulos>>["prisma"]

/** El calendario de Google de mentira: un mapa y un registro de lo que se le pidió. */
const google = {
  events: new Map<string, Record<string, unknown>>(),
  llamadas: [] as string[],
  siguienteId: 1,
}

const realFetch = globalThis.fetch

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
  const method = init?.method ?? "GET"
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

  if (url.startsWith("https://oauth2.googleapis.com/token")) {
    return json({ access_token: "token-de-mentira", expires_in: 3600 })
  }

  if (url.includes("/calendar/v3/calendars/")) {
    const match = url.match(/\/events\/?([^?]*)/)
    const eventId = decodeURIComponent(match?.[1] ?? "")

    if (method === "POST") {
      const id = `g${google.siguienteId++}`
      const body = JSON.parse(String(init?.body ?? "{}"))
      google.events.set(id, { ...body, id })
      google.llamadas.push(`insert ${body.summary}`)
      return json({ ...body, id })
    }
    if (method === "PATCH") {
      const body = JSON.parse(String(init?.body ?? "{}"))
      google.events.set(eventId, { ...google.events.get(eventId), ...body, id: eventId })
      google.llamadas.push(`patch ${eventId}`)
      return json(google.events.get(eventId))
    }
    if (method === "DELETE") {
      google.events.delete(eventId)
      google.llamadas.push(`delete ${eventId}`)
      return new Response(null, { status: 204 })
    }
    google.llamadas.push("list")
    return json({ items: [...google.events.values()], nextSyncToken: "testigo" })
  }

  if (url.startsWith("https://www.googleapis.com/oauth2/v3/userinfo")) {
    return json({ email: "prueba@gmail.com" })
  }

  return realFetch(input as RequestInfo, init)
}) as typeof fetch

const paso = (texto: string) => console.log(`  ✓ ${texto}`)

async function main() {
  const { encryptSecret, createEventForUser, deleteEventForUser, updateEventForUser, prisma, syncUser } =
    await cargarModulos()

  const estaSucio = async (id: string): Promise<boolean> => {
    const filas = await prisma.$queryRaw<Array<{ sucio: boolean }>>`
      SELECT ("googleSyncedAt" IS NULL OR "updatedAt" > "googleSyncedAt") AS "sucio"
      FROM "Event" WHERE "id" = ${id}`
    return filas[0]?.sucio ?? true
  }
  // Base limpia: este script escribe de verdad, así que solo contra una de usar y tirar.
  await prisma.event.deleteMany({})
  await prisma.googleDeletion.deleteMany({})
  await prisma.googleCalendarLink.deleteMany({})
  await prisma.user.deleteMany({ where: { email: "sync@prueba.local" } })

  const user = await prisma.user.create({ data: { email: "sync@prueba.local", name: "Prueba" } })
  await prisma.googleCalendarLink.create({
    data: {
      userId: user.id,
      googleEmail: "prueba@gmail.com",
      refreshToken: encryptSecret("refresh-de-mentira"),
    },
  })

  console.log("\n── Subir")
  const creado = await createEventForUser(user.id, {
    title: "Comida con Ana",
    eventDate: "2026-08-25",
    startTime: "14:00",
    endTime: "15:00",
  })
  assert.ok(creado.event)

  let r = await syncUser(user.id)
  assert.equal(r.pushed, 1, "el evento nuevo tiene que subir")
  paso("un evento creado aquí sube a Google")

  const subido = [...google.events.values()][0] as { start: { dateTime: string; timeZone: string } }
  assert.equal(subido.start.dateTime, "2026-08-25T14:00:00")
  assert.equal(subido.start.timeZone, "America/Mexico_City")
  // Sin la zona explícita, Google leería estas 14:00 como UTC y en el teléfono
  // de David saldrían a las ocho de la mañana.
  paso("sube con la zona dicha en voz alta, no como UTC")

  console.log("\n── El eco")
  assert.equal(await estaSucio(creado.event.id), false, "tras subir tiene que quedar limpio")
  r = await syncUser(user.id)
  assert.equal(r.pushed, 0, "no puede volver a subir lo mismo")
  assert.equal(r.pulled, 0, "ni aplicar como cambio lo que él mismo subió")
  assert.equal(await estaSucio(creado.event.id), false)
  r = await syncUser(user.id)
  assert.equal(r.pushed + r.pulled, 0)
  paso("tres pasadas seguidas y el evento no rebota: el bucle está cortado")

  console.log("\n── Bajar")
  const gid = [...google.events.keys()][0]
  google.events.set(gid, {
    ...google.events.get(gid),
    summary: "Comida con Ana y Beto",
    // Google manda el instante con su desfase; aquí tiene que volver a ser 16:00
    // de pared, no 22:00.
    start: { dateTime: "2026-08-25T16:00:00-06:00" },
    end: { dateTime: "2026-08-25T17:00:00-06:00" },
  })

  r = await syncUser(user.id)
  assert.equal(r.pulled, 1)
  const local = await prisma.event.findUniqueOrThrow({ where: { id: creado.event.id } })
  assert.equal(local.title, "Comida con Ana y Beto")
  assert.equal(local.startAt.getHours(), 16, "el desfase de Google tiene que traducirse a hora de pared")
  paso("un cambio en Google baja con la hora correcta")

  assert.equal(await estaSucio(creado.event.id), false)
  r = await syncUser(user.id)
  assert.equal(r.pushed, 0, "lo que acaba de bajar no puede volver a subir")
  paso("y lo que baja no rebota hacia arriba")

  console.log("\n── Eventos que no caben")
  google.events.set("g-todo-el-dia", {
    id: "g-todo-el-dia",
    summary: "Festivo",
    start: { date: "2026-09-16" },
    end: { date: "2026-09-17" },
  })
  google.events.set("g-varios-dias", {
    id: "g-varios-dias",
    summary: "Viaje",
    start: { date: "2026-10-01" },
    end: { date: "2026-10-05" },
  })

  r = await syncUser(user.id)
  const festivo = await prisma.event.findFirst({ where: { googleEventId: "g-todo-el-dia" } })
  assert.ok(festivo, "el de todo el día sí cabe")
  assert.equal(festivo.startAt.getHours(), 0)
  assert.equal(await prisma.event.findFirst({ where: { googleEventId: "g-varios-dias" } }), null)
  assert.ok(r.skipped >= 1, "el de varios días se cuenta como omitido, no se recorta")
  paso("el de todo el día entra; el de varios días se omite en vez de recortarse a medias")

  console.log("\n── Borrar")
  await deleteEventForUser(user.id, creado.event.id)
  r = await syncUser(user.id)
  assert.equal(r.deletedThere, 1)
  assert.equal(google.events.has(gid), false, "tiene que desaparecer también de Google")
  assert.equal(await prisma.googleDeletion.count(), 0, "y la lápida se recoge")
  paso("borrar aquí borra allá")

  google.events.set("g-todo-el-dia", { ...google.events.get("g-todo-el-dia"), status: "cancelled" })
  r = await syncUser(user.id)
  assert.equal(r.deletedHere, 1)
  assert.equal(await prisma.event.findFirst({ where: { googleEventId: "g-todo-el-dia" } }), null)
  paso("y borrar allá borra aquí")

  console.log("\n── Editar aquí después de haber bajado")
  google.events.set("g-de-google", {
    id: "g-de-google",
    summary: "Junta trimestral",
    start: { dateTime: "2026-11-03T11:00:00-06:00" },
    end: { dateTime: "2026-11-03T12:00:00-06:00" },
  })
  await syncUser(user.id)
  const bajado = await prisma.event.findFirstOrThrow({ where: { googleEventId: "g-de-google" } })
  await updateEventForUser(user.id, bajado.id, { startTime: "09:00", endTime: "10:00" }, true)
  assert.equal(await estaSucio(bajado.id), true, "editar tiene que dejarlo sucio otra vez")
  r = await syncUser(user.id)
  assert.equal(r.pushed, 1)
  paso("un evento que vino de Google y se edita aquí vuelve a subir")

  console.log("\n  Todo correcto.\n")
}

let cerrar: Prisma | null = null

main()
  .catch((e) => {
    console.error("\n  FALLÓ:", e instanceof Error ? e.message : e, "\n")
    process.exitCode = 1
  })
  .finally(async () => {
    cerrar ??= (await import("@/lib/prisma")).prisma
    await cerrar.$disconnect()
  })
