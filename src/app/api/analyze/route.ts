// POST /api/analyze — разбор диалога: ошибки, уровень, рекомендации.
// Stateless: расшифровку и слова присылает клиент, результат сохраняется у клиента.
import { NextRequest, NextResponse } from 'next/server'
import { buildAnalysisPrompt, chatCompletion, extractJson } from '@/lib/ai'
import type { AnalysisData } from '@/lib/types'
import { friendlyError } from '@/lib/api-errors'

export const maxDuration = 60 // лимит серверлесс-функции на Vercel

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const transcript: string =
      typeof body.transcript === 'string' ? body.transcript.trim() : ''
    const level: string = typeof body.level === 'string' ? body.level : 'casual'

    if (!transcript) {
      return NextResponse.json(
        { error: 'Пустая расшифровка диалога' },
        { status: 400 }
      )
    }
    if (!/^\s*U:/m.test(transcript)) {
      return NextResponse.json(
        { error: 'Пока нечего разбирать — вы ещё не сказали ни слова' },
        { status: 400 }
      )
    }

    const targetWords: string[] = Array.isArray(body.targetWords)
      ? body.targetWords
          .filter((w: unknown): w is string => typeof w === 'string' && w.trim().length > 0)
          .slice(0, 40)
      : []

    const { system, user } = buildAnalysisPrompt({
      level,
      transcript,
      targetWords,
    })

    // Ключ ИИ из настроек приложения (заголовки) — если пользователь его вставил
    const providerOverride = {
      provider: req.headers.get('X-AI-Provider') ?? undefined,
      key: req.headers.get('X-AI-Key') ?? undefined,
      model: req.headers.get('X-AI-Model') ?? undefined,
    }

    const raw = await chatCompletion(
      [
        { role: 'assistant', content: system },
        { role: 'user', content: user },
      ],
      { temperature: 0.3, provider: providerOverride }
    )

    const parsed = extractJson(raw) as AnalysisData

    // Санитизация
    const analysis: AnalysisData = {
      overallLevel: typeof parsed.overallLevel === 'string' ? parsed.overallLevel : undefined,
      levelComment: typeof parsed.levelComment === 'string' ? parsed.levelComment : undefined,
      summary: typeof parsed.summary === 'string' ? parsed.summary : undefined,
      errors: Array.isArray(parsed.errors)
        ? parsed.errors.slice(0, 30).map((e) => ({
            original: String(e?.original ?? ''),
            corrected: String(e?.corrected ?? ''),
            type: String(e?.type ?? 'grammar'),
            explanation: String(e?.explanation ?? ''),
          }))
        : [],
      goodExpressions: Array.isArray(parsed.goodExpressions)
        ? parsed.goodExpressions.slice(0, 10).map((e) => ({
            expression: String(e?.expression ?? ''),
            note: String(e?.note ?? ''),
          }))
        : [],
      targetWords: Array.isArray(parsed.targetWords)
        ? parsed.targetWords.slice(0, 60).map((w) => ({
            word: String(w?.word ?? ''),
            used: Boolean(w?.used),
            note: String(w?.note ?? ''),
          }))
        : [],
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.slice(0, 8).map(String)
        : [],
    }

    return NextResponse.json({ analysis })
  } catch (err) {
    console.error('analyze error:', err)
    return NextResponse.json(
      { error: friendlyError(err, 'Не удалось разобрать диалог. Попробуйте ещё раз.') },
      { status: 500 }
    )
  }
}
