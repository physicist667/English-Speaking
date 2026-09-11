'use client'
// TalkPal — разговорная практика английского с ИИ-собеседником
import { useCallback, useEffect, useState } from 'react'
import { MessagesSquare } from 'lucide-react'
import { ChatView } from '@/components/practice/chat-view'
import { WordsView } from '@/components/practice/words-view'
import { ArchiveView } from '@/components/practice/archive-view'
import type { PracticeSettings, WordListItem } from '@/lib/types'
import { listWordLists } from '@/lib/local-store'

type Tab = 'chat' | 'words' | 'archive'

const SETTINGS_KEY = 'talkpal-settings'

const DEFAULT_SETTINGS: PracticeSettings = {
  level: 'casual',
  vocab: 'intermediate',
  voice: 'ava',
  speed: 1.0,
  topicMode: 'ai',
  topic: '',
}

export default function Home() {
  const [tab, setTab] = useState<Tab>('chat')
  const [settings, setSettings] = useState<PracticeSettings>(DEFAULT_SETTINGS)
  const [words, setWords] = useState<WordListItem[]>([])
  const [archiveToken, setArchiveToken] = useState(0)
  const [mounted, setMounted] = useState(false)

  // Настройки из localStorage
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const raw = localStorage.getItem(SETTINGS_KEY)
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<PracticeSettings>
          if (parsed.level && parsed.voice && typeof parsed.speed === 'number') {
            // Мержим с дефолтами, чтобы новые поля (topicMode, topic) имели значения
            setSettings({ ...DEFAULT_SETTINGS, ...parsed })
          }
        }
      } catch {
        /* ignore */
      }
      setMounted(true)
    }, 0)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    if (!mounted) return
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      /* ignore */
    }
  }, [settings, mounted])

  const loadWords = useCallback(() => {
    try {
      setWords(listWordLists())
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const id = setTimeout(() => loadWords(), 0)
    return () => clearTimeout(id)
  }, [loadWords])

  const activeWords = words
    .filter((l) => l.active)
    .flatMap((l) => l.words.map((w) => ({ word: w.word, translation: w.translation })))

  const tabs: { id: Tab; label: string }[] = [
    { id: 'chat', label: 'Разговор' },
    { id: 'words', label: 'Слова' },
    { id: 'archive', label: 'Архив' },
  ]

  return (
    <div
      className="flex flex-col bg-stone-50 text-foreground"
      style={{ height: '100dvh' }}
    >
      <header className="z-30 shrink-0 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <MessagesSquare className="h-5 w-5" />
            </span>
            <div className="hidden min-w-0 sm:block">
              <p className="text-sm font-bold leading-tight">TalkPal</p>
              <p className="text-[11px] leading-tight text-muted-foreground">
                разговорная практика английского
              </p>
            </div>
          </div>

          <nav
            aria-label="Разделы приложения"
            className="flex rounded-xl bg-stone-100 p-1"
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? 'page' : undefined}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors sm:px-4 ${
                  tab === t.id
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        {tab === 'chat' && (
          <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 px-0 lg:px-4">
            <ChatView
              settings={settings}
              onSettingsChange={setSettings}
              activeWords={activeWords}
              onOpenWordsTab={() => setTab('words')}
              onArchiveChanged={() => setArchiveToken((t) => t + 1)}
            />
          </div>
        )}

        {tab === 'words' && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <WordsView lists={words} onReload={loadWords} />
          </div>
        )}

        {tab === 'archive' && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ArchiveView reloadToken={archiveToken} />
          </div>
        )}
      </main>
    </div>
  )
}
