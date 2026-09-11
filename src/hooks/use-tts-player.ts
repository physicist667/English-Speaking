'use client'
// Хук проигрывания TTS: кэш аудио, прогресс для субтитров
// Темп регулируется на клиенте через playbackRate с сохранением питча (preservesPitch),
// поэтому голос не искажается ни на медленных, ни на быстрых настройках.
import { useCallback, useEffect, useRef, useState } from 'react'

const CACHE_LIMIT = 60

type PitchPreservingAudio = HTMLAudioElement & {
  preservesPitch?: boolean
  webkitPreservesPitch?: boolean
  mozPreservesPitch?: boolean
}

export function useTtsPlayer() {
  const audioRef = useRef<PitchPreservingAudio | null>(null)
  const cacheRef = useRef<Map<string, string>>(new Map())
  const orderRef = useRef<string[]>([])
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [onDoneRef, setOnDone] = useState<(() => void) | null>(null)
  const onDoneCb = useRef<(() => void) | null>(null)

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      try {
        audioRef.current.currentTime = 0
      } catch {
        /* noop */
      }
    }
    audioRef.current = null
    setSpeakingId(null)
    setLoadingId(null)
    setProgress(0)
  }, [])

  const evictIfNeeded = useCallback(() => {
    while (orderRef.current.length >= CACHE_LIMIT) {
      const oldest = orderRef.current.shift()
      if (oldest) {
        const url = cacheRef.current.get(oldest)
        if (url) URL.revokeObjectURL(url)
        cacheRef.current.delete(oldest)
      }
    }
  }, [])

  const speak = useCallback(
    async (
      id: string,
      text: string,
      voice: string,
      speed: number,
      onDone?: () => void
    ) => {
      if (!text.trim()) return
      onDoneCb.current = onDone ?? null
      setOnDone(null)

      // Прервать предыдущее воспроизведение
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }

      // Кэш не зависит от скорости: темп применяется на этапе воспроизведения
      const key = `${voice}:${text}`
      let url = cacheRef.current.get(key)
      if (!url) {
        setLoadingId(id)
        setSpeakingId(id)
        try {
          const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voice }),
          })
          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            throw new Error(data.error || 'Не удалось озвучить ответ')
          }
          const blob = await res.blob()
          url = URL.createObjectURL(blob)
          evictIfNeeded()
          cacheRef.current.set(key, url)
          orderRef.current.push(key)
        } catch (e) {
          setLoadingId(null)
          setSpeakingId(null)
          throw e
        }
      }

      setLoadingId(null)
      setProgress(0)
      const audio = new Audio(url) as PitchPreservingAudio
      // Темп без роботизации: playbackRate с сохранением высоты голоса
      const rate = Number.isFinite(speed) ? Math.min(2, Math.max(0.5, speed)) : 1
      audio.playbackRate = rate
      if (audio.preservesPitch !== undefined) audio.preservesPitch = true
      if (audio.webkitPreservesPitch !== undefined) audio.webkitPreservesPitch = true
      if (audio.mozPreservesPitch !== undefined) audio.mozPreservesPitch = true
      audioRef.current = audio
      audio.ontimeupdate = () => {
        if (audio.duration && Number.isFinite(audio.duration)) {
          setProgress(Math.min(1, audio.currentTime / audio.duration))
        }
      }
      audio.onended = () => {
        setSpeakingId(null)
        setProgress(0)
        audioRef.current = null
        onDoneCb.current?.()
      }
      setSpeakingId(id)
      try {
        await audio.play()
      } catch {
        setSpeakingId(null)
      }
    },
    [evictIfNeeded]
  )

  useEffect(
    () => () => {
      audioRef.current?.pause()
    },
    []
  )

  return {
    speak,
    stop,
    speakingId,
    loadingId,
    speaking: speakingId !== null,
    progress,
  }
}
