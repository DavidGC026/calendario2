"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { isFileUIPart, isReasoningUIPart, isTextUIPart, isToolUIPart, type UIMessage } from "ai"

import {
  type Locale,
  eventFromToolOutput,
  laneName,
  readableDate,
  summarizeToolOutput,
  toolLabel,
  toolMutates,
} from "@/lib/ai-chat-format"

/**
 * El hilo del asistente, que no es un chat: es el registro de lo que le pasó a
 * tu agenda.
 *
 * El panel anterior se veía plano por una razón concreta y no por falta de
 * adornos: tus palabras, las del asistente y un cambio de verdad en el
 * calendario llevaban exactamente la misma caja gris. Cuando todo pesa igual,
 * nada destaca, y lo único que de verdad importa —que acaba de aparecer un
 * evento el jueves— quedaba enterrado entre dos párrafos.
 *
 * Aquí hay tres pesos y solo tres:
 *
 *   1. TÚ hablas dentro de una burbuja, alineada a la derecha. Es lo que dijiste
 *      y ya pasó.
 *   2. EL ASISTENTE no lleva burbuja. Su texto es la voz del panel, a todo el
 *      ancho. Quitarle la caja es lo que deja sitio para que destaque lo tercero.
 *   3. LO QUE CAMBIÓ se pinta como una ficha del evento, con la misma barra de
 *      color del calendario al que fue y la hora en monoespaciada. Es una
 *      miniatura de la cosa que ahora existe en tu agenda, no el nombre de una
 *      función en inglés.
 *
 * La hora va en monoespaciada con cifras tabulares a propósito: dos fichas
 * seguidas alinean sus columnas y el hilo se lee hacia abajo como una agenda.
 */

/** El color de la barra según el calendario, igual que en la cuadrícula. */
const LANE_RAIL: Record<string, string> = {
  "bg-blue-500": "bg-blue-400",
  "bg-green-500": "bg-emerald-400",
  "bg-orange-500": "bg-orange-400",
  "bg-purple-500": "bg-purple-400",
}

/**
 * El texto del asistente, con su formato.
 *
 * Escribe en Markdown —«apuntado **el jueves**»— y hasta ahora se pintaba en
 * crudo, así que en pantalla salían los asteriscos. No se reusa
 * `MarkdownContent` porque ese está afinado para la página de notas, con títulos
 * grandes y espaciado de artículo: aquí son dos frases dentro de un panel
 * estrecho, y lo que hace falta es lo contrario, prosa apretada y sin márgenes
 * que separen del resto del hilo.
 */
function AssistantText({ text }: { text: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none text-[15px] leading-relaxed text-white/90 prose-p:my-1 prose-headings:my-1 prose-headings:text-base prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-strong:text-white prose-a:text-dvg-gold-light">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  )
}

type Props = {
  messages: UIMessage[]
  language: Locale
  /** El modelo está escribiendo: se enseña el pulso al final del hilo. */
  busy: boolean
  emptyText: string
}

function EventChip({ event, language }: { event: NonNullable<ReturnType<typeof eventFromToolOutput>>; language: Locale }) {
  const hours = event.startTime && event.endTime ? `${event.startTime}–${event.endTime}` : event.startTime

  return (
    <div className="mt-2 flex overflow-hidden rounded-xl border border-white/10 bg-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.09)]">
      {/* La barra de color es la misma señal que en el calendario: dice a qué
          lista fue sin tener que leer nada. */}
      <span className={`w-[3px] shrink-0 ${LANE_RAIL[event.color] ?? LANE_RAIL["bg-blue-500"]}`} aria-hidden />
      <div className="min-w-0 px-3 py-2">
        <p className="truncate text-sm font-medium text-white">{event.title}</p>
        <p className="mt-0.5 font-mono text-[11px] tabular-nums text-white/50">
          {readableDate(event.eventDate, language)}
          {hours ? ` · ${hours}` : ""}
          {/* El nombre del calendario además del color: el color solo no vale
              para quien no lo distingue. */}
          <span className="font-sans"> · {laneName(event.color, language)}</span>
        </p>
      </div>
    </div>
  )
}

export function AiChatStream({ messages, language, busy, emptyText }: Props) {
  if (messages.length === 0) {
    return <p className="px-1 text-sm text-white/40">{emptyText}</p>
  }

  return (
    <div className="space-y-5">
      {messages.map((message) => {
        const isUser = message.role === "user"

        return (
          <div
            key={message.id}
            className={`flex flex-col gap-1 duration-300 animate-in fade-in slide-in-from-bottom-1 motion-reduce:animate-none ${
              isUser ? "items-end" : "items-start"
            }`}
          >
            {message.parts.map((part, pi) => {
              if (isReasoningUIPart(part)) return null

              if (isTextUIPart(part)) {
                if (!part.text) return null
                return isUser ? (
                  <p
                    key={pi}
                    className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md border border-dvg-gold-light/25 bg-dvg-red/18 px-3 py-2 text-sm text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  >
                    {part.text}
                  </p>
                ) : (
                  <AssistantText key={pi} text={part.text} />
                )
              }

              if (isFileUIPart(part)) {
                if (part.mediaType?.startsWith("image/") && part.url && part.url !== "[adjunto]") {
                  return (
                    // eslint-disable-next-line @next/next/no-img-element -- data URLs del chat
                    <img
                      key={pi}
                      src={part.url}
                      alt=""
                      className="max-h-44 max-w-[85%] rounded-xl border border-white/15 object-contain"
                    />
                  )
                }
                return (
                  <p key={pi} className="text-xs text-white/45">
                    {language === "es" ? "Archivo adjunto" : "Attachment"}
                  </p>
                )
              }

              if (isToolUIPart(part)) {
                const toolName = part.type.startsWith("tool-") ? part.type.slice(5) : part.type
                const running = part.state === "input-streaming" || part.state === "input-available"
                const output = part.state === "output-available" && "output" in part ? (part as { output?: unknown }).output : undefined
                const event = eventFromToolOutput(output)
                const detail = summarizeToolOutput(output, language)
                const strong = toolMutates(toolName)

                return (
                  <div key={pi} className="w-full pt-1">
                    <p
                      className={`flex items-center gap-1.5 text-[11px] ${
                        strong && !running ? "text-rose-200/80" : "text-white/45"
                      }`}
                    >
                      <span
                        className={`h-1 w-1 rounded-full ${
                          running ? "animate-pulse bg-white/60 motion-reduce:animate-none" : strong ? "bg-rose-400" : "bg-white/30"
                        }`}
                        aria-hidden
                      />
                      {toolLabel(toolName, !running, language)}
                      {running ? "…" : ""}
                    </p>
                    {event ? <EventChip event={event} language={language} /> : null}
                    {/* El detalle solo cuando la herramienta cambió algo y no
                        dejó ficha —un borrado, un fallo—. Con las de consulta
                        sobraba: «Hay solapamientos en ese horario» iba seguido
                        del asistente diciendo «a esa hora choca con otra cosa»,
                        el mismo hecho contado dos veces, y la segunda es la que
                        el usuario iba a leer de todos modos. */}
                    {!event && detail && strong ? (
                      <p className="mt-1 text-[13px] text-white/60">{detail}</p>
                    ) : null}
                  </div>
                )
              }

              return null
            })}
          </div>
        )
      })}

      {busy ? (
        <p className="flex items-center gap-1.5 text-[11px] text-white/40" aria-live="polite">
          <span className="h-1 w-1 animate-pulse rounded-full bg-rose-400 motion-reduce:animate-none" aria-hidden />
          {language === "es" ? "Pensando" : "Thinking"}
        </p>
      ) : null}
    </div>
  )
}
