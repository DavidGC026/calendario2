/**
 * Bus de eventos en memoria por proceso, usado para empujar cambios al
 * cliente vía Server-Sent Events. Cada usuario tiene su propio canal y
 * sus suscriptores son las pestañas/dispositivos abiertas.
 *
 * - Local al worker: con un único contenedor (el caso actual) está perfecto.
 *   Si en el futuro hay varias instancias hay que migrar a Redis pub/sub.
 * - El payload se mantiene minimalista: solo el tipo de cambio y el id, así
 *   el cliente decide si refrescar todo o solo ese evento.
 */

export type EventChange =
  | { type: "created" | "updated"; eventId: string }
  | { type: "deleted"; eventId: string }
  | { type: "ping" }

type Subscriber = (change: EventChange) => void

const subscribers = new Map<string, Set<Subscriber>>()

export function subscribeToUserEvents(userId: string, sub: Subscriber): () => void {
  let set = subscribers.get(userId)
  if (!set) {
    set = new Set()
    subscribers.set(userId, set)
  }
  set.add(sub)
  return () => {
    const current = subscribers.get(userId)
    if (!current) return
    current.delete(sub)
    if (current.size === 0) subscribers.delete(userId)
  }
}

export function publishUserEvent(userId: string, change: EventChange): void {
  const set = subscribers.get(userId)
  if (!set || set.size === 0) return
  for (const sub of set) {
    try {
      sub(change)
    } catch (e) {
      console.error("[events-bus] subscriber error", e)
    }
  }
}
