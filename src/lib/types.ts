// Общие типы для клиента и сервера
import type { VocabId } from '@/lib/practice-config'

export type Role = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: Role
  content: string
  createdAt: string
}

export interface ConversationListItem {
  id: string
  title: string
  level: string
  voice: string
  createdAt: string
  endedAt: string | null
  messageCount: number
  hasAnalysis: boolean
}

export interface ConversationDetail {
  id: string
  title: string
  level: string
  voice: string
  speed: number
  persona?: string
  topicMode?: TopicMode
  topic?: string
  createdAt: string
  endedAt: string | null
  messages: ChatMessage[]
  analysis: AnalysisData | null
  analysisCreatedAt: string | null
}

export interface AnalysisError {
  original?: string
  corrected?: string
  type?: string
  explanation?: string
}

export interface AnalysisData {
  overallLevel?: string
  levelComment?: string
  summary?: string
  errors?: AnalysisError[]
  goodExpressions?: { expression?: string; note?: string }[]
  targetWords?: { word?: string; used?: boolean; note?: string }[]
  recommendations?: string[]
}

export interface WordItem {
  id: string
  word: string
  translation?: string | null
}

export interface WordListItem {
  id: string
  name: string
  active: boolean
  createdAt: string
  words: WordItem[]
}

export interface ChatTurnResponse {
  reply: string
  /** Характер собеседника — клиент сохраняет и присылает обратно для консистентности */
  persona: string
  usedWords: string[]
}

export interface AnalyzeRequest {
  transcript: string
  level: string
  targetWords: string[]
}

export type TopicMode = 'ai' | 'user'

export type AiProviderId = 'gemini' | 'openrouter' | 'groq' | 'openai'

export interface PracticeSettings {
  level: string
  vocab: VocabId // уровень словарного запаса собеседника
  voice: string
  speed: number
  topicMode: TopicMode // ai — темы предлагает собеседник, user — выбирает ученик
  topic: string // тема ученика (для topicMode = user)
}
