// Серверный модуль: работа с LLM (ТОЛЬКО бэкенд).
// Приоритет источников ключа:
//  1) Переменные окружения сервера: GEMINI_API_KEY | OPENROUTER_API_KEY |
//     GROQ_API_KEY | OPENAI_API_KEY (опционально AI_MODEL) — для тех, кто
//     настроил хостинг через dashboard.
//  2) Ключ, вставленный пользователем в настройках приложения (заголовки
//     X-AI-Provider / X-AI-Key / X-AI-Model) — нулевая настройка хостинга.
//  3) z-ai-web-dev-sdk с .z-ai-config (cwd/home//etc) — песочница/локальная разработка.
import ZAI from 'z-ai-web-dev-sdk' // используется только как тип; в рантайме — динамический import
import { getLevel, getVocabLevel } from '@/lib/practice-config'

/** Нет ни ключей в env, ни ключа в приложении, ни .z-ai-config */
export class LlmNotConfiguredError extends Error {
  constructor() {
    super(
      'ИИ не подключён. Откройте настройки (иконка шестерёнки) → «Подключение ИИ» и вставьте бесплатный ключ — это займёт минуту.'
    )
    this.name = 'LlmNotConfiguredError'
  }
}

export interface ProviderOverride {
  provider?: string
  key?: string
  model?: string
}

interface HttpProvider {
  name: string
  baseUrl: string
  apiKey: string
  model: string
}

const PROVIDER_DEFAULTS: Record<
  string,
  { baseUrl: string; model: string }
> = {
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.5-flash',
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
}

function makeProvider(name: string, apiKey: string, model?: string): HttpProvider {
  const defaults = PROVIDER_DEFAULTS[name] ?? PROVIDER_DEFAULTS.openai
  return {
    name,
    baseUrl: defaults.baseUrl,
    apiKey,
    model: model ?? defaults.model,
  }
}

function detectHttpProvider(override?: ProviderOverride): HttpProvider | null {
  const key = (v: string | undefined) =>
    typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined
  const customModel = key(process.env.AI_MODEL)
  const customBase = key(process.env.OPENAI_BASE_URL)?.replace(/\/+$/, '')

  const finish = (p: HttpProvider): HttpProvider => {
    if (customBase) p.baseUrl = customBase
    return p
  }

  // 1) Ключ из переменных окружения сервера (для тех, кто настроил хостинг)
  for (const name of ['gemini', 'openrouter', 'groq', 'openai'] as const) {
    const envName = `${name.toUpperCase()}_API_KEY`
    const envKey = key(process.env[envName])
    if (envKey) return finish(makeProvider(name, envKey, customModel))
  }

  // 2) Ключ, вставленный пользователем в настройках приложения (заголовки)
  const oName = override?.provider && override.provider in PROVIDER_DEFAULTS ? override.provider : undefined
  const oKey = key(override?.key)
  if (oName && oKey) return finish(makeProvider(oName, oKey, key(override?.model)))

  return null
}

/** Есть ли настроенный HTTP-провайдер (диагностика на сервере) */
export function hasConfiguredProvider(override?: ProviderOverride): boolean {
  return detectHttpProvider(override) !== null
}

type ZaiClient = Awaited<ReturnType<typeof ZAI.create>>

let zaiPromise: Promise<ZaiClient> | null = null

/** Резервный путь (песочница/локальная разработка): SDK читает .z-ai-config */
export async function getZAI(): Promise<ZaiClient> {
  if (!zaiPromise) {
    zaiPromise = (async () => {
      const mod = await import('z-ai-web-dev-sdk')
      return mod.default.create()
    })()
  }
  return zaiPromise
}

export interface TargetWord {
  word: string
  translation?: string | null
}

export type TopicMode = 'ai' | 'user'

// ---------- Разнообразие стартов диалога ----------

/** Случайные характеры собеседника — каждый диалог начинается по-разному */
const PERSONAS = [
  'an old friend of the learner who loves hiking, camping and being outdoors',
  'a curious coworker chatting on a lunch break, always asking fun questions',
  'a friendly neighbor who just adopted a naughty puppy and loves gossiping about the hood',
  'a travel enthusiast planning an exciting trip and hunting for tips',
  'a foodie who loves cooking, street food and finding hidden cafés',
  'an energetic gym buddy who is obsessed with fitness challenges',
  'a movie and TV-series geek who watches everything and quotes it',
  'a tech gadget lover who always has some new toy to show off',
  'a laid-back student who is deep into music and concerts',
  'a bookworm with strong opinions and great recommendations',
  'someone who has just moved to the city and is exploring everything',
  'an amateur chef who recently burned dinner and tells it like a funny story',
  'a football fan who is still buzzing after a dramatic match',
  'a photography enthusiast chasing golden-hour shots around town',
  'a coffee-shop regular who people-watches and makes up stories about strangers',
  'a road-trip lover with a car full of snacks and playlists',
]

/** Случайные первые ходы, когда тему выбирает ученик и она не задана */
const OPENING_MOVES = [
  'Share one tiny funny piece of "news" about your day, then ask the learner a short casual question about their day.',
  'Casually ask what the best part of their week has been so far, and react warmly.',
  'Ask a light opinion question about everyday life (food, music, weather, weekends) and share your own take first.',
  'Playfully complain about something small (weather, Mondays, slow wifi) and ask what annoys them lately.',
  'Ask for a recommendation: a movie, a series, a dish or a place worth visiting. Explain why you trust their taste.',
  'Ask about their plans or dreams for the coming weekend. React with genuine curiosity.',
  'Ask how their work or studies are going in a friendly informal way, and mention how yours is going first.',
  'Bring up something "everyone is talking about" these days and ask what they think about it.',
  'Ask a playful "would you rather" question and answer it yourself first.',
  'Mention you are trying to build a new habit lately, then ask if they have any habits or goals they are working on.',
]

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export interface OpeningContext {
  persona: string
  move: string
}

/** Случайный контекст старта: характер + первый ход */
export function pickOpeningContext(): OpeningContext {
  return {
    persona: pickRandom(PERSONAS),
    move: pickRandom(OPENING_MOVES),
  }
}

/** Системный промпт ИИ-собеседника */
export function buildSystemPrompt(opts: {
  level: string
  vocab: string
  words: TargetWord[]
  persona?: string
  topicMode?: TopicMode
  topic?: string
}): string {
  const level = getLevel(opts.level)
  const vocab = getVocabLevel(opts.vocab)

  let wordsBlock = ''
  if (opts.words.length > 0) {
    const wordLines = opts.words
      .slice(0, 40)
      .map((w) => `- ${w.word}${w.translation ? ` (${w.translation})` : ''}`)
      .join('\n')
    wordsBlock = `
The learner is practicing these specific words/phrases (they uploaded them):
${wordLines}

Rules for target words:
- Naturally weave as many of these words into your responses as the topic allows (without forcing all of them at once).
- From time to time, ask questions that invite the learner to use one or two of these words.
- Never translate or explain the target words during the conversation - just use them naturally.`
  }

  const personaBlock = opts.persona
    ? `
TODAY'S CHARACTER (keep it consistent for the whole conversation, but NEVER announce or describe it):
Today you are ${opts.persona}. Let this shape your stories, examples, questions and small talk. You are still Alex, still a supportive conversation partner.`
    : ''

  let topicBlock = ''
  if (opts.topicMode === 'user' && opts.topic) {
    topicBlock = `
TOPIC: The learner chose to talk about: "${opts.topic}". Develop this topic with lively angles, personal mini-stories and follow-up questions. If it naturally runs out of steam, suggest a closely related angle instead of jumping to something random.`
  } else {
    topicBlock = `
TOPIC INITIATIVE (important): You drive the conversation. Propose topics yourself instead of waiting for the learner to pick one. Bring up interesting angles, small stories and questions. When a topic starts dying out, naturally offer to switch to a fresh one you find exciting. Suggest topics that fit your character's interests when possible.`
  }

  return `You are Alex, a friendly English conversation partner. You are talking with a Russian-speaking learner who wants to practice SPOKEN English through voice chat. This is a real-time voice conversation, not writing.

HOW YOU MUST SPEAK (critical):
- Keep every response VERY SHORT: 1-2 short sentences, under 20 words total, like real spoken chat turns. One thought or ONE question per turn. Never write long phrases, never monologue, never cover two topics in one turn.
- React first ("Oh nice!", "Really?"), then at most one short follow-up.
- Use natural spoken register: contractions, casual phrases, reactions.
- NEVER use markdown, asterisks, lists, emoji or quotes formatting. Plain text only - it will be converted to speech and shown as subtitles.
- Never label your speech, never write translations, never explain grammar during the conversation. Just talk naturally like a human.
- Never offer more than 3 topic options in one turn, and phrase them in flowing spoken language, never as a list.
- Vary your phrasing every time: no canned greetings, no repeating the same openers across conversations.
${personaBlock}
${topicBlock}

YOUR SPEECH CHARACTER (controls HOW you speak: tempo, manner, fillers - not the vocabulary range):
${level.prompt}

VOCABULARY LEVEL (controls WHICH WORDS you use - follow it strictly):
${vocab.prompt}
${wordsBlock}

If the learner writes or says something in Russian, stay in English: briefly encourage them to try in English (e.g. "Try it in English, I know you can!") and give a tiny natural hint if useful. Be a fun, supportive partner they want to come back to.`
}

/** Инструкция для первого сообщения (старт диалога) — зависит от режима темы */
export function buildOpeningInstruction(topicMode: TopicMode, topic: string, move: string): string {
  if (topicMode === 'user' && topic) {
    return `[The learner just joined the voice call and chose the topic: "${topic}". Greet them naturally in one short sentence - make the greeting feel fresh and personal, not canned - then open the topic with a lively first question. Keep the whole turn under 25 words.]`
  }
  if (topicMode === 'user') {
    return `[The learner just joined the voice call. ${move} Keep the whole turn under 25 words.]`
  }
  return `[The learner just joined the voice call. In ONE short spoken turn: greet them naturally and personally (one sentence, not a canned phrase), then offer 2-3 concrete interesting topics that fit your character's interests - phrased in flowing spoken language, never as a numbered list - and ask which one they feel like talking about. Keep the whole turn under 35 words.]`
}

/** Промпт для разбора диалога. Возвращает строгий JSON */
export function buildAnalysisPrompt(opts: {
  level: string
  transcript: string
  targetWords: string[]
}): { system: string; user: string } {
  const level = getLevel(opts.level)

  const wordsBlock =
    opts.targetWords.length > 0
      ? `The learner was practicing these target words: ${opts.targetWords.join(', ')}. Check which of them the learner actually used. Note: ASR may have garbled a word the learner actually said correctly - if a target word is missing from the transcript, phrase the note with that in mind.`
      : 'No special target words were set for this conversation.'

  const system = `You are an expert English teacher and methodologist who analyzes dialogues between a Russian-speaking learner and an AI conversation partner. You produce a detailed, honest but supportive analysis IN RUSSIAN (quotes stay in English).

Analyze the transcript below and respond with STRICT JSON ONLY (no markdown fences, no extra text) matching this TypeScript type:

{
  "overallLevel": string,            // оценка уровня говорящего по CEFR: A2, B1, B2, C1... только из этих значений
  "levelComment": string,            // 1-2 предложения почему такой уровень (по-русски)
  "summary": string,                 // 2-4 предложения о том, как прошёл диалог: о чём говорили, что было хорошо, что подтянуть (по-русски)
  "errors": [                        // ТОЛЬКО реальные ошибки самого учащегося (грамматика, времена, артикли, предлоги, выбор слов, порядок слов, калька с русского). Для каждой ошибки:
    {
      "original": string,            // фраза ученика как была (English)
      "corrected": string,           // исправленный вариант (English)
      "type": string,                // одна из: "grammar", "vocabulary", "preposition", "article", "tense", "word choice", "collocation", "style"
      "explanation": string          // краткое объяснение по-русски, почему так и как запомнить
    }
  ],
  "goodExpressions": [               // 3-6 удачных фраз/конструкций, которые ученик использовал хорошо
    { "expression": string, "note": string }  // note по-русски
  ],
  "targetWords": [                   // только если были target words: для каждого слова
    { "word": string, "used": boolean, "note": string } // note по-русски: как использовал / как можно было бы использовать
  ],
  "recommendations": [               // 3-5 конкретных практических рекомендаций по-русски (что потренировать, на что смотреть)
    string
  ]
}

HOW THE LEARNER'S LINES WERE PRODUCED (critical):
The learner SPOKE out loud, and their speech was transcribed by AUTOMATIC SPEECH RECOGNITION (ASR). ASR often introduces artifacts that are NOT the learner's mistakes:
- garbled or non-existent words ("htllo" for "hello", "finking" for "thinking")
- wrong but phonetically similar words (there/their, know/no, quite/quiet, then/than)
- lost or added word endings (-ed, -s), dropped or inserted small words (a, the, to, is)
- merged or split words, mangled proper names, wrong numbers
Rules for handling ASR artifacts:
1. NEVER count ASR artifacts as learner errors. If a word does not exist in English or looks like a phonetic mishearing of a common word, treat it as a transcription artifact and IGNORE it completely.
2. Do NOT include ASR artifacts in the errors array - not even as informational entries with explanations. Skip them entirely: the errors array must contain ONLY mistakes the learner actually made.
3. Report an error ONLY when the learner most likely really said it that way: a consistent grammar pattern (wrong tense, wrong preposition, wrong word order, a calque from Russian), or a clearly wrong word choice in an otherwise well-transcribed phrase.
4. When in doubt whether something is an ASR artifact or the learner's mistake - do NOT flag it. It is much worse to blame the learner for a machine mishearing than to miss one real mistake.
5. Articles (a/the) and endings (-ed, -s) are often lost or distorted by ASR: flag such errors only if the same pattern repeats several times in the transcript or other strong evidence supports it.
6. Never flag informal spoken forms (gonna, wanna, yeah, kinda, contractions) as errors.
7. If the transcript quality was poor overall, briefly mention that in "summary" and focus the analysis on what was clearly recognizable.

General rules:
- Quote learner phrases EXACTLY as they appear in the transcript.
- If the learner made no errors, return an empty errors array - do not invent.
- Do NOT include in "goodExpressions" any phrase that you flagged in "errors" - pick different, genuinely well-formed phrases.
- All explanations, notes, summary, recommendations: in Russian. Quotes/original/corrected: in English as spoken.
- Difficulty of the conversation setting was: ${level.label} (speech character).`

  const user = `Transcript of the conversation (U: learner, A: AI partner):

${opts.transcript}

${wordsBlock}

Produce the JSON analysis now.`

  return { system, user }
}

/** Убрать markdown, рассуждения (<think>) и эмодзи из ответа LLM — текст идёт в TTS и субтитры */
export function cleanSpokenText(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '') // незакрытый тег рассуждений
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[*_#`~]/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Достать JSON из ответа модели (устойчиво к ```json fences) */
export function extractJson(raw: string): unknown {
  let text = raw.trim()
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) text = fence[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1)
  }
  return JSON.parse(text)
}

/** Вызов LLM с ретраями: env-ключ → ключ из приложения → z-ai SDK (песочница) */
export async function chatCompletion(
  messages: { role: 'user' | 'assistant'; content: string }[],
  opts?: { temperature?: number; provider?: ProviderOverride }
): Promise<string> {
  const provider = detectHttpProvider(opts?.provider)
  if (provider) return chatViaHttp(provider, messages, opts)
  return chatViaZai(messages, opts)
}

/** Первый assistant-сообщения в наших роутах — это системный промпт; для
 * OpenAI-совместимых API отправляем его корректно, как role:'system' */
function toProviderMessages(messages: { role: 'user' | 'assistant'; content: string }[]) {
  return messages.map((m, i) => ({
    role:
      i === 0 && m.role === 'assistant'
        ? ('system' as const)
        : (m.role as 'user' | 'assistant'),
    content: m.content,
  }))
}

async function chatViaHttp(
  provider: HttpProvider,
  messages: { role: 'user' | 'assistant'; content: string }[],
  opts?: { temperature?: number }
): Promise<string> {
  let lastError: unknown = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
          // OpenRouter просит (не обязательно) заголовки приложения
          ...(provider.name === 'openrouter'
            ? { 'HTTP-Referer': 'https://english-practice.local', 'X-Title': 'English Speaking Practice' }
            : {}),
        },
        body: JSON.stringify({
          model: provider.model,
          messages: toProviderMessages(messages),
          ...(opts?.temperature !== undefined ? { temperature: opts.temperature } : {}),
        }),
        signal: AbortSignal.timeout(30_000),
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`LLM HTTP ${res.status} (${provider.name}/${provider.model}): ${body.slice(0, 300)}`)
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string | null } }[]
      }
      const content = data.choices?.[0]?.message?.content
      if (content && content.trim().length > 0) return content
      throw new Error('Empty LLM response')
    } catch (err) {
      lastError = err
      if (attempt < 3) await new Promise((r) => setTimeout(r, 800 * attempt))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('LLM failed')
}

async function chatViaZai(
  messages: { role: 'user' | 'assistant'; content: string }[],
  opts?: { temperature?: number }
): Promise<string> {
  try {
    const zai = await getZAI()
    let lastError: unknown = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const completion = await zai.chat.completions.create({
          messages,
          thinking: { type: 'disabled' },
          ...(opts?.temperature !== undefined ? { temperature: opts.temperature } : {}),
        } as Parameters<typeof zai.chat.completions.create>[0])
        const content = completion.choices[0]?.message?.content
        if (content && content.trim().length > 0) return content
        throw new Error('Empty LLM response')
      } catch (err) {
        lastError = err
        if (attempt < 3) await new Promise((r) => setTimeout(r, 800 * attempt))
      }
    }
    throw lastError instanceof Error ? lastError : new Error('LLM failed')
  } catch (err) {
    // Нет .z-ai-config (типично для Vercel) → понятная ошибка с инструкцией
    const msg = err instanceof Error ? err.message : String(err)
    if (/Configuration file not found|z-ai-config/i.test(msg)) throw new LlmNotConfiguredError()
    throw err
  }
}
