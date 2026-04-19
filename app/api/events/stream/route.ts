import { getCurrentUserId } from "@/lib/auth"
import { subscribeToUserEvents } from "@/lib/events-bus"

export const dynamic = "force-dynamic"

/**
 * Stream SSE con cambios del calendario del usuario en vivo.
 *
 * El cliente abre `new EventSource("/api/events/stream")` y al recibir
 * cualquier mensaje refresca la lista de eventos. Mantenemos la conexión
 * abierta enviando un comentario keep-alive cada 25 s para evitar que
 * proxies (Cloudflare/Nginx) corten conexiones inactivas.
 */
export async function GET(req: Request) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return new Response("Unauthorized", { status: 401 })
  }

  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | null = null
  let keepAlive: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (eventName: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`),
          )
        } catch {
          // Si el cliente se ha desconectado, ignoramos.
        }
      }

      send("ready", { ok: true })

      unsubscribe = subscribeToUserEvents(userId, (change) => {
        send("change", change)
      })

      keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keep-alive ${Date.now()}\n\n`))
        } catch {
          /* desconectado */
        }
      }, 25_000)

      const onAbort = () => {
        if (keepAlive) clearInterval(keepAlive)
        if (unsubscribe) unsubscribe()
        try {
          controller.close()
        } catch {
          /* ya cerrado */
        }
      }

      if (req.signal.aborted) {
        onAbort()
        return
      }
      req.signal.addEventListener("abort", onAbort)
    },
    cancel() {
      if (keepAlive) clearInterval(keepAlive)
      if (unsubscribe) unsubscribe()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
