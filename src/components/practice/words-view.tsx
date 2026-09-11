'use client'
// Управление словами: загрузка файлом, вставка текста, списки
import { useRef, useState } from 'react'
import {
  BookMarked,
  FileUp,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
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
import { addWordList, deleteWordList, toggleWordList } from '@/lib/local-store'
import type { WordListItem } from '@/lib/types'

interface WordsViewProps {
  lists: WordListItem[]
  onReload: () => void
}

export function WordsView({ lists, onReload }: WordsViewProps) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [fileName, setFileName] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const activeWordsCount = lists
    .filter((l) => l.active)
    .reduce((acc, l) => acc + l.words.length, 0)

  const handleFile = async (file: File) => {
    const text = await file.text()
    setContent(text)
    setFileName(file.name)
    if (!name) setName(file.name.replace(/\.[^.]+$/, '').slice(0, 60))
    toast({
      title: 'Файл загружен',
      description: `${file.name} · проверьте предпросмотр и сохраните`,
    })
  }

  const save = async () => {
    if (saving) return
    const trimmedContent = content.trim()
    if (!trimmedContent) {
      toast({
        title: 'Пусто',
        description: 'Загрузите файл или вставьте слова в поле',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      const added = addWordList(name || fileName || 'Мой список', trimmedContent)
      if (added === 0) {
        throw new Error('Не удалось распознать ни одного слова. Проверьте формат: word - перевод')
      }
      toast({
        title: 'Список добавлен',
        description: `Распознано слов: ${added}. Собеседник уже может их использовать.`,
      })
      setContent('')
      setName('')
      setFileName('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      onReload()
    } catch (e) {
      toast({
        title: 'Ошибка',
        description: e instanceof Error ? e.message : 'Попробуйте ещё раз',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const toggleList = async (list: WordListItem, active: boolean) => {
    toggleWordList(list.id, active)
    onReload()
  }

  const deleteList = async (id: string) => {
    deleteWordList(id)
    toast({ title: 'Список удалён' })
    onReload()
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
      {/* Загрузка */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileUp className="h-5 w-5 text-emerald-600" />
            Загрузить слова
          </CardTitle>
          <CardDescription>
            Файл (.txt / .csv) или вставка текстом. По одному слову на строку, можно с
            переводом: <code className="rounded bg-muted px-1">apple - яблоко</code>,{' '}
            <code className="rounded bg-muted px-1">get along: ладить</code>,{' '}
            <code className="rounded bg-muted px-1">resilient (стойкий)</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название списка (необязательно)"
              className="flex-1"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv,text/plain,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleFile(f)
              }}
            />
            <Button
              variant="outline"
              className="shrink-0"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="mr-1 h-4 w-4" />
              Выбрать файл
            </Button>
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={'word - перевод, по одному на строку:\nresilient - стойкий\nfigure out - разобраться\ncome up with - придумать'}
            rows={6}
            className="font-mono text-sm"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {fileName && `Файл: ${fileName}. `}
              Активные слова подсвечиваются в чате и используются собеседником.
            </p>
            <Button
              className="shrink-0 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => void save()}
              disabled={saving || !content.trim()}
            >
              {saving ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-1 h-4 w-4" />
              )}
              Добавить список
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Статус */}
      <div className="flex items-center gap-2 rounded-xl border bg-emerald-50/60 px-4 py-3 text-sm">
        <BookMarked className="h-4 w-4 shrink-0 text-emerald-600" />
        <span>
          Сейчас собеседник использует{' '}
          <b className="text-emerald-700">{activeWordsCount}</b> активных слов из{' '}
          {lists.reduce((acc, l) => acc + l.words.length, 0)} загруженных
        </span>
      </div>

      {/* Списки */}
      {lists.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Пока нет ни одного списка. Загрузите файл со словами — и они появятся в
          разговоре.
        </div>
      ) : (
        lists.map((list) => (
          <Card key={list.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex min-w-0 items-center gap-2">
                <CardTitle className="truncate text-base">{list.name}</CardTitle>
                <Badge variant="secondary">{list.words.length}</Badge>
                {!list.active && <Badge variant="outline">выключен</Badge>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Switch
                  checked={list.active}
                  onCheckedChange={(v) => void toggleList(list, v)}
                  aria-label={`Включить список ${list.name}`}
                />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-600"
                      aria-label={`Удалить список ${list.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Удалить список?</AlertDialogTitle>
                      <AlertDialogDescription>
                        «{list.name}» и все его слова ({list.words.length}) будут удалены
                        безвозвратно.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Отмена</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700"
                        onClick={() => void deleteList(list.id)}
                      >
                        Удалить
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                {list.words.map((w) => (
                  <Badge
                    key={w.id}
                    variant="outline"
                    className={list.active ? 'border-emerald-200 bg-emerald-50' : ''}
                    title={w.translation ?? undefined}
                  >
                    {w.word}
                    {w.translation && (
                      <span className="ml-1 font-normal text-muted-foreground">
                        {w.translation}
                      </span>
                    )}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
