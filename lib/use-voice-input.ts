"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export type VoiceInputState = "idle" | "recording" | "transcribing" | "error"

export type UseVoiceInputResult = {
  state: VoiceInputState
  isSupported: boolean
  start: () => Promise<void>
  stop: () => Promise<string | null>
  error: string | null
  reset: () => void
}

type Options = {
  locale?: "es" | "en"
  onTranscript?: (text: string) => void
}

/**
 * Captura audio del micrófono con MediaRecorder y lo envía a `/api/transcribe`.
 * Pensado para "push to talk" desde el chat de la app web.
 */
export function useVoiceInput({ locale = "es", onTranscript }: Options = {}): UseVoiceInputResult {
  const [state, setState] = useState<VoiceInputState>("idle")
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const isSupported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof window.MediaRecorder !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    recorderRef.current = null
    chunksRef.current = []
  }, [])

  useEffect(() => () => cleanupStream(), [cleanupStream])

  const start = useCallback(async () => {
    if (!isSupported) {
      setError("Grabación no soportada en este navegador")
      setState("error")
      return
    }
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickSupportedMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorderRef.current = recorder
      recorder.start(250)
      setState("recording")
    } catch (err) {
      cleanupStream()
      setError(err instanceof Error ? err.message : String(err))
      setState("error")
    }
  }, [cleanupStream, isSupported])

  const stop = useCallback(async (): Promise<string | null> => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === "inactive") {
      cleanupStream()
      setState("idle")
      return null
    }
    setState("transcribing")
    const blob: Blob = await new Promise((resolve) => {
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm"
        resolve(new Blob(chunksRef.current, { type }))
      }
      try {
        recorder.stop()
      } catch {
        resolve(new Blob(chunksRef.current, { type: "audio/webm" }))
      }
    })
    cleanupStream()

    if (blob.size === 0) {
      setState("idle")
      return null
    }

    try {
      const fd = new FormData()
      const ext = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "mp4" : "webm"
      fd.append("file", blob, `voice.${ext}`)
      fd.append("locale", locale)
      const res = await fetch("/api/transcribe", { method: "POST", body: fd })
      if (!res.ok) {
        const t = await res.text().catch(() => "")
        throw new Error(t || `HTTP ${res.status}`)
      }
      const data = (await res.json()) as { text?: string }
      const text = (data.text ?? "").trim()
      setState("idle")
      if (text && onTranscript) onTranscript(text)
      return text || null
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setState("error")
      return null
    }
  }, [cleanupStream, locale, onTranscript])

  const reset = useCallback(() => {
    cleanupStream()
    setError(null)
    setState("idle")
  }, [cleanupStream])

  return { state, isSupported, start, stop, error, reset }
}

function pickSupportedMimeType(): string | undefined {
  if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined") return undefined
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ]
  for (const m of candidates) {
    try {
      if (window.MediaRecorder.isTypeSupported(m)) return m
    } catch {
      // ignore
    }
  }
  return undefined
}
