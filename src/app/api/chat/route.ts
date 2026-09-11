// POST /api/chat — сообщение ИИ-собеседнику (или старт нового диалога).
// Stateless: без базы данных. Историю диалога и активные слова присылает клиент
// (они хранятся у него в localStorage), сервер только вызывает LLM.
import { NextRequest, NextResponse } from 'next/server'
import {
  buildSystemPrompt,
  buildOpeningInstruction,
  chatCompletion,
  cleanSpokenText,
  pickOpeningContext,
  type TargetWord,
  type TopicMode,
} from '@/lib/ai'
import { getLevel, getVocabLevel, SPEED_MAX, SPEED_MIN } from '@/lib/practice-config'
import { friendlyError } from '@/lib/api-errors'

export const maxDuration = 60 // лимит серверлесс-функции на Vercel (LLM может думать долго)

const HISTORY_LIMIT = 40
const MAX_WORDS = 40

interface HistoryTurn {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const message: string = (body.message ?? '').trim()
    const start: boolean = Boolean(body.start)
    const level = getLevel(String(body.level ?? 'casual')).id
    const vocab = getVocabLevel(String(body.vocab ?? 'intermediate')).id
    const topicMode: TopicMode = body.topicMode === 'user' ? 'user' : 'ai'
    const topic = typeof body.topic === 'string' ? body.topic.trim().slice(0, 200) : ''

    if (!start && !message) {
      return NextResponse.json({ error: 'Пустое сообщение' }, { status: 400 })
    }

    // Активные слова пользователя (присылает клиент из localStorage)
    const targetWords: TargetWord[] = Array.isArray(body.words)
      ? body.words
          .filter((w: unknown): w is { word: string; translation?: string | null } => {
            const o = w as { word?: unknown } | null
            return typeof o?.word === 'string' && o.word.trim().length > 0
          })
          .slice(0, MAX_WORDS)
          .map((w: { word: string; translation?: string | null }) => ({
            word: w.word.trim().slice(0, 80),
            translation:
              typeof w.translation === 'string' ? w.translation.slice(0, 200) : null,
          }))
      : []

    // Характер собеседника: клиент присылает сохранённый (консистентность в рамках
    // диалога) либо сервер выбирает случайного — только для старта
    const persona: string =
      typeof body.persona === 'string' && body.persona.trim()
        ? body.persona.trim().slice(0, 400)
        : pickOpeningContext().persona

    // История: клиент присылает последние ходы диалога
    const history: HistoryTurn[] = Array.isArray(body.history)
      ? body.history
          .filter(
            (m: unknown): m is HistoryTurn => {
              const o = m as { role?: unknown; content?: unknown } | null
              return (
                (o?.role === 'user' || o?.role === 'assistant') &&
                typeof o?.content === 'string' &&
                o.content.trim().length > 0
              )
            }
          )
          .slice(-HISTORY_LIMIT)
          .map((m: HistoryTurn) => ({
            role: m.role,
            content: m.content.slice(0, 4000),
          }))
      : []

    const system = buildSystemPrompt({
      level,
      vocab,
      words: targetWords,
      persona,
      topicMode,
      topic,
    })
    const llmMessages: { role: 'user' | 'assistant'; content: string }[] = [
      { role: 'assistant', content: system },
      ...history,
    ]

    // Диалог без user-сообщений (приветствие): API требует хотя бы одно user-сообщение
    if (!llmMessages.some((m) => m.role === 'user')) {
      const openingMove = pickOpeningContext().move
      llmMessages.push({
        role: 'user',
        content: buildOpeningInstruction(topicMode, topic, openingMove),
      })
    }

    // Ключ ИИ из настроек приложения (заголовки) — если пользователь его вставил
    const providerOverride = {
      provider: req.headers.get('X-AI-Provider') ?? undefined,
      key: req.headers.get('X-AI-Key') ?? undefined,
      model: req.headers.get('X-AI-Model') ?? undefined,
    }

    const rawReply = await chatCompletion(llmMessages, {
      temperature: 0.9,
      provider: providerOverride,
    })
    const reply = cleanSpokenText(rawReply)

    if (!reply) {
      return NextResponse.json(
        { error: 'ИИ не вернул ответ, попробуйте ещё раз' },
        { status: 502 }
      )
    }

    // Какие целевые слова ИИ использовал
    const usedWords = targetWords
      .filter((w) =>
        new RegExp(`\\b${w.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(reply)
      )
      .map((w) => w.word)

    return NextResponse.json({ reply, persona, usedWords })
  } catch (err) {
    console.error('chat error:', err)
    return NextResponse.json(
      { error: friendlyError(err, 'Не удалось получить ответ собеседника. Попробуйте ещё раз.') },
      { status: 500 }
    )
  }
}
