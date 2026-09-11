'use client'
// Основной вид чата: голосовой ввод, субтитры, настройки, разбор диалога
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bot,
  ClipboardList,
  Loader2,
  Mic,
  Plus,
  Send,
  Settings2,
  Sparkles,
  Volume2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useSpeechRecognition } from '@/hooks/use-speech-recognition'
import { useTtsPlayer } from '@/hooks/use-tts-player'
import { useToast } from '@/hooks/use-toast'
import { getLevel, getVoice } from '@/lib/practice-config'
import {
  aiHeaders,
  appendMessages,
  buildTranscript,
  CONVERSATION_RESUME_KEY,
  createConversation,
  getActiveWords,
  getConversation,
  saveAnalysis,
  updateConversation,
} from '@/lib/local-store'
import type { AnalysisData, ChatMessage, PracticeSettings } from '@/lib/types'
import { SettingsPanel } from './settings-panel'
import { SubtitleBar, type SubtitleMode } from './subtitle-bar'
import { AnalysisView } from './analysis-view'
import { renderWithTargetWords } from './target-words'

interface ChatViewProps {
  settings: PracticeSettings
  onSettingsChange: (s: PracticeSettings) => void
  activeWords: { word: string; translation?: string | null }[]
  onOpenWordsTab: () => void
  onArchiveChanged: () => void
}

export function ChatView({
  settings,
  onSettingsChange,
  activeWords,
  onOpenWordsTab,
  onArchiveChanged,
}: ChatViewProps) {
  const { toast } = useToast()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [convTitle, setConvTitle] = useState('')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [starting, setStarting] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
  const [restored, setRestored] = useState(false)

  const bottomRef = useRef<HTMLDivElement | null>(null)
  const tts = useTtsPlayer()
  // Характер собеседника хранится вне ре-рендеров — уходит в каждый запрос
  const personaRef = useRef('')

  const targetWordStrings = useMemo(() => activeWords.map((w) => w.word), [activeWords])
  const level = getLevel(settings.level)
  const voice = getVoice(settings.voice)

  const userMsgCount = messages.filter((m) => m.role === 'user').length

  // ------- отправка сообщения -------
  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || sending) return
      tts.stop()
      setInput('')
      const tempId = `tmp-${Date.now()}`
      const userMsg: ChatMessage = {
        id: tempId,
        role: 'user',
        content: trimmed,
        createdAt: new Date().toISOString(),
      }
      // История для запроса — до добавления нового сообщения
      const history: { role: 'user' | 'assistant'; content: string }[] = messages
        .slice(-30)
        .map((m) => ({ role: m.role, content: m.content }))
      const isFirstUserMessage = !messages.some((m) => m.role === 'user')
      setMessages((prev) => [...prev, userMsg])
      setSending(true)
      try {
        // Диалог мог быть не начат кнопкой — создаём локально
        let convId = conversationId
        if (!convId) {
          const conv = createConversation({
            level: settings.level,
            vocab: settings.vocab,
            voice: settings.voice,
            speed: settings.speed,
            topicMode: settings.topicMode,
            topic: settings.topic,
          })
          convId = conv.id
          setConversationId(conv.id)
          localStorage.setItem(CONVERSATION_RESUME_KEY, conv.id)
        }

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...aiHeaders() },
          body: JSON.stringify({
            message: trimmed,
            history,
            persona: personaRef.current,
            level: settings.level,
            vocab: settings.vocab,
            topicMode: settings.topicMode,
            topic: settings.topic,
            words: getActiveWords(),
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Ошибка связи с собеседником')

        const assistantMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          createdAt: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, assistantMsg])
        appendMessages(convId, [userMsg, assistantMsg])
        if (isFirstUserMessage) {
          setConvTitle(trimmed.slice(0, 60))
          updateConversation(convId, { title: trimmed.slice(0, 60) })
        }
        if (data.persona) {
          personaRef.current = data.persona
          updateConversation(convId, { persona: data.persona })
        }
        tts
          .speak(assistantMsg.id, data.reply, settings.voice, settings.speed)
          .catch(() => {
            toast({
              title: 'Не удалось озвучить ответ',
              description: 'Текст ответа отображён в чате',
            })
          })
      } catch (e) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
        setInput(trimmed)
        toast({
          title: 'Ошибка',
          description: e instanceof Error ? e.message : 'Попробуйте ещё раз',
          variant: 'destructive',
        })
      } finally {
        setSending(false)
      }
    },
    [conversationId, messages, sending, settings, tts, toast]
  )

  const recognition = useSpeechRecognition({
    lang: 'en-US',
    onFinal: (text) => void send(text),
  })

  // ------- старт нового диалога -------
  const startConversation = useCallback(async () => {
    if (starting || sending) return
    tts.stop()
    setStarting(true)
    try {
      const conv = createConversation({
        level: settings.level,
        vocab: settings.vocab,
        voice: settings.voice,
        speed: settings.speed,
        topicMode: settings.topicMode,
        topic: settings.topic,
      })
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...aiHeaders() },
        body: JSON.stringify({
          start: true,
          level: settings.level,
          vocab: settings.vocab,
          topicMode: settings.topicMode,
          topic: settings.topic,
          words: getActiveWords(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Не удалось начать диалог')
      const greeting: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        createdAt: new Date().toISOString(),
      }
      setMessages([greeting])
      setConversationId(conv.id)
      setConvTitle(conv.title)
      setAnalysis(null)
      personaRef.current = typeof data.persona === 'string' ? data.persona : ''
      updateConversation(conv.id, {
        persona: personaRef.current,
        messages: [greeting],
      })
      localStorage.setItem(CONVERSATION_RESUME_KEY, conv.id)
      tts
        .speak(greeting.id, data.reply, settings.voice, settings.speed)
        .catch(() => {
          toast({ title: 'Не удалось озвучить приветствие', description: data.reply })
        })
    } catch (e) {
      toast({
        title: 'Ошибка',
        description: e instanceof Error ? e.message : 'Попробуйте ещё раз',
        variant: 'destructive',
      })
    } finally {
      setStarting(false)
    }
  }, [sending, starting, settings, tts, toast])

  const resetConversation = () => {
    tts.stop()
    setMessages([])
    setConversationId(null)
    setConvTitle('')
    setAnalysis(null)
    personaRef.current = ''
    localStorage.removeItem(CONVERSATION_RESUME_KEY)
    void startConversation()
  }

  // ------- восстановление диалога -------
  useEffect(() => {
    const saved = localStorage.getItem(CONVERSATION_RESUME_KEY)
    if (!saved) {
      setRestored(true)
      return
    }
    const conv = getConversation(saved)
    if (conv && !conv.endedAt && conv.messages.length > 0) {
      setMessages(conv.messages)
      setConversationId(conv.id)
      setConvTitle(conv.title)
      personaRef.current = conv.persona ?? ''
    } else {
      localStorage.removeItem(CONVERSATION_RESUME_KEY)
    }
    setRestored(true)
  }, [])

  // ------- автоскролл -------
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, sending])

  // ------- разбор диалога -------
  const runAnalysis = async () => {
    if (!conversationId || analyzing) return
    setAnalyzing(true)
    tts.stop()
    try {
      const conv = getConversation(conversationId)
      const transcript = buildTranscript(conv?.messages ?? messages)
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...aiHeaders() },
        body: JSON.stringify({
          transcript,
          level: settings.level,
          targetWords: activeWords.map((w) => w.word),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Не удалось разобрать диалог')
      const result = data.analysis as AnalysisData
      saveAnalysis(conversationId, result)
      setAnalysis(result)
      setAnalysisOpen(true)
      onArchiveChanged()
    } catch (e) {
      toast({
        title: 'Ошибка',
        description: e instanceof Error ? e.message : 'Попробуйте ещё раз',
        variant: 'destructive',
      })
    } finally {
      setAnalyzing(false)
    }
  }

  // ------- субтитры -------
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
  const subtitleMode: SubtitleMode = recognition.listening
    ? 'listening'
    : tts.loadingId
      ? 'ai-loading'
      : tts.speaking
        ? 'ai-speaking'
        : sending
          ? 'thinking'
          : null
  const subtitleText =
    (tts.speakingId || tts.loadingId)
      ? (messages.find((m) => m.id === (tts.speakingId || tts.loadingId))?.content ?? '')
      : ''

  const toggleMic = () => {
    if (recognition.listening) {
      recognition.stop()
    } else {
      tts.stop()
      recognition.start()
    }
  }

  // ------- чат -------
  const emptyState = restored && messages.length === 0 && (
    <div className="flex h-full w-full items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-3xl border bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100">
          <Sparkles className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold">Практикуйте английский голосом</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Говорите с ИИ-собеседником вслух, получайте разбор ошибок после диалога и
          тренируйте свои слова в живой речи. Собеседник говорит человеческим голосом
          с субтитрами.
        </p>
        <ul className="mx-auto mt-4 max-w-sm space-y-1.5 text-left text-sm text-muted-foreground">
          <li>• Собеседник сам предложит тему — или выберите свою в настройках</li>
          <li>• Загрузите выученные слова на вкладке «Слова»</li>
          <li>• Нажмите микрофон и говорите по-английски</li>
        </ul>
        <Button
          size="lg"
          className="mt-6 h-12 rounded-xl bg-emerald-600 px-8 text-base hover:bg-emerald-700"
          onClick={() => void startConversation()}
          disabled={starting}
        >
          {starting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Знакомимся…
            </>
          ) : (
            'Начать разговор'
          )}
        </Button>
        {!recognition.supported && (
          <p className="mt-3 text-xs text-amber-600">
            Голосовой ввод работает в Chrome, Edge и Safari. В этом браузере вы можете
            общаться текстом.
          </p>
        )}
      </div>
    </div>
  )

  const settingsBlock = (
    <SettingsPanel
      settings={settings}
      onChange={onSettingsChange}
      activeWords={activeWords}
      onOpenWordsTab={onOpenWordsTab}
    />
  )

  return (
    <div className="flex h-full min-h-0 gap-4">
      {/* Левая часть: сообщения + ввод */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Шапка чата */}
        <div className="flex items-center gap-2 border-b bg-white/70 px-3 py-2 backdrop-blur sm:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
              <Bot className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Alex</p>
              <p className="truncate text-xs text-muted-foreground">
                {level.label} · {voice.label} · {settings.speed.toFixed(2)}×
              </p>
            </div>
          </div>
          <Badge variant="outline" className="hidden shrink-0 border-emerald-200 bg-emerald-50 text-emerald-800 sm:inline-flex">
            {convTitle || 'Новый диалог'}
          </Badge>

          {/* Мобильная кнопка настроек */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden" aria-label="Настройки">
                <Settings2 className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Настройки практики</SheetTitle>
              </SheetHeader>
              <div className="px-4 pb-6">{settingsBlock}</div>
            </SheetContent>
          </Sheet>

          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={resetConversation}
            title="Начать новый диалог"
          >
            <Plus className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">Новый</span>
          </Button>
        </div>

        {/* Лента сообщений */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
          {emptyState ? (
            emptyState
          ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-3 pb-24">
            {messages.map((m) =>
              m.role === 'assistant' ? (
                <div key={m.id} className="flex items-start gap-2">
                  <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <Bot className="h-4 w-4" />
                  </span>
                  <div className="group max-w-[85%] rounded-2xl rounded-tl-sm border bg-white px-4 py-2.5 shadow-sm">
                    <p className="text-sm leading-relaxed sm:text-[15px]">
                      {renderWithTargetWords(m.content, targetWordStrings)}
                    </p>
                    <div className="mt-1 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-emerald-700"
                        onClick={() =>
                          void tts
                            .speak(m.id, m.content, settings.voice, settings.speed)
                            .catch(() => {})
                        }
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                        Озвучить
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-emerald-600 px-4 py-2.5 text-white shadow-sm">
                    <p className="text-sm leading-relaxed sm:text-[15px]">
                      {renderWithTargetWords(
                        m.content,
                        targetWordStrings,
                        'bg-emerald-500/40 text-white rounded px-0.5 font-semibold'
                      )}
                    </p>
                  </div>
                </div>
              )
            )}
            <div ref={bottomRef} />
          </div>
          )}
        </div>

        {/* Субтитры поверх ленты */}
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 sm:bottom-28">
          <SubtitleBar
            mode={subtitleMode}
            text={subtitleText}
            progress={tts.progress}
            interim={recognition.interim}
            onStopSpeech={() => tts.stop()}
          />
        </div>

        {/* Ввод */}
        <div className="border-t bg-white/80 px-3 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-2xl items-end gap-2">
            <button
              type="button"
              onClick={toggleMic}
              disabled={!recognition.supported || sending || starting}
              title={
                recognition.supported
                  ? recognition.listening
                    ? 'Остановить запись'
                    : 'Записать голос (автоотправка после паузы)'
                  : 'Голосовой ввод поддерживается в Chrome / Edge / Safari'
              }
              aria-label={recognition.listening ? 'Остановить запись' : 'Голосовой ввод'}
              className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                recognition.listening
                  ? 'bg-red-500 text-white shadow-lg shadow-red-200'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              }`}
            >
              {recognition.listening && (
                <span className="absolute inset-0 animate-ping rounded-full bg-red-400/60" />
              )}
              <Mic className="relative h-5 w-5" />
            </button>

            <Textarea
              value={recognition.listening ? recognition.interim || input : input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send(input)
                }
              }}
              placeholder={recognition.listening ? 'Слушаю…' : 'Сообщение…'}
              rows={1}
              className="max-h-32 min-h-12 flex-1 resize-none field-sizing-fixed rounded-xl border-border bg-white focus-visible:ring-emerald-500"
              aria-label="Сообщение"
            />

            {userMsgCount > 0 && conversationId && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-12 shrink-0 rounded-xl border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                    title="Завершить диалог и получить разбор"
                  >
                    {analyzing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <ClipboardList className="mr-1 h-4 w-4" />
                        <span className="hidden sm:inline">Разобрать диалог</span>
                        <span className="sm:hidden">Разбор</span>
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Завершить и разобрать диалог?</AlertDialogTitle>
                    <AlertDialogDescription>
                      ИИ проанализирует вашу речь: ошибки, удачные фразы, использование
                      целевых слов и даст рекомендации. Диалог сохранится в архиве.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Ещё поговорим</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => void runAnalysis()}
                    >
                      Разобрать
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            <Button
              className="h-12 w-12 shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700"
              onClick={() => void send(input)}
              disabled={!input.trim() || sending || recognition.listening}
              aria-label="Отправить"
            >
              {sending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Правая колонка настроек (десктоп) */}
      <aside className="hidden w-80 shrink-0 overflow-y-auto pr-1 lg:block">
        {settingsBlock}
      </aside>

      {/* Диалог разбора */}
      <Dialog open={analysisOpen} onOpenChange={setAnalysisOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-emerald-600" />
              Разбор диалога
            </DialogTitle>
            <DialogDescription>
              Диалог завершён и сохранён в архив вместе с этим разбором.
            </DialogDescription>
          </DialogHeader>
          {analysis && <AnalysisView analysis={analysis} />}
          <div className="flex justify-end gap-2">
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                setAnalysisOpen(false)
                resetConversation()
              }}
            >
              <Plus className="mr-1 h-4 w-4" />
              Новый диалог
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
