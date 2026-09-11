'use client'
// Подсветка целевых слов в тексте сообщений
import type { ReactNode } from 'react'

export function renderWithTargetWords(
  text: string,
  words: string[],
  markClassName = 'bg-emerald-100 text-emerald-900 rounded px-0.5 font-medium'
): ReactNode {
  const cleanWords = words.filter((w) => w.trim().length > 0)
  if (cleanWords.length === 0) return text

  const escaped = cleanWords.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi')
  const parts = text.split(re)

  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className={markClassName}>
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}
