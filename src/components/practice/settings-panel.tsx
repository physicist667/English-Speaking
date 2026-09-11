'use client'
// Панель настроек: подключение ИИ, сложность, голос, скорость, слова для практики
import { useEffect, useState } from 'react'
import {
  Volume2,
  Zap,
  Check,
  BookMarked,
  ExternalLink,
  KeyRound,
  Lightbulb,
  GraduationCap,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { LEVELS, VOCAB_LEVELS, VOICES, getLevel, getVocabLevel, getVoice, SPEED_MAX, SPEED_MIN } from '@/lib/practice-config'
import { aiHeaders, clearAiConfig, getAiConfig, saveAiConfig } from '@/lib/local-store'
import type { AiProviderId, PracticeSettings } from '@/lib/types'

const AI_PROVIDERS: {
  id: AiProviderId
  label: string
  keyUrl: string
  hint: string
}[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    keyUrl: 'https://aistudio.google.com/apikey',
    hint: 'Бесплатный ключ за минуту — рекомендуемый вариант',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    keyUrl: 'https://openrouter.ai/keys',
    hint: 'Бесплатные модели с пометкой :free',
  },
  {
    id: 'groq',
    label: 'Groq',
    keyUrl: 'https://console.groq.com/keys',
    hint: 'Быстрый бесплатный тариф',
  },
  {
    id: 'openai',
    label: 'OpenAI-совместимый',
    keyUrl: 'https://platform.openai.com/api-keys',
    hint: 'Платный OpenAI или любой совместимый сервис',
  },
]

/** Карточка подключения ИИ: пользователь вставляет свой бесплатный ключ,
 * он хранится в localStorage браузера и уходит в заголовках к API сервера */
function AiConnectionCard() {
  const { toast } = useToast()
  const [provider, setProvider] = useState<AiProviderId>('gemini')
  const [key, setKey] = useState('')
  const [model, setModel] = useState('')
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    const cfg = getAiConfig()
    if (cfg) {
      setProvider(cfg.provider)
      setKey(cfg.key)
      setModel(cfg.model ?? '')
      setSaved(true)
    }
  }, [])

  const current = AI_PROVIDERS.find((p) => p.id === provider)!

  const handleSave = () => {
    if (!key.trim()) {
      toast({ title: 'Вставьте ключ', variant: 'destructive' })
      return
    }
    saveAiConfig({ provider, key: key.trim(), model: model.trim() || undefined })
    setSaved(true)
    setTestResult(null)
    toast({ title: 'Ключ сохранён', description: 'Хранится только в этом браузере' })
  }

  const handleTest = async () => {
    if (testing) return
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/ai-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...aiHeaders() },
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setTestResult({ ok: true, message: 'ИИ подключён и отвечает' })
      } else {
        setTestResult({ ok: false, message: data.error || 'Не удалось подключиться' })
      }
    } catch {
      setTestResult({ ok: false, message: 'Сервер недоступен' })
    } finally {
      setTesting(false)
    }
  }

  const handleClear = () => {
    clearAiConfig()
    setKey('')
    setModel('')
    setSaved(false)
    setTestResult(null)
    toast({ title: 'Ключ удалён из этого браузера' })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 text-emerald-600" />
          Подключение ИИ
          {saved && (
            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700" variant="outline">
              ключ сохранён
            </Badge>
          )}
        </CardTitle>
        <p className="text-xs leading-snug text-muted-foreground">
          Нужно один раз: получите бесплатный ключ по ссылке и вставьте сюда. Без
          этого собеседник не сможет отвечать на вашем хостинге.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5">
        <Select value={provider} onValueChange={(v) => setProvider(v as AiProviderId)}>
          <SelectTrigger aria-label="Провайдер ИИ">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AI_PROVIDERS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="-mt-1 text-xs text-muted-foreground">{current.hint}</p>

        <Input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          type="password"
          placeholder="Вставьте API-ключ"
          autoComplete="off"
          aria-label="API-ключ"
        />
        <Input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="Модель (необязательно, по умолчанию подойдёт)"
          aria-label="Модель"
          className="font-mono text-xs"
        />

        <a
          href={current.keyUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
        >
          Получить бесплатный ключ ({current.label})
          <ExternalLink className="h-3 w-3" />
        </a>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            onClick={handleSave}
            disabled={!key.trim()}
          >
            Сохранить
          </Button>
          <Button size="sm" variant="outline" onClick={() => void handleTest()} disabled={testing || !key.trim()}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Проверить'}
          </Button>
          {saved && (
            <Button size="sm" variant="ghost" onClick={handleClear} title="Удалить ключ">
              Удалить
            </Button>
          )}
        </div>

        {testResult && (
          <p
            className={`flex items-start gap-1.5 text-xs leading-snug ${
              testResult.ok ? 'text-emerald-700' : 'text-red-600'
            }`}
          >
            {testResult.ok ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}
            {testResult.message}
          </p>
        )}
        <p className="text-[11px] leading-snug text-muted-foreground">
          Ключ хранится только в этом браузере (localStorage) и передаётся лишь на
          ваш собственный сервер приложения. Не публикуйте ссылку на приложение
          открыто — кто угодно сможет тратить ваш лимит через него.
        </p>
      </CardContent>
    </Card>
  )
}

interface SettingsPanelProps {
  settings: PracticeSettings
  onChange: (next: PracticeSettings) => void
  activeWords: { word: string; translation?: string | null }[]
  onOpenWordsTab: () => void
}

export function SettingsPanel({
  settings,
  onChange,
  activeWords,
  onOpenWordsTab,
}: SettingsPanelProps) {
  const level = getLevel(settings.level)
  const voice = getVoice(settings.voice)

  const setLevel = (id: string) => {
    const nextLevel = getLevel(id)
    onChange({ ...settings, level: id, speed: nextLevel.ttsSpeed })
  }

  return (
    <div className="flex flex-col gap-4">
      <AiConnectionCard />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-emerald-600" />
            Сложность речи
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Характер речи и темп собеседника — не словарный запас
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {LEVELS.map((l) => {
            const active = l.id === settings.level
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => setLevel(l.id)}
                aria-pressed={active}
                className={`w-full rounded-xl border p-3 text-left transition-all hover:border-emerald-400 hover:bg-emerald-50/60 ${
                  active
                    ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                    : 'border-border bg-white'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{l.label}</span>
                  {active && <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
                </span>
                <span className="mt-1 block text-xs leading-snug text-muted-foreground">
                  {l.description}
                </span>
              </button>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="h-4 w-4 text-emerald-600" />
            Тема разговора
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...settings, topicMode: 'ai' })}
              aria-pressed={settings.topicMode === 'ai'}
              className={`rounded-xl border p-3 text-left transition-all hover:border-emerald-400 hover:bg-emerald-50/60 ${
                settings.topicMode === 'ai'
                  ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                  : 'border-border bg-white'
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">Предлагает ИИ</span>
                {settings.topicMode === 'ai' && (
                  <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                )}
              </span>
              <span className="mt-1 block text-xs leading-snug text-muted-foreground">
                Собеседник сам предложит 2-3 интересные темы
              </span>
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...settings, topicMode: 'user' })}
              aria-pressed={settings.topicMode === 'user'}
              className={`rounded-xl border p-3 text-left transition-all hover:border-emerald-400 hover:bg-emerald-50/60 ${
                settings.topicMode === 'user'
                  ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                  : 'border-border bg-white'
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">Выбираю я</span>
                {settings.topicMode === 'user' && (
                  <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                )}
              </span>
              <span className="mt-1 block text-xs leading-snug text-muted-foreground">
                Укажите свою тему — собеседник будет её развивать
              </span>
            </button>
          </div>
          {settings.topicMode === 'user' && (
            <Input
              value={settings.topic}
              onChange={(e) => onChange({ ...settings, topic: e.target.value })}
              placeholder="Например: путешествия, собеседование, кино…"
              aria-label="Тема разговора"
              className="mt-1 rounded-xl focus-visible:ring-emerald-500"
              maxLength={200}
            />
          )}
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            {settings.topicMode === 'ai'
              ? 'Каждый новый диалог собеседник предложит свежие темы — можно согласиться или назвать свою прямо в разговоре.'
              : 'Без темы диалог начнётся с лёгкой светской беседы, а собеседник подхватит любое ваше сообщение.'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-4 w-4 text-emerald-600" />
            Словарный запас
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Какими словами говорит собеседник — от простых до богатых
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-2">
          {VOCAB_LEVELS.map((v) => {
            const active = v.id === settings.vocab
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onChange({ ...settings, vocab: v.id })}
                aria-pressed={active}
                className={`w-full rounded-xl border p-3 text-left transition-all hover:border-emerald-400 hover:bg-emerald-50/60 ${
                  active
                    ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                    : 'border-border bg-white'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{v.label}</span>
                  {active && <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
                </span>
                <span className="mt-1 block text-xs leading-snug text-muted-foreground">
                  {v.description}
                </span>
              </button>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Volume2 className="h-4 w-4 text-emerald-600" />
            Голос и темп
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Select
            value={settings.voice}
            onValueChange={(v) => onChange({ ...settings, voice: v })}
          >
            <SelectTrigger aria-label="Голос собеседника">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VOICES.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.label}
                  <span className="ml-2 text-xs text-muted-foreground">{v.hint}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="-mt-2 text-xs text-muted-foreground">
            {voice.hint} · живой человеческий голос
          </p>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Скорость речи</span>
              <Badge variant="secondary" className="font-mono">
                {settings.speed.toFixed(2)}×
              </Badge>
            </div>
            <Slider
              value={[settings.speed]}
              min={SPEED_MIN}
              max={SPEED_MAX}
              step={0.05}
              onValueChange={([v]) => onChange({ ...settings, speed: v })}
              aria-label="Скорость речи"
            />
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>медленнее</span>
              <span>уровень: {level.ttsSpeed.toFixed(2)}×</span>
              <span>быстрее</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookMarked className="h-4 w-4 text-emerald-600" />
            Слова для практики
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeWords.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Загрузите выученные слова — собеседник начнёт использовать их в разговоре.
            </p>
          ) : (
            <div className="mb-3 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
              {activeWords.slice(0, 24).map((w) => (
                <Badge
                  key={w.word}
                  variant="outline"
                  className="border-emerald-200 bg-emerald-50 text-emerald-800"
                  title={w.translation ?? undefined}
                >
                  {w.word}
                </Badge>
              ))}
              {activeWords.length > 24 && (
                <Badge variant="secondary">+{activeWords.length - 24}</Badge>
              )}
            </div>
          )}
          <Button variant="outline" size="sm" className="w-full" onClick={onOpenWordsTab}>
            Управлять словами
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
