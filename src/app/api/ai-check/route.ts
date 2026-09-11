// POST /api/ai-check — проверка подключения ИИ из настроек приложения.
// Делает минимальный вызов LLM с теми же заголовками, что и /api/chat.
import { NextRequest, NextResponse } from 'next/server'
import { chatCompletion } from '@/lib/ai'
import { friendlyError } from '@/lib/api-errors'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const providerOverride = {
      provider: req.headers.get('X-AI-Provider') ?? undefined,
      key: req.headers.get('X-AI-Key') ?? undefined,
      model: req.headers.get('X-AI-Model') ?? undefined,
    }
    const reply = await chatCompletion(
      [
        { role: 'assistant', content: 'You are a connection tester. Reply with exactly: OK' },
        { role: 'user', content: 'Reply with OK' },
      ],
      { temperature: 0, provider: providerOverride }
    )
    return NextResponse.json({ ok: true, sample: reply.trim().slice(0, 40) })
  } catch (err) {
    console.error('ai-check error:', err)
    return NextResponse.json(
      { ok: false, error: friendlyError(err, 'Не удалось подключиться к ИИ') },
      { status: 500 }
    )
  }
}
