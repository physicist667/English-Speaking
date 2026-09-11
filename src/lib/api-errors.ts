// Единый формат понятных ошибок API для не-технического пользователя.
import { LlmNotConfiguredError } from '@/lib/ai'

/** Ключ провайдер отклонил (401/403) — неверный или отозванный */
export const AI_KEY_REJECTED_HINT =
  'Провайдер отклонил ключ ИИ. Проверьте, что ключ скопирован полностью и действует: настройки → «Подключение ИИ».'

/** Признаки ошибки ключа/доступа провайдера */
const KEY_ERROR_RE = /LLM HTTP 40[13]|401|403|unauthorized|invalid[ _-]?(api[ _-])?key|api key not valid|permission denied|quota exceeded|unregistered/i

export function friendlyError(err: unknown, fallback: string): string {
  if (err instanceof LlmNotConfiguredError) return err.message
  const e = err as { message?: string; code?: string }
  const msg = `${e?.message ?? ''} ${e?.code ?? ''}`
  if (KEY_ERROR_RE.test(msg)) return AI_KEY_REJECTED_HINT
  return fallback
}
