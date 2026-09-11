'use client'
// Архив диалогов: расшифровки + разборы
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Archive,
  Bot,
  ClipboardList,
  Download,
  Loader2,
  MessageSquareText,
  Trash2,
  Upload,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
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
import { useToast } from '@/hooks/use-toast'
import { getLevel } from '@/lib/practice-config'
import {
  aiHeaders,
  buildTranscript,
  deleteConversation,
  exportAll,
  getConversation,
  importAll,
  listConversations,
  saveAnalysis,
} from '@/lib/local-store'
import type { AnalysisData, ConversationDetail, ConversationListItem } from '@/lib/types'
import { AnalysisView } from './analysis-view'
import { renderWithTargetWords } from './target-words'

interface ArchiveViewProps {
  reloadToken: number
}

export function ArchiveView({ reloadToken }: ArchiveViewProps) {
  const { toast } = useToast()
  const [items, setItems] = useState<ConversationListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<ConversationDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(listConversations())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, reloadToken])

  const openDetail = async (id: string) => {
    setDetailLoading(true)
    try {
      const conv = getConversation(id)
      if (!conv) throw new Error('Диалог не найден')
      setDetail(conv)
    } catch (e) {
      toast({
        title: 'Ошибка',
        description: e instanceof Error ? e.message : 'Не удалось открыть диалог',
        variant: 'destructive',
      })
    } finally {
      setDetailLoading(false)
    }
  }

  const deleteConversationLocal = async (id: string) => {
    deleteConversation(id)
    setItems((prev) => prev.filter((i) => i.id !== id))
    if (detail?.id === id) setDetail(null)
    toast({ title: 'Диалог удалён' })
  }

  const analyzeConversation = async (id: string, level?: string) => {
    setAnalyzingId(id)
    try {
      const conv = getConversation(id)
      if (!conv) throw new Error('Диалог не найден')
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...aiHeaders() },
        body: JSON.stringify({
          transcript: buildTranscript(conv.messages),
          level: level ?? conv.level,
          targetWords: (conv.analysis?.targetWords ?? []).map((w) => w.word).filter(Boolean),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Не удалось разобрать диалог')
      const analysis = data.analysis as AnalysisData
      saveAnalysis(id, analysis)
      await openDetail(id)
      setItems(
        listConversations()
      )
    } catch (e) {
      toast({
        title: 'Ошибка',
        description: e instanceof Error ? e.message : 'Попробуйте ещё раз',
        variant: 'destructive',
      })
    } finally {
      setAnalyzingId(null)
    }
  }

  const exportBackup = () => {
    const data = exportAll()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `talkpal-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast({ title: 'Резервная копия сохранена' })
  }

  const importBackup = async (file: File) => {
    try {
      const text = await file.text()
      const result = importAll(JSON.parse(text))
      toast({
        title: 'Импорт завершён',
        description: `Диалогов: ${result.conversations}, списков слов: ${result.words}`,
      })
      await load()
    } catch (e) {
      toast({
        title: 'Ошибка импорта',
        description: e instanceof Error ? e.message : 'Попробуйте ещё раз',
        variant: 'destructive',
      })
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Archive className="h-5 w-5 text-emerald-600" />
        <h2 className="text-lg font-bold">Архив диалогов</h2>
        <Badge variant="secondary">{items.length}</Badge>
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={exportBackup} disabled={items.length === 0}>
            <Download className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">Экспорт</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => importInputRef.current?.click()}>
            <Upload className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">Импорт</span>
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importBackup(f)
              e.target.value = ''
            }}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Диалоги хранятся в этом браузере — периодически сохраняйте резервную копию
        кнопкой «Экспорт», чтобы не потерять историю при очистке данных.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Здесь появятся ваши диалоги с расшифровками и разборами ошибок.
        </div>
      ) : (
        items.map((item) => (
          <Card key={item.id} className="transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <MessageSquareText className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{item.title}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{formatDate(item.createdAt)}</span>
                  <span>·</span>
                  <span>{getLevel(item.level).label}</span>
                  <span>·</span>
                  <span>{item.messageCount} сообщений</span>
                  {item.hasAnalysis && (
                    <>
                      <span>·</span>
                      <span className="font-medium text-emerald-700">разобран</span>
                    </>
                  )}
                  {!item.endedAt && (
                    <>
                      <span>·</span>
                      <span className="font-medium text-amber-600">активен</span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {item.messageCount > 0 && !item.hasAnalysis && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void analyzeConversation(item.id)}
                    disabled={analyzingId === item.id}
                  >
                    {analyzingId === item.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ClipboardList className="h-4 w-4" />
                    )}
                    <span className="ml-1 hidden sm:inline">Разобрать</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void openDetail(item.id)}
                  disabled={detailLoading}
                >
                  Открыть
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-600"
                      aria-label="Удалить диалог"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Удалить диалог?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Расшифровка и разбор диалога «{item.title}» будут удалены
                        безвозвратно.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Отмена</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700"
                        onClick={() => void deleteConversationLocal(item.id)}
                      >
                        Удалить
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* Просмотр диалога */}
      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-6">{detail.title}</DialogTitle>
                <DialogDescription>
                  {formatDate(detail.createdAt)} · {getLevel(detail.level).label} ·{' '}
                  {detail.messages.length} сообщений
                </DialogDescription>
              </DialogHeader>

              {/* Расшифровка */}
              <div className="flex flex-col gap-2.5 rounded-xl border bg-neutral-50/60 p-3">
                {detail.messages.map((m) => (
                  <div key={m.id} className="flex items-start gap-2">
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                        m.role === 'assistant'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-neutral-200 text-neutral-700'
                      }`}
                    >
                      {m.role === 'assistant' ? (
                        <Bot className="h-3.5 w-3.5" />
                      ) : (
                        <User className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <p className="text-sm leading-relaxed">
                      <span className="mr-1.5 font-semibold">
                        {m.role === 'assistant' ? 'Alex:' : 'Вы:'}
                      </span>
                      {m.role === 'assistant' ? (
                        renderWithTargetWords(
                          m.content,
                          detail.messages.filter((x) => x.role === 'user').length
                            ? allWordsFrom(detail)
                            : []
                        )
                      ) : (
                        <span className="text-neutral-700">{m.content}</span>
                      )}
                    </p>
                  </div>
                ))}
              </div>

              {/* Разбор */}
              {detail.analysis ? (
                <div className="mt-2">
                  <h3 className="mb-2 flex items-center gap-2 text-base font-bold">
                    <ClipboardList className="h-4 w-4 text-emerald-600" />
                    Разбор диалога
                  </h3>
                  <AnalysisView analysis={detail.analysis as AnalysisData} />
                </div>
              ) : (
                <div className="mt-2 flex items-center justify-between rounded-xl border border-dashed p-4">
                  <p className="text-sm text-muted-foreground">
                    Разбора пока нет
                  </p>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => void analyzeConversation(detail.id)}
                    disabled={analyzingId === detail.id}
                  >
                    {analyzingId === detail.id && (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    )}
                    Разобрать сейчас
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Собрать уникальные слова из разбора/сообщений для подсветки в архиве */
function allWordsFrom(conv: ConversationDetail): string[] {
  if (conv.analysis?.targetWords?.length) {
    return conv.analysis.targetWords
      .map((w) => w.word)
      .filter((w): w is string => Boolean(w))
  }
  return []
}
