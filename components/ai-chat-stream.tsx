"use client"

import type { LucideIcon } from "lucide-react"
import { CalendarClock, CalendarDays, CheckCircle2, ImagePlus, Sparkles } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { isFileUIPart, isReasoningUIPart, isTextUIPart, isToolUIPart, type UIMessage } from "ai"

import { DvgMark } from "@/components/dvg-mark"
import {
  type Locale,
  eventFromToolOutput,
  laneName,
  readableDate,
  summarizeToolOutput,
  toolLabel,
  toolMutates,
} from "@/lib/ai-chat-format"

const LANE_RAIL: Record<string, string> = {
  "bg-blue-500": "bg-blue-400",
  "bg-green-500": "bg-emerald-400",
  "bg-orange-500": "bg-orange-400",
  "bg-purple-500": "bg-purple-400",
}

type Props = {
  messages: UIMessage[]
  language: Locale
  busy: boolean
  emptyText: string
  onSuggestion: (suggestion: string) => void
}

type Suggestion = {
  icon: LucideIcon
  title: string
  description: string
  prompt: string
}

const SUGGESTIONS: Record<Locale, Suggestion[]> = {
  es: [
    {
      icon: CalendarClock,
      title: "Organiza mi día",
      description: "Revisa eventos, huecos y posibles conflictos.",
      prompt: "Ayúdame a organizar mi día de hoy y dime qué espacios libres tengo.",
    },
    {
      icon: CalendarDays,
      title: "Agenda un evento",
      description: "Dime qué, cuándo y en qué calendario guardarlo.",
      prompt: "Quiero agendar un evento nuevo.",
    },
    {
      icon: ImagePlus,
      title: "Leer una captura",
      description: "Adjunta una imagen y conviértela en eventos.",
      prompt: "Quiero extraer fechas y horarios de una imagen.",
    },
  ],
  en: [
    {
      icon: CalendarClock,
      title: "Plan my day",
      description: "Review events, open slots, and possible conflicts.",
      prompt: "Help me plan today and tell me which time slots are open.",
    },
    {
      icon: CalendarDays,
      title: "Schedule an event",
      description: "Tell me what, when, and which calendar to use.",
      prompt: "I want to schedule a new event.",
    },
    {
      icon: ImagePlus,
      title: "Read a screenshot",
      description: "Attach an image and turn it into calendar events.",
      prompt: "I want to extract dates and times from an image.",
    },
  ],
}

function AssistantText({ text }: { text: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none text-[15px] leading-7 text-white/85 prose-p:my-1 prose-headings:my-2 prose-headings:text-base prose-headings:text-white prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-strong:text-white prose-a:text-dvg-gold-light">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  )
}

function EmptyChat({ language, emptyText, onSuggestion }: Pick<Props, "language" | "emptyText" | "onSuggestion">) {
  return (
    <div className="flex min-h-full items-center py-4">
      <section className="relative w-full overflow-hidden rounded-[1.75rem] border border-dvg-gold-light/20 bg-neutral-950/60 p-5 shadow-[0_22px_70px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:p-6">
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-dvg-gold-light/70 to-transparent" aria-hidden />
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-dvg-red/15 blur-3xl" aria-hidden />

        <div className="relative flex items-start gap-3">
          <DvgMark className="h-11 w-11 drop-shadow-[0_8px_24px_rgba(166,27,36,0.28)]" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-dvg-gold-light/80">
              {language === "es" ? "Asistente de agenda" : "Calendar assistant"}
            </p>
            <h3 className="mt-1 text-xl font-semibold tracking-tight text-white">
              {language === "es" ? "¿Qué quieres organizar?" : "What would you like to organize?"}
            </h3>
          </div>
        </div>

        <p className="relative mt-4 max-w-[44ch] text-sm leading-6 text-white/55">{emptyText}</p>

        <div className="relative mt-5 grid gap-2">
          {SUGGESTIONS[language].map(({ icon: Icon, title, description, prompt }) => (
            <button
              key={title}
              type="button"
              onClick={() => onSuggestion(prompt)}
              className="group flex min-h-16 w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-3.5 py-3 text-left transition duration-200 hover:-translate-y-0.5 hover:border-dvg-gold-light/30 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dvg-gold-light/70 motion-reduce:transform-none"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-dvg-gold-light/20 bg-dvg-gold-dark/25 text-dvg-gold-light transition group-hover:border-dvg-gold-light/35">
                <Icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-white/90">{title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-white/45">{description}</span>
              </span>
              <span className="pr-1 text-lg text-white/25 transition group-hover:translate-x-0.5 group-hover:text-dvg-gold-light" aria-hidden>
                →
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function EventCard({ event, language }: { event: NonNullable<ReturnType<typeof eventFromToolOutput>>; language: Locale }) {
  const hours = event.startTime && event.endTime ? `${event.startTime}–${event.endTime}` : event.startTime

  return (
    <article className="relative mt-2 overflow-hidden rounded-2xl border border-dvg-gold-light/15 bg-[#15110f]/90 p-3.5 shadow-[0_14px_40px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.05)]">
      <span className={`absolute inset-y-0 left-0 w-1 ${LANE_RAIL[event.color] ?? LANE_RAIL["bg-blue-500"]}`} aria-hidden />
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-dvg-gold-light/15 bg-white/[0.05] text-dvg-gold-light">
          <CalendarDays className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{event.title}</p>
          <p className="mt-1 font-mono text-[11px] leading-5 tabular-nums text-white/50">
            {readableDate(event.eventDate, language)}
            {hours ? ` · ${hours}` : ""}
          </p>
          <p className="mt-1.5 inline-flex rounded-full border border-white/10 bg-white/[0.045] px-2 py-0.5 text-[10px] font-medium text-white/55">
            {laneName(event.color, language)}
          </p>
        </div>
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-dvg-gold-light" aria-label={language === "es" ? "Confirmado" : "Confirmed"} />
      </div>
    </article>
  )
}

export function AiChatStream({ messages, language, busy, emptyText, onSuggestion }: Props) {
  if (messages.length === 0) {
    return <EmptyChat language={language} emptyText={emptyText} onSuggestion={onSuggestion} />
  }

  return (
    <div className="space-y-7 pb-2" role="log" aria-live="polite" aria-label={language === "es" ? "Conversación con el asistente" : "Assistant conversation"}>
      {messages.map((message) => {
        const isUser = message.role === "user"

        return (
          <article
            key={message.id}
            className={`flex flex-col duration-300 animate-in fade-in slide-in-from-bottom-1 motion-reduce:animate-none ${isUser ? "items-end" : "items-stretch"}`}
          >
            {isUser ? (
              <p className="mb-1.5 pr-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
                {language === "es" ? "Tú" : "You"}
              </p>
            ) : (
              <div className="mb-2 flex items-center gap-2">
                <DvgMark className="h-7 w-7" />
                <div>
                  <p className="text-xs font-semibold text-white/85">DVG</p>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-dvg-gold-light/55">
                    {language === "es" ? "Asistente de agenda" : "Calendar assistant"}
                  </p>
                </div>
              </div>
            )}

            <div className={isUser ? "flex max-w-[88%] flex-col items-end gap-2" : "ml-3 space-y-3 border-l border-dvg-gold-light/20 pl-5"}>
              {message.parts.map((part, partIndex) => {
                if (isReasoningUIPart(part)) return null

                if (isTextUIPart(part)) {
                  if (!part.text) return null
                  return isUser ? (
                    <p
                      key={partIndex}
                      className="whitespace-pre-wrap rounded-2xl rounded-tr-md border border-dvg-gold-light/25 bg-gradient-to-br from-dvg-red/30 to-dvg-red-dark/45 px-4 py-3 text-sm leading-6 text-white shadow-[0_12px_34px_rgba(74,9,13,0.20),inset_0_1px_0_rgba(255,255,255,0.07)]"
                    >
                      {part.text}
                    </p>
                  ) : (
                    <AssistantText key={partIndex} text={part.text} />
                  )
                }

                if (isFileUIPart(part)) {
                  if (part.mediaType?.startsWith("image/") && part.url && part.url !== "[adjunto]") {
                    return (
                      // eslint-disable-next-line @next/next/no-img-element -- data URLs del chat
                      <img
                        key={partIndex}
                        src={part.url}
                        alt={language === "es" ? "Imagen adjunta a la conversación" : "Image attached to the conversation"}
                        className="max-h-52 max-w-full rounded-2xl border border-dvg-gold-light/20 bg-black/20 object-contain shadow-xl"
                      />
                    )
                  }
                  return <p key={partIndex} className="text-xs text-white/45">{language === "es" ? "Archivo adjunto" : "Attachment"}</p>
                }

                if (isToolUIPart(part)) {
                  const toolName = part.type.startsWith("tool-") ? part.type.slice(5) : part.type
                  const running = part.state === "input-streaming" || part.state === "input-available"
                  const output = part.state === "output-available" && "output" in part ? (part as { output?: unknown }).output : undefined
                  const event = eventFromToolOutput(output)
                  const detail = summarizeToolOutput(output, language)
                  const mutatesCalendar = toolMutates(toolName)

                  return (
                    <div key={partIndex} className="w-full pt-0.5">
                      <p className={`flex items-center gap-2 text-[11px] font-medium ${mutatesCalendar && !running ? "text-dvg-gold-light/80" : "text-white/40"}`}>
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full border ${running ? "animate-pulse border-dvg-gold-light/25 bg-dvg-gold/15 motion-reduce:animate-none" : mutatesCalendar ? "border-dvg-gold-light/30 bg-dvg-gold/15" : "border-white/10 bg-white/[0.04]"}`}
                          aria-hidden
                        >
                          {running ? <Sparkles className="h-2.5 w-2.5" /> : <CheckCircle2 className="h-2.5 w-2.5" />}
                        </span>
                        {toolLabel(toolName, !running, language)}
                        {running ? "…" : ""}
                      </p>
                      {event ? <EventCard event={event} language={language} /> : null}
                      {!event && detail && mutatesCalendar ? (
                        <p className="mt-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] leading-5 text-white/60">{detail}</p>
                      ) : null}
                    </div>
                  )
                }

                return null
              })}
            </div>
          </article>
        )
      })}

      {busy ? (
        <div className="ml-3 flex items-center gap-3 border-l border-dvg-gold-light/20 py-1 pl-5 text-xs text-white/45" aria-live="polite">
          <span className="flex gap-1" aria-hidden>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-dvg-gold-light [animation-delay:-240ms] motion-reduce:animate-none" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-dvg-gold-light [animation-delay:-120ms] motion-reduce:animate-none" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-dvg-gold-light motion-reduce:animate-none" />
          </span>
          {language === "es" ? "Organizando tu agenda" : "Organizing your calendar"}
        </div>
      ) : null}
    </div>
  )
}
