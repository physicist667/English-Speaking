'use client'
// Отображение разбора диалога: уровень, ошибки, удачные фразы, слова, рекомендации
import {
  AlertCircle,
  ArrowRight,
  BookOpenCheck,
  GraduationCap,
  Lightbulb,
  Sparkles,
  Target,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { AnalysisData } from '@/lib/types'

const ERROR_TYPE_RU: Record<string, string> = {
  grammar: 'Грамматика',
  vocabulary: 'Лексика',
  preposition: 'Предлог',
  article: 'Артикль',
  tense: 'Время глагола',
  'word choice': 'Выбор слова',
  'word choice ': 'Выбор слова',
  collocation: 'Сочетаемость',
  style: 'Стиль',
  spelling: 'Орфография',
  'word order': 'Порядок слов',
}

function errorTypeRu(t?: string): string {
  if (!t) return 'Ошибка'
  const key = t.toLowerCase().trim()
  return ERROR_TYPE_RU[key] ?? t.charAt(0).toUpperCase() + t.slice(1)
}

export function AnalysisView({ analysis }: { analysis: AnalysisData }) {
  const hasTargetWords = (analysis.targetWords?.length ?? 0) > 0
  const usedCount =
    analysis.targetWords?.filter((w) => w.used).length ?? 0

  return (
    <div className="flex flex-col gap-4">
      {/* Уровень и резюме */}
      <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-white shadow-sm">
              <GraduationCap className="h-5 w-5" />
              <span className="text-lg font-bold">{analysis.overallLevel || '—'}</span>
            </span>
            <p className="min-w-48 flex-1 text-sm text-muted-foreground">
              {analysis.levelComment || 'Примерная оценка вашего уровня по этому диалогу'}
            </p>
          </div>
          {analysis.summary && (
            <p className="mt-3 text-sm leading-relaxed">{analysis.summary}</p>
          )}
        </CardContent>
      </Card>

      {/* Ошибки */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            Ошибки
            <Badge variant="secondary">{analysis.errors?.length ?? 0}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!analysis.errors || analysis.errors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Грамматических и лексических ошибок не найдено — отличная работа! 🎉
            </p>
          ) : (
            analysis.errors.map((err, i) => (
              <div key={i} className="rounded-xl border bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {errorTypeRu(err.type)}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-col gap-1.5 text-sm">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-red-600 line-through decoration-red-300">
                      {err.original}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="font-medium text-emerald-700">{err.corrected}</span>
                  </span>
                  {err.explanation && (
                    <span className="text-xs leading-relaxed text-muted-foreground">
                      {err.explanation}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Удачные выражения */}
      {(analysis.goodExpressions?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              Что получилось хорошо
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {analysis.goodExpressions?.map((g, i) => (
              <div key={i} className="rounded-lg bg-emerald-50/60 p-2.5 text-sm">
                <span className="font-medium text-emerald-900">&laquo;{g.expression}&raquo;</span>
                {g.note && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">{g.note}</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Целевые слова */}
      {hasTargetWords && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-emerald-600" />
              Целевые слова
              <Badge variant="secondary">
                {usedCount}/{analysis.targetWords?.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {analysis.targetWords?.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <Badge
                  className={
                    w.used
                      ? 'bg-emerald-600 text-white'
                      : 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                  }
                >
                  {w.used ? 'использовано' : 'не задействовано'}
                </Badge>
                <div className="min-w-0">
                  <span className="font-medium">{w.word}</span>
                  {w.note && (
                    <p className="text-xs leading-snug text-muted-foreground">{w.note}</p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Рекомендации */}
      {(analysis.recommendations?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Рекомендации
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {analysis.recommendations?.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <BookOpenCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span className="leading-relaxed">{r}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Separator className="opacity-0" />
    </div>
  )
}
