'use client'
// Субтитры: как в видео — тёмная плашка с караоке-подсветкой слов,
// плюс статусы «слушаю» и «собеседник думает»
import { Mic, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type SubtitleMode = 'ai-speaking' | 'ai-loading' | 'listening' | 'thinking' | null

interface SubtitleBarProps {
  mode: SubtitleMode
  text: string
  progress: number
  interim: string
  onStopSpeech: () => void
}

function AiSubtitle({ text, progress }: { text: string; progress: number }) {
  const tokens = text.split(/(\s+)/)
  const items = tokens.reduce<{ text: string; idx: number | null }[]>((acc, tok) => {
    if (tok.trim()) {
      acc.push({ text: tok, idx: acc.filter((a) => a.idx !== null).length })
    } else {
      acc.push({ text: tok, idx: null })
    }
    return acc
  }, [])
  const wordsTotal = items.filter((it) => it.idx !== null).length
  const currentWordIndex = Math.floor(progress * wordsTotal)

  return (
    <p className="text-center text-base leading-relaxed sm:text-lg">
      {items.map((it, i) => {
        if (it.idx === null) return <span key={i}>{it.text}</span>
        const isPast = it.idx < currentWordIndex
        const isCurrent = it.idx === currentWordIndex
        return (
          <span
            key={i}
            className={
              isCurrent
                ? 'text-emerald-300 font-semibold'
                : isPast
                  ? 'text-white'
                  : 'text-white/50'
            }
          >
            {it.text}
          </span>
        )
      })}
    </p>
  )
}

export function SubtitleBar({
  mode,
  text,
  progress,
  interim,
  onStopSpeech,
}: SubtitleBarProps) {
  if (!mode) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center px-2 pb-2 sm:px-4 sm:pb-3">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex max-w-2xl items-center gap-3 rounded-2xl bg-neutral-900/95 px-4 py-3 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-neutral-900/90"
      >
        {mode === 'ai-speaking' && (
          <>
            <div className="flex h-5 items-end gap-0.5" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1 animate-pulse rounded-full bg-emerald-400"
                  style={{
                    height: `${8 + i * 5}px`,
                    animationDelay: `${i * 150}ms`,
                    animationDuration: '700ms',
                  }}
                />
              ))}
            </div>
            <div className="max-h-28 overflow-y-auto min-w-0 flex-1">
              <AiSubtitle text={text} progress={progress} />
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={onStopSpeech}
              title="Остановить озвучку"
              aria-label="Остановить озвучку"
            >
              <Square className="h-3.5 w-3.5" />
            </Button>
          </>
        )}

        {mode === 'ai-loading' && (
          <div className="flex items-center gap-3 py-1">
            <div className="flex gap-1" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 animate-bounce rounded-full bg-emerald-400"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </div>
            <span className="text-sm text-white/80">Готовим голос собеседника…</span>
          </div>
        )}

        {mode === 'thinking' && (
          <div className="flex items-center gap-3 py-1">
            <div className="flex gap-1" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 animate-bounce rounded-full bg-white/70"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </div>
            <span className="text-sm text-white/80">Собеседник думает…</span>
          </div>
        )}

        {mode === 'listening' && (
          <div className="flex min-w-0 items-center gap-3 py-1">
            <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-red-300">
              <Mic className="h-4 w-4" />
              Слушаю…
            </span>
            <span className="min-w-0 flex-1 truncate text-sm italic text-white/90">
              {interim || 'Говорите…'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
