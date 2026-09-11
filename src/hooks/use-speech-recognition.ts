'use client'
// Хук голосового ввода на Web Speech API (бесплатно, работает в Chrome/Edge/Safari)
import { useCallback, useEffect, useRef, useState } from 'react'

interface SpeechRecognitionResultLike {
  0: { transcript: string }
  isFinal: boolean
}

interface SpeechRecognitionEventLike {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: { error?: string }) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

export function useSpeechRecognition(opts: {
  lang?: string
  onFinal?: (text: string) => void
}) {
  const [supported, setSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const onFinalRef = useRef(opts.onFinal)
  const langRef = useRef(opts.lang ?? 'en-US')

  useEffect(() => {
    onFinalRef.current = opts.onFinal
  }, [opts.onFinal])

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>
    const SR = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
      | (new () => SpeechRecognitionLike)
      | undefined
    const id = setTimeout(() => setSupported(Boolean(SR)), 0)
    return () => {
      clearTimeout(id)
      try {
        recognitionRef.current?.abort()
      } catch {
        /* noop */
      }
    }
  }, [])

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop()
    } catch {
      /* noop */
    }
  }, [])

  const start = useCallback(() => {
    const w = window as unknown as Record<string, unknown>
    const SR = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
      | (new () => SpeechRecognitionLike)
      | undefined
    if (!SR) return
    try {
      recognitionRef.current?.abort()
    } catch {
      /* noop */
    }
    const rec = new SR()
    rec.lang = langRef.current
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 1
    rec.onstart = () => setListening(true)
    rec.onresult = (e) => {
      let interimText = ''
      let finalText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) finalText += res[0].transcript
        else interimText += res[0].transcript
      }
      if (interimText) setInterim(interimText)
      if (finalText.trim()) {
        setInterim('')
        onFinalRef.current?.(finalText.trim())
      }
    }
    rec.onerror = () => {
      setListening(false)
      setInterim('')
    }
    rec.onend = () => {
      setListening(false)
      setInterim('')
    }
    recognitionRef.current = rec
    rec.start()
  }, [])

  return { supported, listening, interim, start, stop }
}
